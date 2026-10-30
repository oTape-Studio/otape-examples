/**
 * Values defined by the oTAPE 1.0 specification.
 *
 * Enumerations are `as const` objects with a type of the same name, so they
 * work both as values (`Side.A`) and as types (`side: Side`).
 */

/* -------------------------------------------------------------------------- */
/* Identification and container (§3, §4)                                      */
/* -------------------------------------------------------------------------- */

/** Media type, also the content of the `mimetype` entry (§3.2, §4). */
export const MEDIA_TYPE = 'application/vnd.otape.cassette';

/** File extension (§4). */
export const FILE_EXTENSION = '.otape';

/** Value of the manifest's `format` key (§6.1). */
export const FORMAT_NAME = 'oTAPE';

/** The major `format_version` this implementation reads (§15.1). */
export const SUPPORTED_MAJOR_VERSION = 1;

export const MANIFEST_PATH = 'manifest.json';
export const MIMETYPE_PATH = 'mimetype';

/** Limits of §3.5. */
export const Limits = {
  MANIFEST_BYTES: 1024 * 1024,
  ARCHIVE_ENTRIES: 1024,
  BOOKLET_PANELS: 32,
  SERIAL_NUMBER_LENGTH: 64,
} as const;

/* -------------------------------------------------------------------------- */
/* Cassette model (§5)                                                        */
/* -------------------------------------------------------------------------- */

export const Side = {
  A: 'A',
  B: 'B',
} as const;
export type Side = (typeof Side)[keyof typeof Side];

export const SIDES: readonly Side[] = [Side.A, Side.B];

export const CassetteType = {
  C46: 'C46',
  C60: 'C60',
  C90: 'C90',
  C120: 'C120',
  Custom: 'custom',
} as const;
export type CassetteType = (typeof CassetteType)[keyof typeof CassetteType];
export type StandardCassetteType = Exclude<CassetteType, typeof CassetteType.Custom>;

/** Side length fixed by each standard type, in seconds (§5.1). */
export const STANDARD_SIDE_SECONDS: Readonly<Record<StandardCassetteType, number>> = {
  C46: 1380,
  C60: 1800,
  C90: 2700,
  C120: 3600,
};

/** Allowed side length of a custom cassette, in seconds (§5.1). */
export const CUSTOM_SIDE_SECONDS = { min: 1, max: 5400 } as const;

/** Allowed timeline rates in frames per second, and the default (§5.3). */
export const TIMELINE_RATES: readonly number[] = [44100, 48000];
export const DEFAULT_TIMELINE_RATE = 44100;

/* -------------------------------------------------------------------------- */
/* Sides and audio (§7, §8)                                                   */
/* -------------------------------------------------------------------------- */

export const WriteProtect = {
  Intact: 'intact',
  Broken: 'broken',
  TapedOver: 'taped_over',
} as const;
export type WriteProtect = (typeof WriteProtect)[keyof typeof WriteProtect];

export const Codec = {
  AacLc: 'aac-lc',
  Alac: 'alac',
  Flac: 'flac',
  Pcm: 'pcm',
} as const;
export type Codec = (typeof Codec)[keyof typeof Codec];

/** Media type of each codec's container, used to hand audio to the browser (§7.3). */
export const CODEC_MEDIA_TYPES: Readonly<Record<Codec, string>> = {
  'aac-lc': 'audio/mp4',
  alac: 'audio/mp4',
  flac: 'audio/flac',
  pcm: 'audio/wav',
};

export const MarkerKind = {
  Track: 'track',
  Voice: 'voice',
  Note: 'note',
} as const;
export type MarkerKind = (typeof MarkerKind)[keyof typeof MarkerKind];

/* -------------------------------------------------------------------------- */
/* Appearance and J-card (§10, §11)                                           */
/* -------------------------------------------------------------------------- */

export const ShellFinish = {
  Opaque: 'opaque',
  Transparent: 'transparent',
} as const;
export type ShellFinish = (typeof ShellFinish)[keyof typeof ShellFinish];

export const LabelStyle = {
  Ruled: 'ruled',
  Stripes: 'stripes',
  Kraft: 'kraft',
  Gradient: 'gradient',
  Plain: 'plain',
} as const;
export type LabelStyle = (typeof LabelStyle)[keyof typeof LabelStyle];

export const FontRole = {
  Marker: 'marker',
  Pen: 'pen',
  Typewriter: 'typewriter',
  Sans: 'sans',
  Serif: 'serif',
  Stencil: 'stencil',
} as const;
export type FontRole = (typeof FontRole)[keyof typeof FontRole];

/** Defaults of §10.1 and §11.1. */
export const Defaults = {
  shellColor: '#1B1B1D',
  shellFinish: ShellFinish.Opaque,
  labelStyle: LabelStyle.Ruled,
  labelPaper: '#F3EEDC',
  labelInk: '#1D2B53',
  labelAccent: '#C8102E',
  labelFont: FontRole.Marker,
  cardColor: '#F4EEDF',
  cardInk: '#1F2A44',
  cardFont: FontRole.Marker,
  markerKind: MarkerKind.Track,
  /** Unknown marker kinds are treated as notes (§7.4). */
  unknownMarkerKind: MarkerKind.Note,
  /** Unknown label styles are drawn as plain (§10.3). */
  unknownLabelStyle: LabelStyle.Plain,
  /** Unknown font roles are drawn as sans (§10.5). */
  unknownFontRole: FontRole.Sans,
} as const;

/* -------------------------------------------------------------------------- */
/* Artwork (§12)                                                              */
/* -------------------------------------------------------------------------- */

export const ArtworkSlot = {
  CassetteFaceA: 'cassette_face_a',
  CassetteFaceB: 'cassette_face_b',
  LabelA: 'label_a',
  LabelB: 'label_b',
  JCardFront: 'jcard_front',
  JCardSpine: 'jcard_spine',
  JCardFlap: 'jcard_flap',
  Thumbnail: 'thumbnail',
} as const;
export type ArtworkSlot = (typeof ArtworkSlot)[keyof typeof ArtworkSlot];

/** Image formats every reader supports (§12.1). */
export const IMAGE_MEDIA_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** Allowed extensions of `cassette.rights.file`: never HTML (§6.4). */
export const RIGHTS_FILE_EXTENSIONS: readonly string[] = ['.txt', '.md'];
