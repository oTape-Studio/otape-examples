/**
 * Opening an .otape file and turning its manifest into a cassette model.
 *
 * The model is what the player works with: seconds instead of frames,
 * defaults applied, markers sorted, and audio already decoded. The original
 * manifest stays available, untouched, as `cassette.manifest`.
 *
 * @module cassette
 */

import {
  CassetteType,
  DEFAULT_MARKER_KIND,
  MANIFEST_MAX_BYTES,
  MANIFEST_PATH,
  MarkerKind,
  SIDES,
  UNKNOWN_MARKER_KIND,
} from './constants.js';
import { ErrorCode, OTapeError } from './errors.js';
import { isBlank, parseManifest, timelineRate, validateManifest } from './manifest.js';
import { framesToSeconds } from './time.js';
import { ZipArchive } from './zip-archive.js';

const UNTITLED = 'Untitled cassette';

const MARKER_KINDS = Object.freeze(Object.values(MarkerKind));

/**
 * @typedef {object} Marker
 * @property {string} title
 * @property {string} kind      one of MarkerKind
 * @property {number} seconds   position on the side
 */

/**
 * @typedef {object} CassetteSide
 * @property {string} letter            'A' or 'B'
 * @property {string} title
 * @property {string} writeProtect      one of WriteProtect
 * @property {string | null} codec
 * @property {number} recordedSeconds   0 for a blank side
 * @property {Marker[]} markers         sorted by position
 * @property {AudioBuffer | null} buffer  decoded audio, if any
 * @property {boolean} playable         false if the codec could not be decoded
 */

/**
 * @typedef {object} Cassette
 * @property {object} manifest       the parsed manifest.json
 * @property {string} id             cassette.id
 * @property {string} title
 * @property {string} creator
 * @property {string} typeLabel      e.g. "C60", or "C74" for a custom length
 * @property {number} rate           timeline frames per second
 * @property {number} sideSeconds    length of one side
 * @property {Record<string, CassetteSide>} sides  keyed by 'A' and 'B'
 */

/**
 * Decodes compressed audio into an AudioBuffer.
 *
 * @callback AudioDecoder
 * @param {Uint8Array} bytes
 * @returns {Promise<AudioBuffer>}
 */

/**
 * Open a cassette, following the steps of Appendix C.
 *
 * @param {ArrayBuffer} buffer        the bytes of an .otape file
 * @param {AudioDecoder} decodeAudio
 * @returns {Promise<Cassette>}
 * @throws {OTapeError} if the file is not a valid cassette
 */
export async function openCassette(buffer, decodeAudio) {
  const archive = new ZipArchive(buffer);
  const manifest = await readManifest(archive);

  // The `mimetype` entry is informative only: readers SHOULD NOT reject a
  // file without it (§3.2), so it is not checked here.
  validateManifest(manifest, (path) => archive.has(path));

  const cassette = describeCassette(manifest);
  const sides = {};
  for (const letter of SIDES) {
    const side = cassette.sides[letter];
    const audio = manifest.sides[letter].audio;
    sides[letter] = Object.freeze({ ...side, ...(await decodeSide(archive, audio, decodeAudio)) });
  }
  return Object.freeze({ ...cassette, sides: Object.freeze(sides) });
}

/**
 * Build the cassette model from a valid manifest, without audio.
 *
 * @param {object} manifest
 * @returns {Cassette}
 */
export function describeCassette(manifest) {
  const { cassette } = manifest;
  const rate = timelineRate(cassette);

  const sides = {};
  for (const letter of SIDES) sides[letter] = describeSide(letter, manifest.sides[letter], rate);

  return {
    manifest,
    id: cassette.id,
    title: cassette.title || UNTITLED,
    creator: cassette.creator ?? '',
    typeLabel: typeLabel(cassette.type, cassette.side_length_seconds),
    rate,
    sideSeconds: cassette.side_length_seconds,
    sides,
  };
}

/**
 * The label printed on the cassette. A custom cassette is named after its
 * total length in minutes, e.g. 37 minutes per side is "C74" (§5.1).
 *
 * @param {string} type
 * @param {number} sideSeconds
 */
export function typeLabel(type, sideSeconds) {
  if (type !== CassetteType.CUSTOM) return type;
  return `C${Math.round((2 * sideSeconds) / 60)}`;
}

/**
 * The marker at or just before a position, e.g. the song playing (§7.4).
 *
 * @param {Marker[]} markers  sorted by position
 * @param {number} seconds
 * @returns {Marker | null}
 */
export function markerAt(markers, seconds) {
  return markers.findLast((marker) => marker.seconds <= seconds) ?? null;
}

/* ----- helpers ----- */

async function readManifest(archive) {
  if (!archive.has(MANIFEST_PATH)) throw new OTapeError(ErrorCode.MANIFEST_MISSING);
  // Check the declared size before inflating anything (§3.5, §17).
  if (archive.entry(MANIFEST_PATH).size > MANIFEST_MAX_BYTES) throw new OTapeError(ErrorCode.MANIFEST_TOO_LARGE);
  return parseManifest(await archive.read(MANIFEST_PATH));
}

/** @returns {Omit<CassetteSide, 'buffer' | 'playable'>} */
function describeSide(letter, side, rate) {
  const { audio } = side;
  const recorded = !isBlank(audio);
  return {
    letter,
    title: side.title ?? '',
    writeProtect: side.write_protect,
    codec: recorded ? audio.codec : null,
    recordedSeconds: recorded ? framesToSeconds(audio.recorded_frames, rate) : 0,
    markers: describeMarkers(side.markers, rate),
  };
}

/** Keep well-formed markers, in seconds, sorted by position (§7.4). */
function describeMarkers(markers, rate) {
  if (!Array.isArray(markers)) return [];
  return markers
    .filter((marker) => Number.isInteger(marker?.frame) && typeof marker.title === 'string')
    .map((marker) => Object.freeze({
      title: marker.title,
      kind: markerKind(marker.kind),
      seconds: framesToSeconds(marker.frame, rate),
    }))
    .sort((a, b) => a.seconds - b.seconds);
}

/** Missing kind means `track`; unknown kinds are treated as `note` (§7.4). */
function markerKind(kind) {
  if (kind == null) return DEFAULT_MARKER_KIND;
  return MARKER_KINDS.includes(kind) ? kind : UNKNOWN_MARKER_KIND;
}

/**
 * Decode a side's audio. An optional codec the platform can't decode must
 * not stop the cassette from opening: the side is reported as unplayable
 * instead (§7.3).
 *
 * @returns {Promise<{ buffer: AudioBuffer | null, playable: boolean }>}
 */
async function decodeSide(archive, audio, decodeAudio) {
  if (isBlank(audio)) return { buffer: null, playable: true };
  try {
    const buffer = await decodeAudio(await archive.read(audio.file));
    return { buffer, playable: true };
  } catch {
    return { buffer: null, playable: false };
  }
}
