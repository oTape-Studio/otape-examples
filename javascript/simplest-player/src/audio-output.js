/**
 * The sound card: decoding and playing audio with the Web Audio API.
 *
 * Kept apart from the player so the tape logic can be tested without audio,
 * and so another output (a <audio> element, a native bridge) can replace it.
 *
 * @module audio-output
 */

const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;

export class AudioOutput {
  /** @type {AudioContext | null} */
  #context = null;
  /** @type {AudioBufferSourceNode | null} */
  #source = null;

  /**
   * Created on first use. Browsers only let it make sound after a user
   * gesture, so it is resumed on every play().
   */
  get context() {
    this.#context ??= new AudioContextClass();
    return this.#context;
  }

  /**
   * Decode compressed audio. The AudioContext also resamples it to its own
   * rate, which covers the resampling rule of §7.3.
   *
   * @param {Uint8Array} bytes
   * @returns {Promise<AudioBuffer>}
   */
  decode(bytes) {
    // decodeAudioData takes ownership of the buffer it gets, so pass a copy.
    return this.context.decodeAudioData(bytes.slice().buffer);
  }

  /**
   * Play part of a buffer, replacing whatever is playing.
   *
   * @param {AudioBuffer} buffer
   * @param {number} offset    where to start, in seconds
   * @param {number} duration  how long to play, in seconds
   */
  play(buffer, offset, duration) {
    this.stop();
    if (this.context.state === 'suspended') this.context.resume();

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0, offset, duration);
    this.#source = source;
  }

  /** Silence the output. */
  stop() {
    if (!this.#source) return;
    this.#source.stop();
    this.#source.disconnect();
    this.#source = null;
  }
}
