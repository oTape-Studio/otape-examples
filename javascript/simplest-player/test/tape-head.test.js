import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { TapeHead } from '../src/index.js';

describe('TapeHead', () => {
  let now;
  let head;

  beforeEach(() => {
    now = 0;
    head = new TapeHead(() => now);
    head.load(100, 10);
  });

  it('stands still when stopped', () => {
    now = 5;
    assert.equal(head.position, 10);
  });

  it('moves at its speed', () => {
    head.setSpeed(1);
    now = 5;
    assert.equal(head.position, 15);

    head.setSpeed(-20);
    now = 5.5;
    assert.equal(head.position, 5);
  });

  it('stops at both ends of the side', () => {
    head.setSpeed(20);
    now = 60;
    assert.equal(head.position, 100);

    head.setSpeed(-20);
    now = 120;
    assert.equal(head.position, 0);
  });

  it('knows how long until the end it moves towards', () => {
    assert.equal(head.secondsToEnd, Infinity);
    head.setSpeed(1);
    assert.equal(head.secondsToEnd, 90);
    head.setSpeed(-20);
    assert.equal(head.secondsToEnd, 0.5);
  });
});
