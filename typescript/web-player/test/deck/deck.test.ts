// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CassetteFile } from '../../src/core/cassette/cassette-file.ts';
import { Deck, DeckErrorCode, Mode, type DeckError } from '../../src/deck/deck.ts';
import { MemoryPositionStore } from '../../src/deck/position-store.ts';
import { cassetteBlob, FakeOutput, minimalManifest, recordedSide } from '../helpers/fixtures.ts';

const WIND_SPEED = 10;
const SIDE_SECONDS = 120;
const RECORDED_SECONDS = 30;

/** A custom 2-minute cassette with 30 s recorded on side A and markers at 0 s and 20 s. */
async function testCassette(codec = 'aac-lc'): Promise<CassetteFile> {
  const manifest = minimalManifest();
  manifest.cassette['type'] = 'custom';
  manifest.cassette['side_length_seconds'] = SIDE_SECONDS;
  manifest.sides['A'] = recordedSide(RECORDED_SECONDS, {
    markers: [
      { frame: 0, title: 'Intro' },
      { frame: 20 * 44100, title: 'Song' },
    ],
  });
  (manifest.sides['A']['audio'] as Record<string, unknown>)['codec'] = codec;
  return CassetteFile.open(
    await cassetteBlob(manifest, [{ name: 'audio/side-a.m4a', data: 'fake aac data' }]),
  );
}

describe('Deck', () => {
  let output: FakeOutput;
  let positions: MemoryPositionStore;
  let deck: Deck;

  /** Advance fake time and let pending promises settle. */
  const advance = async (seconds: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    output = new FakeOutput();
    positions = new MemoryPositionStore();
    deck = new Deck({ output, positions, clock: () => Date.now() / 1000, windSpeed: WIND_SPEED });
    await deck.insert(await testCassette());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a new cassette stopped at the beginning of side A', () => {
    expect(deck).toMatchObject({ side: 'A', mode: Mode.Stopped, head: 0, sideSeconds: SIDE_SECONDS });
    expect(output.loaded?.type).toBe('audio/mp4');
  });

  it('plays from the head at real time', async () => {
    await deck.play();
    expect(output.calls).toContain('play:0.0');
    expect(deck.mode).toBe(Mode.Playing);

    await advance(21);
    expect(deck.head).toBeCloseTo(21);
    expect(deck.currentMarker?.title).toBe('Song');
  });

  it('cuts the sound at recorded_frames and runs on through blank tape (§5.5, §7.3)', async () => {
    await deck.play();
    output.calls.length = 0;

    await advance(RECORDED_SECONDS + 1);
    expect(output.calls).toEqual(['pause']);
    expect(deck.mode).toBe(Mode.Playing);
    expect(deck.onBlankTape).toBe(true);
  });

  it('stops at the end of the side (§7.5)', async () => {
    await deck.play();
    await advance(SIDE_SECONDS + 1);
    expect(deck).toMatchObject({ mode: Mode.Stopped, head: SIDE_SECONDS });

    await deck.play();
    expect(deck.mode).toBe(Mode.Stopped);
  });

  it('winds at the wind speed and stops at either end', async () => {
    deck.fastForward();
    expect(deck.mode).toBe(Mode.FastForward);
    await advance(5);
    expect(deck.head).toBeCloseTo(5 * WIND_SPEED);

    await advance(SIDE_SECONDS);
    expect(deck).toMatchObject({ mode: Mode.Stopped, head: SIDE_SECONDS });

    deck.rewind();
    await advance(SIDE_SECONDS);
    expect(deck).toMatchObject({ mode: Mode.Stopped, head: 0 });
  });

  it('cues a position by winding to it, not by jumping (§7.4)', async () => {
    deck.cue(20);
    expect(deck.mode).toBe(Mode.FastForward);
    expect(deck.head).toBe(0);

    await advance(2);
    expect(deck).toMatchObject({ mode: Mode.Stopped, head: 20 });
  });

  it('flips the tape: position p becomes L − p (§5.4)', async () => {
    deck.cue(20);
    await advance(2);
    await deck.flip();

    expect(deck).toMatchObject({ side: 'B', head: SIDE_SECONDS - 20 });
    expect(output.calls.at(-1)).toBe('load:null');
  });

  it('remembers side and position per cassette (§14)', async () => {
    await deck.flip();
    deck.eject();

    const again = new Deck({ output, positions, clock: () => Date.now() / 1000 });
    await again.insert(await testCassette());
    expect(again).toMatchObject({ side: 'B', head: SIDE_SECONDS });
  });

  it('obeys the last command when audio starts slowly', async () => {
    output.holdPlay = true;
    const playing = deck.play();
    await advance(0);
    deck.stop();
    output.release();
    await playing;

    expect(deck.mode).toBe(Mode.Stopped);
    expect(output.calls.at(-1)).toBe('pause');
  });

  it('reports a side it cannot play instead of playing it (§7.3)', async () => {
    output.playable = false;
    const errors: DeckError[] = [];
    deck.on('error', (error) => errors.push(error));

    await deck.play();

    expect(deck.mode).toBe(Mode.Stopped);
    expect(errors.map((error) => error.code)).toEqual([DeckErrorCode.Unplayable]);
  });

  it('marks unknown codecs as unplayable', async () => {
    await deck.insert(await testCassette('opus'));
    expect(deck.isPlayable('A')).toBe(false);
    expect(deck.isPlayable('B')).toBe(true);
  });

  it('notifies listeners of every change', async () => {
    const listener = vi.fn();
    const unsubscribe = deck.on('change', listener);

    await deck.play();
    deck.stop();
    unsubscribe();
    deck.fastForward();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('advances the tape counter with the take-up reel', async () => {
    expect(deck.counter).toBe('000');
    deck.fastForward();
    await advance(SIDE_SECONDS);
    expect(Number(deck.counter)).toBeGreaterThan(0);
  });
});
