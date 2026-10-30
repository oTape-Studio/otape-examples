/**
 * The position of the tape head on one side.
 *
 * The head moves continuously while the tape runs, so its position is not
 * updated on every frame. It remembers where it was at one moment (the
 * anchor) and how fast it moves, and computes the position when asked.
 * Changing the speed re-anchors it at the current position.
 *
 * Positions are seconds from the start of the side, clamped to the side.
 */

import { clamp } from '../util/time.ts';

/** Current time in seconds. Injectable so tests control time. */
export type Clock = () => number;

export const performanceClock: Clock = () => performance.now() / 1000;

export class TapeHead {
  #length = 0;
  #speed = 0;
  #anchorPosition = 0;
  #anchorTime = 0;
  readonly #clock: Clock;

  constructor(clock: Clock = performanceClock) {
    this.#clock = clock;
  }

  /** Length of the side in seconds. */
  get length(): number {
    return this.#length;
  }

  /** Seconds of tape per second: 1 playing, 0 stopped, negative when rewinding. */
  get speed(): number {
    return this.#speed;
  }

  get position(): number {
    const elapsed = this.#clock() - this.#anchorTime;
    return clamp(this.#anchorPosition + elapsed * this.#speed, 0, this.#length);
  }

  /** Seconds until the head reaches `target`, or `Infinity` if it is not moving towards it. */
  secondsUntil(target: number): number {
    const distance = target - this.position;
    if (distance === 0) return 0;
    if (this.#speed === 0 || Math.sign(distance) !== Math.sign(this.#speed)) return Infinity;
    return distance / this.#speed;
  }

  /** Put a new side under the head. The head stops. */
  load(length: number, position = 0): void {
    this.#length = length;
    this.#speed = 0;
    this.#anchor(position);
  }

  setSpeed(speed: number): void {
    this.#anchor(this.position);
    this.#speed = speed;
  }

  moveTo(position: number): void {
    this.#anchor(position);
  }

  #anchor(position: number): void {
    this.#anchorPosition = clamp(position, 0, this.#length);
    this.#anchorTime = this.#clock();
  }
}
