/**
 * Parsing and validating `manifest.json` (§6, §16.1).
 *
 * Validation covers what a conforming reader MUST reject. Optional keys
 * (appearance, jcard, artwork, history, …) are not checked: a player that
 * doesn't use them simply ignores them (§15.2).
 *
 * All functions here are pure: they take data and either return or throw an
 * {@link OTapeError}. That keeps them easy to test without a browser.
 *
 * @module manifest
 */

import {
  CassetteType,
  CUSTOM_SIDE_SECONDS,
  DEFAULT_TIMELINE_RATE,
  FORMAT_NAME,
  MANIFEST_MAX_BYTES,
  RESERVED_PATHS,
  RIGHTS_FILE_EXTENSIONS,
  SIDES,
  STANDARD_SIDE_SECONDS,
  SUPPORTED_MAJOR_VERSION,
  TIMELINE_RATES,
  WriteProtect,
} from './constants.js';
import { ErrorCode, OTapeError } from './errors.js';

/** RFC 4122 UUID, any case (§5.2). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "MAJOR.MINOR" (§15.1). */
const VERSION_PATTERN = /^(\d+)\.(\d+)$/;

const WRITE_PROTECT_STATES = Object.freeze(Object.values(WriteProtect));

/**
 * Decode and parse manifest bytes.
 *
 * @param {Uint8Array} bytes
 * @returns {object}
 * @throws {OTapeError}
 */
export function parseManifest(bytes) {
  if (bytes.byteLength > MANIFEST_MAX_BYTES) throw new OTapeError(ErrorCode.MANIFEST_TOO_LARGE);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new OTapeError(ErrorCode.MANIFEST_NOT_JSON);
  }
}

/**
 * Check everything a player relies on (§16.1, Appendix C).
 *
 * @param {object} manifest
 * @param {(path: string) => boolean} hasEntry  whether the archive holds a path
 * @throws {OTapeError} naming the first rule the manifest breaks
 */
export function validateManifest(manifest, hasEntry) {
  if (!isPlainObject(manifest)) throw new OTapeError(ErrorCode.MANIFEST_NOT_OBJECT);
  if (manifest.format !== FORMAT_NAME) throw new OTapeError(ErrorCode.NOT_OTAPE);
  validateVersion(manifest.format_version);
  validateCassette(manifest.cassette);
  validateSides(manifest.sides, sideLengthInFrames(manifest.cassette), hasEntry);
}

/**
 * The cassette's timeline rate, with the default applied (§5.3).
 *
 * @param {object} cassette  the manifest's `cassette` object
 */
export function timelineRate(cassette) {
  return cassette.timeline_rate ?? DEFAULT_TIMELINE_RATE;
}

/**
 * A side is blank when `audio` is missing, `null`, or has no recorded
 * frames (§7.1, §7.2).
 *
 * @param {object | null | undefined} audio
 */
export function isBlank(audio) {
  return audio == null || audio.recorded_frames === 0;
}

/**
 * Whether a manifest path stays inside the archive (§3.3, §17).
 *
 * @param {unknown} path
 */
export function isSafePath(path) {
  if (typeof path !== 'string' || path === '') return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  if (RESERVED_PATHS.includes(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/* ----- rules ----- */

/** Any 1.x is readable; another major version may mean something else (§15.1). */
function validateVersion(version) {
  const match = VERSION_PATTERN.exec(version ?? '');
  if (!match) throw new OTapeError(ErrorCode.VERSION_INVALID);
  if (Number(match[1]) !== SUPPORTED_MAJOR_VERSION) {
    throw new OTapeError(ErrorCode.VERSION_UNSUPPORTED, { version });
  }
}

function validateCassette(cassette) {
  if (!isPlainObject(cassette)) throw new OTapeError(ErrorCode.CASSETTE_MISSING);
  if (!UUID_PATTERN.test(cassette.id ?? '')) throw new OTapeError(ErrorCode.ID_INVALID);
  if (typeof cassette.created_at !== 'string') throw new OTapeError(ErrorCode.CREATED_AT_MISSING);
  validateSideLength(cassette.type, cassette.side_length_seconds);

  if (!TIMELINE_RATES.includes(timelineRate(cassette))) {
    throw new OTapeError(ErrorCode.TIMELINE_RATE_INVALID, { allowed: TIMELINE_RATES });
  }
  validateRightsFile(cassette.rights?.file);
}

/** The licence file is shown to users, so it must never be HTML (§6.4, §17). */
function validateRightsFile(path) {
  if (path === undefined) return;
  const allowedType = RIGHTS_FILE_EXTENSIONS.some((extension) => String(path).toLowerCase().endsWith(extension));
  if (!isSafePath(path) || !allowedType) throw new OTapeError(ErrorCode.RIGHTS_FILE_INVALID);
}

/** The type fixes the side length; a mismatch MUST be rejected (§5.1). */
function validateSideLength(type, seconds) {
  if (!Number.isInteger(seconds)) throw new OTapeError(ErrorCode.SIDE_LENGTH_NOT_INTEGER);

  if (Object.hasOwn(STANDARD_SIDE_SECONDS, type)) {
    const expected = STANDARD_SIDE_SECONDS[type];
    if (seconds !== expected) throw new OTapeError(ErrorCode.SIDE_LENGTH_MISMATCH, { type, expected });
    return;
  }

  if (type === CassetteType.CUSTOM) {
    const { MIN: min, MAX: max } = CUSTOM_SIDE_SECONDS;
    if (seconds < min || seconds > max) throw new OTapeError(ErrorCode.CUSTOM_LENGTH_OUT_OF_RANGE, { min, max });
    return;
  }

  throw new OTapeError(ErrorCode.TYPE_UNKNOWN, { type });
}

function validateSides(sides, sideFrames, hasEntry) {
  if (!isPlainObject(sides)) throw new OTapeError(ErrorCode.SIDES_MISSING);
  for (const side of SIDES) validateSide(side, sides[side], sideFrames, hasEntry);
}

function validateSide(side, data, sideFrames, hasEntry) {
  if (!isPlainObject(data)) throw new OTapeError(ErrorCode.SIDE_MISSING, { side });
  if (!WRITE_PROTECT_STATES.includes(data.write_protect)) {
    throw new OTapeError(ErrorCode.WRITE_PROTECT_INVALID, { side });
  }

  const { audio } = data;
  if (isBlank(audio)) return;

  if (!isSafePath(audio.file)) throw new OTapeError(ErrorCode.AUDIO_PATH_UNSAFE, { side });
  if (!hasEntry(audio.file)) throw new OTapeError(ErrorCode.AUDIO_FILE_MISSING, { side, path: audio.file });

  const frames = audio.recorded_frames;
  if (!Number.isInteger(frames) || frames < 0) throw new OTapeError(ErrorCode.RECORDED_FRAMES_INVALID, { side });
  if (frames > sideFrames) throw new OTapeError(ErrorCode.RECORDED_FRAMES_TOO_LONG, { side });
}

/* ----- helpers ----- */

function sideLengthInFrames(cassette) {
  return cassette.side_length_seconds * timelineRate(cassette);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
