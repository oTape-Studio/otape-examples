/**
 * A small read-only ZIP reader (§3.1).
 *
 * An .otape file is an ordinary ZIP archive. A player only needs to list the
 * entries and read a few of them, so this reader keeps the whole file in
 * memory, parses the central directory at the end of the file, and inflates
 * an entry on demand with the browser's built-in DecompressionStream.
 *
 * Supported: stored and deflate entries, ZIP64 (§3.1: readers MUST).
 * Rejected: encrypted entries and other compression methods.
 *
 * Format reference: PKWARE APPNOTE 6.3.x. All numbers are little-endian.
 *
 * @module zip-archive
 */

import { ErrorCode, OTapeError } from './errors.js';

/** Record signatures ("PK.."). */
const Signature = Object.freeze({
  LOCAL_FILE_HEADER: 0x04034b50,
  CENTRAL_DIRECTORY_HEADER: 0x02014b50,
  END_OF_CENTRAL_DIRECTORY: 0x06054b50,
  ZIP64_END_LOCATOR: 0x07064b50,
  ZIP64_END_OF_CENTRAL_DIRECTORY: 0x06064b50,
});

/** Fixed sizes of the records, before their variable-length fields. */
const RecordSize = Object.freeze({
  LOCAL_FILE_HEADER: 30,
  CENTRAL_DIRECTORY_HEADER: 46,
  END_OF_CENTRAL_DIRECTORY: 22,
  ZIP64_END_LOCATOR: 20,
});

/** Byte offsets of the fields this reader uses, within each record. */
const Field = Object.freeze({
  LOCAL_NAME_LENGTH: 26,
  LOCAL_EXTRA_LENGTH: 28,

  CENTRAL_FLAGS: 8,
  CENTRAL_METHOD: 10,
  CENTRAL_COMPRESSED_SIZE: 20,
  CENTRAL_SIZE: 24,
  CENTRAL_NAME_LENGTH: 28,
  CENTRAL_EXTRA_LENGTH: 30,
  CENTRAL_COMMENT_LENGTH: 32,
  CENTRAL_LOCAL_HEADER_OFFSET: 42,

  END_ENTRY_COUNT: 10,
  END_DIRECTORY_OFFSET: 16,

  ZIP64_LOCATOR_END_OFFSET: 8,
  ZIP64_END_ENTRY_COUNT: 32,
  ZIP64_END_DIRECTORY_OFFSET: 48,
});

/** Compression methods allowed by oTAPE (§3.1). */
const CompressionMethod = Object.freeze({
  STORED: 0,
  DEFLATE: 8,
});

/** General-purpose flag bit 0: the entry is encrypted. */
const FLAG_ENCRYPTED = 0x0001;

/** Header id of the ZIP64 extended-information extra field. */
const ZIP64_EXTRA_FIELD_ID = 0x0001;

/** A 16- or 32-bit field set to its maximum means "see the ZIP64 record". */
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

/** The archive comment after the end record is at most this long. */
const MAX_COMMENT_LENGTH = 0xffff;

const utf8 = new TextDecoder();

/**
 * @typedef {object} ZipEntry
 * @property {string} name            path inside the archive
 * @property {number} method          compression method
 * @property {number} size            uncompressed size in bytes
 * @property {number} compressedSize  stored size in bytes
 * @property {number} offset          offset of the local file header
 * @property {boolean} encrypted
 */

export class ZipArchive {
  /** @type {Uint8Array} */
  #bytes;
  /** @type {DataView} */
  #view;
  /** @type {Map<string, ZipEntry>} */
  #entries;

  /**
   * @param {ArrayBuffer} buffer  the complete archive
   * @throws {OTapeError} if the buffer is not a readable ZIP archive
   */
  constructor(buffer) {
    this.#bytes = new Uint8Array(buffer);
    this.#view = new DataView(buffer);

    const startsLikeZip = this.#bytes.length >= RecordSize.END_OF_CENTRAL_DIRECTORY
      && this.#u32(0) === Signature.LOCAL_FILE_HEADER;
    if (!startsLikeZip) throw new OTapeError(ErrorCode.NOT_A_ZIP);

    this.#entries = this.#readCentralDirectory();
  }

  /** All file entries, keyed by name. Directory entries are left out (§3.1). */
  get entries() {
    return this.#entries;
  }

  /** @param {string} name */
  has(name) {
    return this.#entries.has(name);
  }

  /**
   * @param {string} name
   * @returns {ZipEntry}
   */
  entry(name) {
    const entry = this.#entries.get(name);
    if (!entry) throw new OTapeError(ErrorCode.ZIP_ENTRY_MISSING, { name });
    return entry;
  }

  /**
   * Read the uncompressed content of an entry.
   *
   * @param {string} name
   * @returns {Promise<Uint8Array>}
   */
  async read(name) {
    const entry = this.entry(name);
    if (entry.encrypted) throw new OTapeError(ErrorCode.ZIP_ENTRY_ENCRYPTED, { name });

    const start = this.#dataOffset(entry);
    const data = this.#bytes.subarray(start, start + entry.compressedSize);

    switch (entry.method) {
      case CompressionMethod.STORED:
        return data;
      case CompressionMethod.DEFLATE:
        return inflateRaw(data);
      default:
        throw new OTapeError(ErrorCode.ZIP_METHOD_UNSUPPORTED, { name, method: entry.method });
    }
  }

  /* ----- parsing ----- */

  #u16(offset) { return this.#view.getUint16(offset, true); }

  #u32(offset) { return this.#view.getUint32(offset, true); }

  #u64(offset) { return Number(this.#view.getBigUint64(offset, true)); }

  /** @returns {Map<string, ZipEntry>} */
  #readCentralDirectory() {
    const { count, offset } = this.#locateCentralDirectory();
    const entries = new Map();

    let position = offset;
    for (let index = 0; index < count; index++) {
      if (this.#u32(position) !== Signature.CENTRAL_DIRECTORY_HEADER) {
        throw new OTapeError(ErrorCode.ZIP_DIRECTORY_DAMAGED);
      }
      const { entry, length } = this.#readDirectoryHeader(position);
      if (!entry.name.endsWith('/')) entries.set(entry.name, entry);
      position += length;
    }
    return entries;
  }

  /**
   * Find the number of entries and the start of the central directory.
   * They are in the End Of Central Directory record, or, when that record's
   * fields are maxed out, in the ZIP64 end record it points to.
   */
  #locateCentralDirectory() {
    const end = this.#findEndOfCentralDirectory();
    let count = this.#u16(end + Field.END_ENTRY_COUNT);
    let offset = this.#u32(end + Field.END_DIRECTORY_OFFSET);

    if (count === UINT16_MAX || offset === UINT32_MAX) {
      const locator = end - RecordSize.ZIP64_END_LOCATOR;
      if (locator >= 0 && this.#u32(locator) === Signature.ZIP64_END_LOCATOR) {
        const zip64End = this.#u64(locator + Field.ZIP64_LOCATOR_END_OFFSET);
        if (this.#u32(zip64End) === Signature.ZIP64_END_OF_CENTRAL_DIRECTORY) {
          count = this.#u64(zip64End + Field.ZIP64_END_ENTRY_COUNT);
          offset = this.#u64(zip64End + Field.ZIP64_END_DIRECTORY_OFFSET);
        }
      }
    }
    return { count, offset };
  }

  /** The end record sits at the end, followed only by an optional comment. */
  #findEndOfCentralDirectory() {
    const last = this.#bytes.length - RecordSize.END_OF_CENTRAL_DIRECTORY;
    const first = Math.max(0, last - MAX_COMMENT_LENGTH);
    for (let offset = last; offset >= first; offset--) {
      if (this.#u32(offset) === Signature.END_OF_CENTRAL_DIRECTORY) return offset;
    }
    throw new OTapeError(ErrorCode.ZIP_END_NOT_FOUND);
  }

  /**
   * @param {number} start  offset of a central directory header
   * @returns {{ entry: ZipEntry, length: number }}
   */
  #readDirectoryHeader(start) {
    const nameLength = this.#u16(start + Field.CENTRAL_NAME_LENGTH);
    const extraLength = this.#u16(start + Field.CENTRAL_EXTRA_LENGTH);
    const commentLength = this.#u16(start + Field.CENTRAL_COMMENT_LENGTH);
    const nameStart = start + RecordSize.CENTRAL_DIRECTORY_HEADER;
    const extraStart = nameStart + nameLength;

    const entry = {
      name: utf8.decode(this.#bytes.subarray(nameStart, extraStart)),
      method: this.#u16(start + Field.CENTRAL_METHOD),
      size: this.#u32(start + Field.CENTRAL_SIZE),
      compressedSize: this.#u32(start + Field.CENTRAL_COMPRESSED_SIZE),
      offset: this.#u32(start + Field.CENTRAL_LOCAL_HEADER_OFFSET),
      encrypted: (this.#u16(start + Field.CENTRAL_FLAGS) & FLAG_ENCRYPTED) !== 0,
    };
    this.#applyZip64ExtraField(entry, extraStart, extraStart + extraLength);

    return { entry, length: RecordSize.CENTRAL_DIRECTORY_HEADER + nameLength + extraLength + commentLength };
  }

  /**
   * The ZIP64 extra field holds 64-bit values for exactly those fields that
   * are 0xffffffff in the header, always in this order: size, compressed
   * size, local header offset.
   */
  #applyZip64ExtraField(entry, start, end) {
    let position = start;
    while (position + 4 <= end) {
      const id = this.#u16(position);
      const length = this.#u16(position + 2);
      if (id === ZIP64_EXTRA_FIELD_ID) {
        let value = position + 4;
        for (const key of ['size', 'compressedSize', 'offset']) {
          if (entry[key] === UINT32_MAX) {
            entry[key] = this.#u64(value);
            value += 8;
          }
        }
      }
      position += 4 + length;
    }
  }

  /**
   * The data follows the local file header, whose name and extra lengths may
   * differ from the central directory's, so they are read from it.
   */
  #dataOffset(entry) {
    if (this.#u32(entry.offset) !== Signature.LOCAL_FILE_HEADER) {
      throw new OTapeError(ErrorCode.ZIP_ENTRY_DAMAGED, { name: entry.name });
    }
    return entry.offset
      + RecordSize.LOCAL_FILE_HEADER
      + this.#u16(entry.offset + Field.LOCAL_NAME_LENGTH)
      + this.#u16(entry.offset + Field.LOCAL_EXTRA_LENGTH);
  }
}

/**
 * Inflate raw deflate data (no zlib header) with the platform's decoder.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
