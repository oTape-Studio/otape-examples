/**
 * The position of the tape head on one side.
 *
 * The head moves continuously while the tape runs, so its position is not
 * stored on every frame. Instead the head remembers where it was at one
 * moment (the anchor) and how fast it moves, and computes the position on
 * demand. Changing the speed re-anchors it at the current position.
 *
 * Positions are in seconds from the start of the side, clamped to the side.
 *
 * @module tape-head
 */

/** @returns {number} the current time in seconds */
const defaultClock = () => performance.now() / 1000;

export class TapeHead {
  #length = 0;
  #speed = 0;
  #anchorPosition = 0;
  #anchorTime = 0;
  #clock;

  /**
   * @param {() => number} [clock]  current time in seconds; injectable for tests
   */
  constructor(clock = defaultClock) {
    this.#clock = clock;
  }

  /** Length of the side in seconds. */
  get length() {
    return this.#length;
  }

  /** Seconds of tape per second: 1 when playing, 0 when stopped, negative backwards. */
  get speed() {
    return this.#speed;
  }

  /** Current position in seconds. */
  get position() {
    const elapsed = this.#clock() - this.#anchorTime;
    return clamp(this.#anchorPosition + elapsed * this.#speed, 0, this.#length);
  }

  /** Seconds until the head reaches the end it is moving towards. */
  get secondsToEnd() {
    if (this.#speed === 0) return Infinity;
    const target = this.#speed > 0 ? this.#length : 0;
    return Math.abs(target - this.position) / Math.abs(this.#speed);
  }

  /**
   * Put a new side under the head. The head stops.
   *
   * @param {number} length    side length in seconds
   * @param {number} position  starting position in seconds
   */
  load(length, position = 0) {
    this.#length = length;
    this.#speed = 0;
    this.#anchor(position);
  }

  /** @param {number} speed  seconds of tape per second */
  setSpeed(speed) {
    this.#anchor(this.position);
    this.#speed = speed;
  }

  /** @param {number} position  seconds from the start of the side */
  moveTo(position) {
    this.#anchor(position);
  }

  #anchor(position) {
    this.#anchorPosition = clamp(position, 0, this.#length);
    this.#anchorTime = this.#clock();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
