/**
 * Values defined by the oTAPE 1.0 specification, plus the few tuning values
 * of this player. Every enum is a frozen object, so a typo in a key fails
 * loudly instead of silently producing `undefined`.
 *
 * @module constants
 */

/* -------------------------------------------------------------------------
 * Container and manifest (§3, §6, §15)
 * ---------------------------------------------------------------------- */

/** Content of the `mimetype` entry (§3.2). */
export const MIMETYPE = 'application/vnd.otape.cassette';

/** Value of the manifest's `format` key (§6.1). */
export const FORMAT_NAME = 'oTAPE';

/** The major `format_version` this player understands (§15.1). */
export const SUPPORTED_MAJOR_VERSION = 1;

/** Archive path of the manifest (§3.4). */
export const MANIFEST_PATH = 'manifest.json';

/** Archive path of the media-type entry (§3.2). */
export const MIMETYPE_PATH = 'mimetype';

/** Paths a manifest must never point at (§3.3). */
export const RESERVED_PATHS = Object.freeze([MIMETYPE_PATH, MANIFEST_PATH]);

/** File extensions allowed for `cassette.rights.file`: plain text or Markdown, never HTML (§6.4). */
export const RIGHTS_FILE_EXTENSIONS = Object.freeze(['.txt', '.md']);

/** Upper limit for `manifest.json` (§3.5). */
export const MANIFEST_MAX_BYTES = 1024 * 1024;

/* -------------------------------------------------------------------------
 * Cassette model (§5)
 * ---------------------------------------------------------------------- */

/** The two sides of a tape. Side keys are uppercase everywhere (§6.1). */
export const Side = Object.freeze({
  A: 'A',
  B: 'B',
});

/** Both sides, in order. */
export const SIDES = Object.freeze([Side.A, Side.B]);

/** Values of `cassette.type` (§5.1). */
export const CassetteType = Object.freeze({
  C46: 'C46',
  C60: 'C60',
  C90: 'C90',
  C120: 'C120',
  CUSTOM: 'custom',
});

/** Side length in seconds fixed by each standard type (§5.1). */
export const STANDARD_SIDE_SECONDS = Object.freeze({
  [CassetteType.C46]: 1380,
  [CassetteType.C60]: 1800,
  [CassetteType.C90]: 2700,
  [CassetteType.C120]: 3600,
});

/** Allowed side length of a `custom` cassette, in seconds (§5.1). */
export const CUSTOM_SIDE_SECONDS = Object.freeze({ MIN: 1, MAX: 5400 });

/** Allowed values of `cassette.timeline_rate`, frames per second (§5.3). */
export const TIMELINE_RATES = Object.freeze([44100, 48000]);

/** `timeline_rate` when the key is absent (§5.3). */
export const DEFAULT_TIMELINE_RATE = 44100;

/** Record-tab states of a side (§8.1). */
export const WriteProtect = Object.freeze({
  INTACT: 'intact',
  BROKEN: 'broken',
  TAPED_OVER: 'taped_over',
});

/** Audio codecs defined in 1.0 (§7.3). Only `aac-lc` is required. */
export const Codec = Object.freeze({
  AAC_LC: 'aac-lc',
  ALAC: 'alac',
  FLAC: 'flac',
  PCM: 'pcm',
});

/** Kinds of track marker (§7.4). */
export const MarkerKind = Object.freeze({
  TRACK: 'track',
  VOICE: 'voice',
  NOTE: 'note',
});

/** Kind of a marker without `kind` (§7.4). */
export const DEFAULT_MARKER_KIND = MarkerKind.TRACK;

/** Kind used for a `kind` this player doesn't know (§7.4). */
export const UNKNOWN_MARKER_KIND = MarkerKind.NOTE;

/* -------------------------------------------------------------------------
 * Player
 * ---------------------------------------------------------------------- */

/** What the deck is doing. */
export const Mode = Object.freeze({
  STOP: 'stop',
  PLAY: 'play',
  FAST_FORWARD: 'ff',
  REWIND: 'rew',
});

/**
 * How many times faster than real time the tape winds (§7.5). A real deck
 * winds a C60 side in 1 to 2 minutes, which is roughly 15× to 30×.
 */
export const WIND_SPEED = 20;

/** Tape speed of each mode, in seconds of tape per second. */
export const TAPE_SPEED = Object.freeze({
  [Mode.STOP]: 0,
  [Mode.PLAY]: 1,
  [Mode.FAST_FORWARD]: WIND_SPEED,
  [Mode.REWIND]: -WIND_SPEED,
});

/** Events dispatched by the Player. */
export const PlayerEvent = Object.freeze({
  /** The cassette, side or mode changed. The head position is polled instead. */
  CHANGE: 'change',
});
