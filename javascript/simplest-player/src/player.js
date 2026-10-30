/**
 * The tape deck: transport controls over one inserted cassette.
 *
 * A deck is not a playlist. It has a head that sits somewhere on the tape,
 * plays at real time, winds at a multiple of it, stops at the ends of a
 * side, and reaches the other side by turning the cassette over.
 *
 * The Player only coordinates. The work is done by:
 *   - openCassette()  reading and validating the file   (cassette.js)
 *   - TapeHead        where the head is                 (tape-head.js)
 *   - AudioOutput     making sound                      (audio-output.js)
 *   - PositionStore   remembering where a tape was left (position-store.js)
 *
 * It dispatches {@link PlayerEvent.CHANGE} when the cassette, side or mode
 * changes. The head moves continuously, so a UI reads `player.head` in its
 * own animation loop instead of waiting for events.
 *
 * @module player
 */

import { AudioOutput } from './audio-output.js';
import { markerAt, openCassette } from './cassette.js';
import { Mode, PlayerEvent, Side, TAPE_SPEED } from './constants.js';
import { PositionStore } from './position-store.js';
import { TapeHead } from './tape-head.js';
import { framesToSeconds, secondsToFrames } from './time.js';

/** @typedef {import('./cassette.js').Cassette} Cassette */
/** @typedef {import('./cassette.js').CassetteSide} CassetteSide */
/** @typedef {import('./cassette.js').Marker} Marker */

export class Player extends EventTarget {
  /** @type {Cassette | null} */
  #cassette = null;
  #side = Side.A;
  #mode = Mode.STOP;
  #head = new TapeHead();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #endOfTapeTimer;
  #output;
  #positions;

  /**
   * @param {object} [options]
   * @param {AudioOutput} [options.output]
   * @param {PositionStore} [options.positions]
   */
  constructor({ output = new AudioOutput(), positions = new PositionStore() } = {}) {
    super();
    this.#output = output;
    this.#positions = positions;
  }

  /* ----- state ----- */

  /** The inserted cassette, or null. */
  get cassette() {
    return this.#cassette;
  }

  /** 'A' or 'B'. */
  get side() {
    return this.#side;
  }

  /** One of {@link Mode}. */
  get mode() {
    return this.#mode;
  }

  /** Head position in seconds from the start of the current side. */
  get head() {
    return this.#head.position;
  }

  /** Length of a side in seconds; both sides are equally long (§5.1). */
  get sideSeconds() {
    return this.#cassette?.sideSeconds ?? 0;
  }

  /** @returns {CassetteSide | null} */
  get currentSide() {
    return this.#cassette?.sides[this.#side] ?? null;
  }

  /** The track marker at or before the head (§7.4). @returns {Marker | null} */
  get currentMarker() {
    const side = this.currentSide;
    return side ? markerAt(side.markers, this.head) : null;
  }

  /** True while the head is past the recording: blank tape (§5.5). */
  get onBlankTape() {
    const side = this.currentSide;
    return side !== null && this.head >= side.recordedSeconds;
  }

  /* ----- cassette ----- */

  /**
   * Insert a cassette. The previous one stays in the deck if this one can't
   * be opened.
   *
   * @param {ArrayBuffer} buffer  the bytes of an .otape file
   * @returns {Promise<Cassette>}
   * @throws {OTapeError} naming the rule an invalid file breaks
   */
  async load(buffer) {
    const cassette = await openCassette(buffer, (bytes) => this.#output.decode(bytes));

    this.#takeOut();
    this.#cassette = cassette;
    this.#restorePosition();
    this.#emitChange();
    return cassette;
  }

  /** Take the cassette out of the deck. */
  eject() {
    if (!this.#cassette) return;
    this.#takeOut();
    this.#emitChange();
  }

  /* ----- transport ----- */

  /** PLAY from the head. Past the recording the tape runs in silence (§5.5). */
  play() {
    if (!this.#cassette || this.head >= this.sideSeconds) return;
    this.#halt();

    const side = this.currentSide;
    const start = this.head;
    if (side.buffer && start < side.recordedSeconds) {
      // Stop exactly at recorded_frames, even if the decoded file is longer.
      // If it is shorter, the rest is silence (§7.3).
      this.#output.play(side.buffer, start, side.recordedSeconds - start);
    }
    this.#run(Mode.PLAY);
  }

  /** FAST FORWARD towards the end of the side (§7.5). */
  fastForward() {
    this.#wind(Mode.FAST_FORWARD);
  }

  /** REWIND towards the start of the side (§7.5). */
  rewind() {
    this.#wind(Mode.REWIND);
  }

  /** STOP. The tape stays where it is. */
  stop() {
    if (!this.#cassette) return;
    this.#halt();
    this.#savePosition();
    this.#emitChange();
  }

  /**
   * Turn the cassette over. Both sides share one tape, so a head p seconds
   * into one side is L − p seconds into the other (§5.4).
   */
  flip() {
    if (!this.#cassette) return;
    this.#halt();
    this.#side = oppositeSide(this.#side);
    this.#head.moveTo(this.sideSeconds - this.head);
    this.#savePosition();
    this.#emitChange();
  }

  /* ----- internals ----- */

  #wind(mode) {
    if (!this.#cassette) return;
    this.#halt();
    this.#run(mode);
  }

  /** Start the tape at the speed of `mode`, until it reaches an end of the side. */
  #run(mode) {
    this.#mode = mode;
    this.#head.setSpeed(TAPE_SPEED[mode]);
    // At the end of a side the deck stops; there is no auto-reverse (§7.5).
    this.#endOfTapeTimer = setTimeout(() => this.stop(), this.#head.secondsToEnd * 1000);
    this.#emitChange();
  }

  /** Stop the tape and the sound, without saving or notifying. */
  #halt() {
    clearTimeout(this.#endOfTapeTimer);
    this.#output.stop();
    this.#head.setSpeed(TAPE_SPEED[Mode.STOP]);
    this.#mode = Mode.STOP;
  }

  #takeOut() {
    if (!this.#cassette) return;
    this.#halt();
    this.#savePosition();
    this.#cassette = null;
    this.#side = Side.A;
    this.#head.load(0);
  }

  /** Put the tape back where it was left last time (§14). */
  #restorePosition() {
    const { id, rate, sideSeconds } = this.#cassette;
    const saved = this.#positions.load(id);
    this.#side = saved?.side ?? Side.A;
    this.#head.load(sideSeconds, saved ? framesToSeconds(saved.frame, rate) : 0);
  }

  #savePosition() {
    const { id, rate } = this.#cassette;
    this.#positions.save(id, { side: this.#side, frame: secondsToFrames(this.head, rate) });
  }

  #emitChange() {
    this.dispatchEvent(new Event(PlayerEvent.CHANGE));
  }
}

/** @param {string} side */
function oppositeSide(side) {
  return side === Side.A ? Side.B : Side.A;
}
