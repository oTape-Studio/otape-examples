/**
 * The tape deck: transport over one inserted cassette.
 *
 * A deck is not a playlist. A head sits somewhere on the tape, plays at real
 * time, winds at a multiple of it, stops at either end of a side, and
 * reaches the other side by turning the cassette over (§5.4, §7.5).
 *
 * The deck coordinates; the work is done elsewhere:
 *   - {@link CassetteFile}   reading the file
 *   - {@link TapeHead}       where the head is
 *   - {@link PlaybackOutput} making sound
 *   - {@link PositionStore}  remembering where a tape was left
 *
 * Transport calls are cheap and may be made at any time. Asynchronous work
 * (loading a side, starting audio) is cancelled by any later call, so the
 * deck always ends up in the state of the last command.
 */

import type { CassetteFile } from '../core/cassette/cassette-file.ts';
import type { Cassette, CassetteSide, Marker } from '../core/cassette/model.ts';
import { Side } from '../core/constants.ts';
import { Emitter } from '../util/emitter.ts';
import { framesToSeconds, secondsToFrames } from '../util/time.ts';
import { AudioElementOutput, type PlaybackOutput } from './playback-output.ts';
import { WebStoragePositionStore, type PositionStore } from './position-store.ts';
import { ReelModel, type ReelState } from './reel-model.ts';
import { TapeHead, type Clock } from './tape-head.ts';

export const Mode = {
  Stopped: 'stopped',
  Playing: 'playing',
  FastForward: 'fast-forward',
  Rewinding: 'rewinding',
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

/**
 * How many times faster than real time the tape winds. A real deck winds a
 * C60 side in one to two minutes, roughly 15× to 30× (§7.5).
 */
export const DEFAULT_WIND_SPEED = 24;

export const DeckErrorCode = {
  /** The browser can't decode this side's codec (§7.3). */
  Unplayable: 'unplayable',
  /** Playback failed to start, e.g. blocked autoplay or a damaged file. */
  PlaybackFailed: 'playback-failed',
} as const;
export type DeckErrorCode = (typeof DeckErrorCode)[keyof typeof DeckErrorCode];

export class DeckError extends Error {
  override readonly name = 'DeckError';

  constructor(
    readonly code: DeckErrorCode,
    readonly side: Side,
    options?: ErrorOptions,
  ) {
    super(
      code === DeckErrorCode.Unplayable
        ? `Side ${side} uses a codec this browser can't play`
        : `Side ${side} could not be played`,
      options,
    );
  }
}

export interface DeckEvents extends Record<string, unknown> {
  /** The cassette, side or mode changed. The head moves continuously: poll `deck.head`. */
  change: undefined;
  error: DeckError;
}

export interface DeckOptions {
  readonly output?: PlaybackOutput;
  readonly positions?: PositionStore;
  readonly clock?: Clock;
  readonly windSpeed?: number;
}

export class Deck extends Emitter<DeckEvents> {
  #file: CassetteFile | null = null;
  #reels: ReelModel | null = null;
  #side: Side = Side.A;
  #mode: Mode = Mode.Stopped;
  #audioReady: Promise<void> = Promise.resolve();
  #timers: ReturnType<typeof setTimeout>[] = [];
  /** Incremented by every transport command; stale async work checks it. */
  #transport = 0;
  /** Incremented whenever another side's audio is requested. */
  #loading = 0;

  readonly #head: TapeHead;
  readonly #output: PlaybackOutput;
  readonly #positions: PositionStore;
  readonly #windSpeed: number;

  constructor(options: DeckOptions = {}) {
    super();
    this.#output = options.output ?? new AudioElementOutput();
    this.#positions = options.positions ?? new WebStoragePositionStore();
    this.#head = new TapeHead(options.clock);
    this.#windSpeed = options.windSpeed ?? DEFAULT_WIND_SPEED;
  }

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  get file(): CassetteFile | null {
    return this.#file;
  }

  get cassette(): Cassette | null {
    return this.#file?.cassette ?? null;
  }

  get side(): Side {
    return this.#side;
  }

  get mode(): Mode {
    return this.#mode;
  }

  /** Head position in seconds from the start of the current side. */
  get head(): number {
    return this.#head.position;
  }

  /** Length of a side in seconds, 0 when the deck is empty. */
  get sideSeconds(): number {
    return this.cassette?.sideSeconds ?? 0;
  }

  get currentSide(): CassetteSide | null {
    return this.cassette?.sides[this.#side] ?? null;
  }

  /** The marker at or before the head, e.g. the song playing (§7.4). */
  get currentMarker(): Marker | null {
    const head = this.head;
    return this.currentSide?.markers.findLast((marker) => marker.seconds <= head) ?? null;
  }

  /** Whether the head is past the recording, on blank tape (§5.5). */
  get onBlankTape(): boolean {
    const side = this.currentSide;
    return side !== null && this.head >= side.recordedSeconds;
  }

  /** Tape packs and reel turns at the head (Appendix B.3). */
  get reels(): ReelState | null {
    return this.#reels?.at(this.head) ?? null;
  }

  /** The three-digit tape counter. */
  get counter(): string {
    return this.#reels?.counter(this.head) ?? '000';
  }

  /** Whether a side can be heard in this browser. Blank sides always can. */
  isPlayable(side: Side = this.#side): boolean {
    const audio = this.cassette?.sides[side].audio;
    if (!audio) return true;
    return audio.mediaType !== null && this.#output.canPlay(audio.mediaType);
  }

  get volume(): number {
    return this.#output.volume;
  }

  set volume(value: number) {
    this.#output.volume = value;
  }

  /* ------------------------------------------------------------------------ */
  /* Cassette                                                                 */
  /* ------------------------------------------------------------------------ */

  /** Insert a cassette, wound to where it was left last time (§14). */
  async insert(file: CassetteFile): Promise<void> {
    this.#unload();
    this.#file = file;
    this.#reels = new ReelModel(file.cassette.sideSeconds);
    this.#restorePosition(file.cassette);
    this.#emitChange();
    await this.#loadSide();
  }

  /** Take the cassette out. */
  eject(): void {
    if (!this.#file) return;
    this.#unload();
    this.#emitChange();
  }

  /** Eject and release the audio output. */
  dispose(): void {
    this.eject();
    this.#output.dispose();
  }

  /* ------------------------------------------------------------------------ */
  /* Transport                                                                */
  /* ------------------------------------------------------------------------ */

  /** PLAY from the head. Past the recording the tape runs in silence (§5.5). */
  async play(): Promise<void> {
    const side = this.currentSide;
    if (!side || this.head >= this.sideSeconds) return;

    this.#halt();
    const transport = this.#transport;
    const start = this.head;
    const audible = side.audio !== null && start < side.recordedSeconds;

    if (audible) {
      if (!this.isPlayable()) {
        this.emit('error', new DeckError(DeckErrorCode.Unplayable, this.#side));
        return;
      }
      try {
        await this.#audioReady;
        if (transport !== this.#transport) return;
        await this.#output.play(start);
      } catch (cause) {
        if (transport === this.#transport) {
          this.#output.pause();
          this.emit('error', new DeckError(DeckErrorCode.PlaybackFailed, this.#side, { cause }));
        }
        return;
      }
      // Another command arrived while the audio was starting.
      if (transport !== this.#transport) {
        this.#output.pause();
        return;
      }
    }

    this.#run(Mode.Playing, this.sideSeconds);
    // Cut the sound exactly at recorded_frames, however long the file decodes (§7.3).
    if (audible) {
      this.#when(side.recordedSeconds, () => {
        this.#output.pause();
      });
    }
  }

  /** FAST FORWARD to the end of the side. */
  fastForward(): void {
    this.#windTo(this.sideSeconds);
  }

  /** REWIND to the start of the side. */
  rewind(): void {
    this.#windTo(0);
  }

  /**
   * Wind to a position and stop there. The tape gets there by winding, not by
   * jumping, as a real deck would (§7.4).
   */
  cue(seconds: number): void {
    this.#windTo(seconds);
  }

  /** STOP. The tape stays where it is. */
  stop(): void {
    if (!this.#file) return;
    this.#halt();
    this.#savePosition();
    this.#emitChange();
  }

  /**
   * Turn the cassette over. Both sides share one tape, so a head p seconds
   * into one side is L − p seconds into the other (§5.4).
   */
  async flip(): Promise<void> {
    if (!this.#file) return;
    this.#halt();
    this.#side = this.#side === Side.A ? Side.B : Side.A;
    this.#head.moveTo(this.sideSeconds - this.head);
    this.#savePosition();
    this.#emitChange();
    await this.#loadSide();
  }

  /* ------------------------------------------------------------------------ */
  /* Internals                                                                */
  /* ------------------------------------------------------------------------ */

  #windTo(target: number): void {
    if (!this.#file) return;
    this.#halt();
    const position = this.head;
    if (target === position) return;
    this.#run(target > position ? Mode.FastForward : Mode.Rewinding, target);
  }

  /** Move the tape in `mode` until the head reaches `target`, then stop. */
  #run(mode: Mode, target: number): void {
    this.#mode = mode;
    this.#head.setSpeed(this.#speedOf(mode));
    this.#when(target, () => {
      this.stop();
    });
    this.#emitChange();
  }

  #speedOf(mode: Mode): number {
    switch (mode) {
      case Mode.Stopped:
        return 0;
      case Mode.Playing:
        return 1;
      case Mode.FastForward:
        return this.#windSpeed;
      case Mode.Rewinding:
        return -this.#windSpeed;
    }
  }

  /** Run `action` when the moving head reaches `position`. */
  #when(position: number, action: () => void): void {
    const seconds = this.#head.secondsUntil(position);
    if (Number.isFinite(seconds)) this.#timers.push(setTimeout(action, seconds * 1000));
  }

  /** Stop tape and sound, and cancel pending work. Doesn't save or notify. */
  #halt(): void {
    this.#transport++;
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers = [];
    this.#output.pause();
    this.#head.setSpeed(0);
    this.#mode = Mode.Stopped;
  }

  #unload(): void {
    if (!this.#file) return;
    this.#halt();
    this.#savePosition();
    this.#loading++;
    this.#output.load(null);
    this.#audioReady = Promise.resolve();
    this.#file = null;
    this.#reels = null;
    this.#side = Side.A;
    this.#head.load(0);
  }

  /** Hand the current side's audio to the output. Play waits for this. */
  async #loadSide(): Promise<void> {
    const file = this.#file;
    if (!file) return;
    const loading = ++this.#loading;
    const side = this.#side;

    this.#audioReady = file.audio(side).then((audio) => {
      if (loading === this.#loading) this.#output.load(audio);
    });
    await this.#audioReady.catch((cause: unknown) => {
      if (loading === this.#loading)
        this.emit('error', new DeckError(DeckErrorCode.PlaybackFailed, side, { cause }));
    });
  }

  #restorePosition(cassette: Cassette): void {
    const saved = this.#positions.load(cassette.id);
    this.#side = saved?.side ?? Side.A;
    this.#head.load(cassette.sideSeconds, saved ? framesToSeconds(saved.frame, cassette.rate) : 0);
  }

  #savePosition(): void {
    const cassette = this.cassette;
    if (!cassette) return;
    this.#positions.save(cassette.id, { side: this.#side, frame: secondsToFrames(this.head, cassette.rate) });
  }

  #emitChange(): void {
    this.emit('change', undefined);
  }
}
