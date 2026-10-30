import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { Mode, Player, PlayerEvent, PositionStore, Side } from '../src/index.js';
import { FakeOutput, MemoryStorage, sampleCassette } from './helpers/fixtures.js';

describe('Player', () => {
  let output;
  let storage;
  let player;

  beforeEach(async () => {
    output = new FakeOutput();
    storage = new MemoryStorage();
    player = new Player({ output, positions: new PositionStore(storage) });
    await player.load(await sampleCassette());
  });

  afterEach(() => player.eject());

  it('starts a new cassette at the beginning of side A', () => {
    assert.equal(player.side, Side.A);
    assert.equal(player.head, 0);
    assert.equal(player.mode, Mode.STOP);
  });

  it('plays the recording up to recorded_frames', () => {
    player.play();
    assert.equal(player.mode, Mode.PLAY);
    assert.deepEqual(output.calls.at(-1), { method: 'play', offset: 0, duration: 6 });
  });

  it('flips the tape: position p becomes L − p (§5.4)', () => {
    player.flip();
    assert.equal(player.side, Side.B);
    assert.equal(player.head, 1380);

    player.flip();
    assert.equal(player.side, Side.A);
    assert.equal(player.head, 0);
  });

  it('does not play at the end of a side (§7.5)', () => {
    player.flip();   // the start of A is the end of B
    player.play();
    assert.equal(player.mode, Mode.STOP);
    assert.equal(output.calls.some((call) => call.method === 'play'), false);
  });

  it('runs blank tape in silence (§5.5)', () => {
    player.flip();
    player.rewind();
    player.stop();   // somewhere on side B, which is blank
    player.play();
    assert.equal(player.mode, Mode.PLAY);
    assert.equal(player.onBlankTape, true);
    assert.equal(output.calls.some((call) => call.method === 'play'), false);
  });

  it('remembers side and position per cassette (§14)', async () => {
    player.flip();
    player.stop();

    const again = new Player({ output, positions: new PositionStore(storage) });
    await again.load(await sampleCassette());
    assert.equal(again.side, Side.B);
    assert.equal(again.head, 1380);
  });

  it('announces changes', () => {
    let changes = 0;
    player.addEventListener(PlayerEvent.CHANGE, () => changes++);
    player.play();
    player.stop();
    assert.equal(changes, 2);
  });

  it('keeps the current cassette when a new one fails to open', async () => {
    await assert.rejects(player.load(new ArrayBuffer(4)));
    assert.equal(player.cassette.title, 'Test Tones');
  });
});
