/**
 * Every reason this player can refuse a file, in one place.
 *
 * A conforming reader rejects an invalid file "naming the reason" (§16.1).
 * Each error therefore carries a stable `code` for programs, the spec
 * `section` it comes from, and a readable `message` for people.
 *
 * @module errors
 */

/** Stable identifiers of all errors. */
export const ErrorCode = Object.freeze({
  // Container (§3)
  NOT_A_ZIP: 'not-a-zip',
  ZIP_END_NOT_FOUND: 'zip-end-not-found',
  ZIP_DIRECTORY_DAMAGED: 'zip-directory-damaged',
  ZIP_ENTRY_MISSING: 'zip-entry-missing',
  ZIP_ENTRY_DAMAGED: 'zip-entry-damaged',
  ZIP_ENTRY_ENCRYPTED: 'zip-entry-encrypted',
  ZIP_METHOD_UNSUPPORTED: 'zip-method-unsupported',

  // Manifest (§6, §15)
  MANIFEST_MISSING: 'manifest-missing',
  MANIFEST_TOO_LARGE: 'manifest-too-large',
  MANIFEST_NOT_JSON: 'manifest-not-json',
  MANIFEST_NOT_OBJECT: 'manifest-not-object',
  NOT_OTAPE: 'not-otape',
  VERSION_INVALID: 'version-invalid',
  VERSION_UNSUPPORTED: 'version-unsupported',

  // Cassette (§5)
  CASSETTE_MISSING: 'cassette-missing',
  ID_INVALID: 'id-invalid',
  CREATED_AT_MISSING: 'created-at-missing',
  SIDE_LENGTH_NOT_INTEGER: 'side-length-not-integer',
  SIDE_LENGTH_MISMATCH: 'side-length-mismatch',
  CUSTOM_LENGTH_OUT_OF_RANGE: 'custom-length-out-of-range',
  TYPE_UNKNOWN: 'type-unknown',
  TIMELINE_RATE_INVALID: 'timeline-rate-invalid',
  RIGHTS_FILE_INVALID: 'rights-file-invalid',

  // Sides (§7, §8)
  SIDES_MISSING: 'sides-missing',
  SIDE_MISSING: 'side-missing',
  WRITE_PROTECT_INVALID: 'write-protect-invalid',
  AUDIO_PATH_UNSAFE: 'audio-path-unsafe',
  AUDIO_FILE_MISSING: 'audio-file-missing',
  RECORDED_FRAMES_INVALID: 'recorded-frames-invalid',
  RECORDED_FRAMES_TOO_LONG: 'recorded-frames-too-long',
});

/**
 * Spec section and message for each code. `message` receives the
 * error's `details` object.
 *
 * @type {Readonly<Record<string, { section: string, message: (details: object) => string }>>}
 */
const ERROR_DEFINITIONS = Object.freeze({
  [ErrorCode.NOT_A_ZIP]: { section: '§3.1', message: () => 'Not a ZIP archive' },
  [ErrorCode.ZIP_END_NOT_FOUND]: { section: '§3.1', message: () => 'ZIP end record not found' },
  [ErrorCode.ZIP_DIRECTORY_DAMAGED]: { section: '§3.1', message: () => 'Damaged ZIP central directory' },
  [ErrorCode.ZIP_ENTRY_MISSING]: { section: '§3.3', message: ({ name }) => `${name} is not in the archive` },
  [ErrorCode.ZIP_ENTRY_DAMAGED]: { section: '§3.1', message: ({ name }) => `${name} has a damaged local header` },
  [ErrorCode.ZIP_ENTRY_ENCRYPTED]: { section: '§3.1', message: ({ name }) => `${name} is encrypted` },
  [ErrorCode.ZIP_METHOD_UNSUPPORTED]: {
    section: '§3.1',
    message: ({ name, method }) => `${name} uses unsupported compression method ${method}`,
  },

  [ErrorCode.MANIFEST_MISSING]: { section: '§6', message: () => 'manifest.json is missing' },
  [ErrorCode.MANIFEST_TOO_LARGE]: { section: '§3.5', message: () => 'manifest.json exceeds 1 MiB' },
  [ErrorCode.MANIFEST_NOT_JSON]: { section: '§6', message: () => 'manifest.json is not valid JSON' },
  [ErrorCode.MANIFEST_NOT_OBJECT]: { section: '§6', message: () => 'The manifest root must be an object' },
  [ErrorCode.NOT_OTAPE]: { section: '§6.1', message: () => 'Not an oTAPE file' },
  [ErrorCode.VERSION_INVALID]: { section: '§15.1', message: () => 'format_version must be "MAJOR.MINOR"' },
  [ErrorCode.VERSION_UNSUPPORTED]: {
    section: '§15.1',
    message: ({ version }) => `oTAPE ${version} needs a newer player`,
  },

  [ErrorCode.CASSETTE_MISSING]: { section: '§6.2', message: () => 'cassette is missing' },
  [ErrorCode.ID_INVALID]: { section: '§5.2', message: () => 'cassette.id is not a UUID' },
  [ErrorCode.CREATED_AT_MISSING]: { section: '§5.2', message: () => 'cassette.created_at is missing' },
  [ErrorCode.SIDE_LENGTH_NOT_INTEGER]: { section: '§5.1', message: () => 'side_length_seconds must be an integer' },
  [ErrorCode.SIDE_LENGTH_MISMATCH]: {
    section: '§5.1',
    message: ({ type, expected }) => `${type} must be ${expected} s per side`,
  },
  [ErrorCode.CUSTOM_LENGTH_OUT_OF_RANGE]: {
    section: '§5.1',
    message: ({ min, max }) => `A custom side must be ${min}–${max} s`,
  },
  [ErrorCode.TYPE_UNKNOWN]: { section: '§5.1', message: ({ type }) => `Unknown cassette type ${JSON.stringify(type)}` },
  [ErrorCode.TIMELINE_RATE_INVALID]: {
    section: '§5.3',
    message: ({ allowed }) => `timeline_rate must be one of ${allowed.join(', ')}`,
  },
  [ErrorCode.RIGHTS_FILE_INVALID]: {
    section: '§6.4',
    message: () => 'cassette.rights.file must be a .txt or .md file inside the archive',
  },

  [ErrorCode.SIDES_MISSING]: { section: '§7', message: () => 'sides is missing' },
  [ErrorCode.SIDE_MISSING]: { section: '§7.1', message: ({ side }) => `Side ${side} is missing` },
  [ErrorCode.WRITE_PROTECT_INVALID]: {
    section: '§8.1',
    message: ({ side }) => `Side ${side} has an invalid write_protect`,
  },
  [ErrorCode.AUDIO_PATH_UNSAFE]: { section: '§3.3', message: ({ side }) => `Side ${side} has an unsafe audio path` },
  [ErrorCode.AUDIO_FILE_MISSING]: {
    section: '§16.1',
    message: ({ side, path }) => `Side ${side}: ${path} is not in the archive`,
  },
  [ErrorCode.RECORDED_FRAMES_INVALID]: {
    section: '§7.2',
    message: ({ side }) => `Side ${side}: recorded_frames must be a non-negative integer`,
  },
  [ErrorCode.RECORDED_FRAMES_TOO_LONG]: {
    section: '§7.2',
    message: ({ side }) => `Side ${side} is recorded longer than the tape`,
  },
});

/** An invalid or unreadable oTAPE file. */
export class OTapeError extends Error {
  /**
   * @param {string} code    one of {@link ErrorCode}
   * @param {object} [details]  values used in the message
   */
  constructor(code, details = {}) {
    const { section, message } = ERROR_DEFINITIONS[code];
    super(`${message(details)} (${section})`);
    this.name = 'OTapeError';
    this.code = code;
    this.section = section;
    this.details = details;
  }
}
