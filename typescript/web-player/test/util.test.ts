import { describe, expect, it } from 'vitest';
import { WebStoragePositionStore } from '../src/deck/position-store.ts';
import { parseColor, toCss } from '../src/util/color.ts';
import { formatTime, framesToSeconds, secondsToFrames } from '../src/util/time.ts';

describe('time', () => {
  it('converts between timeline frames and seconds (§5.3)', () => {
    expect(framesToSeconds(132300, 44100)).toBe(3);
    expect(secondsToFrames(3, 48000)).toBe(144000);
  });

  it('formats like a deck display', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(-4)).toBe('0:00');
  });
});

describe('colour (§10.2)', () => {
  it('reads #RRGGBB and #RRGGBBAA', () => {
    expect(parseColor('#3A3F478C', '#000000')).toEqual({ hex: '#3a3f47', alpha: 0x8c / 255 });
    expect(parseColor('#FFFFFF', '#000000')).toEqual({ hex: '#ffffff', alpha: 1 });
  });

  it('falls back on anything else', () => {
    expect(parseColor('purple', '#1B1B1D')).toEqual({ hex: '#1b1b1d', alpha: 1 });
    expect(parseColor(undefined, '#1B1B1D').hex).toBe('#1b1b1d');
  });

  it('writes CSS with alpha and extra opacity', () => {
    expect(toCss(parseColor('#FF000080', '#000'), 0.5)).toBe('rgb(255 0 0 / 0.251)');
  });
});

describe('WebStoragePositionStore (§14)', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';

  it('saves and loads positions in Web Storage', () => {
    const store = new WebStoragePositionStore(localStorage);
    store.save(id, { side: 'B', frame: 44100 });
    expect(new WebStoragePositionStore(localStorage).load(id)).toEqual({ side: 'B', frame: 44100 });
  });

  it('ignores damaged values', () => {
    localStorage.setItem(`otape:position:${id}`, '{"side":"C","frame":1}');
    expect(new WebStoragePositionStore(localStorage).load(id)).toBeNull();
    localStorage.setItem(`otape:position:${id}`, '{nope');
    expect(new WebStoragePositionStore(localStorage).load(id)).toBeNull();
  });

  it('works without storage', () => {
    const store = new WebStoragePositionStore(null);
    store.save(id, { side: 'A', frame: 0 });
    expect(store.load(id)).toBeNull();
  });
});
