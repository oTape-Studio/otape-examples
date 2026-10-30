// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { TapeHead } from '../../src/deck/tape-head.ts';

describe('TapeHead', () => {
  let now: number;
  let head: TapeHead;

  beforeEach(() => {
    now = 0;
    head = new TapeHead(() => now);
    head.load(100, 10);
  });

  it('stands still when stopped', () => {
    now = 5;
    expect(head.position).toBe(10);
  });

  it('moves at its speed and re-anchors when the speed changes', () => {
    head.setSpeed(1);
    now = 5;
    expect(head.position).toBe(15);

    head.setSpeed(-20);
    now = 5.5;
    expect(head.position).toBe(5);
  });

  it('stops at both ends of the side', () => {
    head.setSpeed(20);
    now = 60;
    expect(head.position).toBe(100);

    head.setSpeed(-20);
    now = 120;
    expect(head.position).toBe(0);
  });

  it('knows when it will reach a position', () => {
    expect(head.secondsUntil(50)).toBe(Infinity);
    head.setSpeed(2);
    expect(head.secondsUntil(50)).toBe(20);
    expect(head.secondsUntil(0)).toBe(Infinity);
    expect(head.secondsUntil(10)).toBe(0);
  });
});
