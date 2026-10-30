/**
 * Conversions between timeline frames and seconds, and time display.
 *
 * oTAPE stores every position as an integer frame on the cassette's timeline
 * (§5.3). The player works in seconds, because that is what the Web Audio
 * API uses; frames are converted once when a cassette is opened, and back
 * when a position is saved.
 *
 * @module time
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/**
 * @param {number} frames
 * @param {number} rate  timeline frames per second
 */
export function framesToSeconds(frames, rate) {
  return frames / rate;
}

/**
 * @param {number} seconds
 * @param {number} rate  timeline frames per second
 */
export function secondsToFrames(seconds, rate) {
  return Math.round(seconds * rate);
}

/**
 * Format seconds like a deck's time display: `m:ss`, or `h:mm:ss` from one
 * hour on.
 *
 * @param {number} seconds
 */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = String(total % SECONDS_PER_MINUTE).padStart(2, '0');

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${minutes}:${secs}`;
}
