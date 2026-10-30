/**
 * Frames, seconds and how time is shown.
 *
 * oTAPE stores positions as integer frames on the cassette's timeline (§5.3).
 * The player works in seconds, the unit of every browser media API.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export function framesToSeconds(frames: number, rate: number): number {
  return frames / rate;
}

export function secondsToFrames(seconds: number, rate: number): number {
  return Math.round(seconds * rate);
}

/** `m:ss`, or `h:mm:ss` from one hour on. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = pad(total % SECONDS_PER_MINUTE);
  return hours > 0 ? `${hours}:${pad(minutes)}:${secs}` : `${minutes}:${secs}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
