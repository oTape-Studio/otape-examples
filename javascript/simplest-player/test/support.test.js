import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatTime, framesToSeconds, PositionStore, secondsToFrames } from '../src/index.js';
import { MemoryStorage } from './helpers/fixtures.js';

describe('time', () => {
  it('converts between frames and seconds', () => {
    assert.equal(framesToSeconds(132300, 44100), 3);
    assert.equal(secondsToFrames(3, 48000), 144000);
  });

  it('formats like a deck display', () => {
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(65.9), '1:05');
    assert.equal(formatTime(3725), '1:02:05');
  });
});

describe('PositionStore', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';

  it('saves and loads a position', () => {
    const store = new PositionStore(new MemoryStorage());
    store.save(id, { side: 'B', frame: 44100 });
    assert.deepEqual(store.load(id), { side: 'B', frame: 44100 });
  });

  it('ignores damaged values', () => {
    const storage = new MemoryStorage();
    storage.setItem(`otape:position:${id}`, '{"side":"C","frame":1}');
    assert.equal(new PositionStore(storage).load(id), null);
  });

  it('works without storage', () => {
    const store = new PositionStore(null);
    store.save(id, { side: 'A', frame: 0 });
    assert.equal(store.load(id), null);
  });
});
