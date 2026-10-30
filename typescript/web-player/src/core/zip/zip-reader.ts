/**
 * A lazy, read-only ZIP reader over a Blob (§3.1).
 *
 * Only the end of the file (the central directory) is read when an archive
 * is opened. Entries are read on demand, and a *stored* entry can be handed
 * out as a Blob slice of the original file: no bytes are copied, so a
 * 60-minute side plays straight from disk instead of from memory.
 *
 * Supported: stored and deflate entries, ZIP64. Encrypted entries, symbolic
 * links and other compression methods are reported, never read.
 *
 * Format reference: PKWARE APPNOTE 6.3.x. All numbers are little-endian.
 */

import { OTapeError } from '../issues.ts';
import { inflateRaw } from './inflate.ts';

const Signature = {
  LocalFileHeader: 0x04034b50,
  CentralDirectoryHeader: 0x02014b50,
  EndOfCentralDirectory: 0x06054b50,
  Zip64EndLocator: 0x07064b50,
  Zip64EndOfCentralDirectory: 0x06064b50,
} as const;

const RecordSize = {
  LocalFileHeader: 30,
  CentralDirectoryHeader: 46,
  EndOfCentralDirectory: 22,
  Zip64EndLocator: 20,
  Zip64EndOfCentralDirectory: 56,
} as const;

/** Byte offsets of fields within their record. */
const Field = {
  LocalNameLength: 26,
  LocalExtraLength: 28,

  CentralVersionMadeBy: 4,
  CentralFlags: 8,
  CentralMethod: 10,
  CentralCompressedSize: 20,
  CentralSize: 24,
  CentralNameLength: 28,
  CentralExtraLength: 30,
  CentralCommentLength: 32,
  CentralExternalAttributes: 38,
  CentralLocalHeaderOffset: 42,

  EndEntryCount: 10,
  EndDirectorySize: 12,
  EndDirectoryOffset: 16,

  Zip64LocatorEndOffset: 8,
  Zip64EndEntryCount: 32,
  Zip64EndDirectorySize: 40,
  Zip64EndDirectoryOffset: 48,
} as const;

export const CompressionMethod = {
  Stored: 0,
  Deflate: 8,
} as const;

const FLAG_ENCRYPTED = 0x0001;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const HOST_UNIX = 3;
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMLINK = 0o120000;
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;
const MAX_COMMENT_LENGTH = 0xffff;

const utf8 = new TextDecoder();

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  /** Uncompressed size in bytes. */
  readonly size: number;
  readonly compressedSize: number;
  /** Offset of the local file header. */
  readonly headerOffset: number;
  readonly encrypted: boolean;
  readonly symlink: boolean;
}

/** Why an entry cannot be read, or `null` if it can (§3.1). */
export function entryRestriction(entry: ZipEntry): string | null {
  if (entry.encrypted) return 'encrypted';
  if (entry.symlink) return 'a symbolic link';
  if (entry.method !== CompressionMethod.Stored && entry.method !== CompressionMethod.Deflate) {
    return `compressed with unsupported method ${entry.method}`;
  }
  return null;
}

export class ZipReader {
  readonly #blob: Blob;
  readonly #entries: ReadonlyMap<string, ZipEntry>;
  readonly #ordered: readonly ZipEntry[];

  private constructor(blob: Blob, entries: readonly ZipEntry[]) {
    this.#blob = blob;
    this.#ordered = [...entries].sort((a, b) => a.headerOffset - b.headerOffset);
    this.#entries = new Map(entries.filter((entry) => !entry.name.endsWith('/')).map((e) => [e.name, e]));
  }

  /**
   * Read the central directory of an archive.
   *
   * @throws {OTapeError} if the blob is not a readable ZIP archive
   */
  static async open(blob: Blob): Promise<ZipReader> {
    const head = await readView(blob, 0, Math.min(4, blob.size));
    if (head.byteLength < 4 || head.getUint32(0, true) !== Signature.LocalFileHeader) {
      throw OTapeError.of('not-a-zip');
    }
    const directory = await locateCentralDirectory(blob);
    const view = await readView(blob, directory.offset, directory.size);
    return new ZipReader(blob, parseCentralDirectory(view, directory.count));
  }

  /** File entries by name. Directory entries are left out (§3.1). */
  get entries(): ReadonlyMap<string, ZipEntry> {
    return this.#entries;
  }

  /** The entry stored first in the file, where `mimetype` belongs (§3.2). */
  get firstEntry(): ZipEntry | undefined {
    return this.#ordered[0];
  }

  has(name: string): boolean {
    return this.#entries.has(name);
  }

  /** @throws {OTapeError} if there is no such entry */
  entry(name: string): ZipEntry {
    const entry = this.#entries.get(name);
    if (!entry) throw OTapeError.of('zip-entry-missing', { name });
    return entry;
  }

  /** Length of the extra field in an entry's local header (`mimetype` must have none, §3.2). */
  async localExtraLength(name: string): Promise<number> {
    const header = await this.#localHeader(this.entry(name));
    return header.getUint16(Field.LocalExtraLength, true);
  }

  /**
   * The content of an entry as a Blob. A stored entry is a slice of the
   * original file and costs no memory; a deflated one is inflated.
   */
  async blob(name: string, type = ''): Promise<Blob> {
    const entry = this.#readable(name);
    const start = await this.#dataOffset(entry);
    const data = this.#blob.slice(start, start + entry.compressedSize, type);
    if (entry.method === CompressionMethod.Stored) return data;
    return new Blob([await inflateRaw(data, entry)], { type });
  }

  async bytes(name: string): Promise<Uint8Array> {
    const blob = await this.blob(name);
    return new Uint8Array(await blob.arrayBuffer());
  }

  async text(name: string): Promise<string> {
    return utf8.decode(await this.bytes(name));
  }

  #readable(name: string): ZipEntry {
    const entry = this.entry(name);
    const reason = entryRestriction(entry);
    if (reason) throw OTapeError.of('zip-entry-not-allowed', { name, reason });
    return entry;
  }

  async #localHeader(entry: ZipEntry): Promise<DataView> {
    const header = await readView(this.#blob, entry.headerOffset, RecordSize.LocalFileHeader);
    if (
      header.byteLength < RecordSize.LocalFileHeader ||
      header.getUint32(0, true) !== Signature.LocalFileHeader
    ) {
      throw OTapeError.of('zip-entry-damaged', { name: entry.name });
    }
    return header;
  }

  /** The data follows the local header, whose name and extra lengths may differ from the directory's. */
  async #dataOffset(entry: ZipEntry): Promise<number> {
    const header = await this.#localHeader(entry);
    return (
      entry.headerOffset +
      RecordSize.LocalFileHeader +
      header.getUint16(Field.LocalNameLength, true) +
      header.getUint16(Field.LocalExtraLength, true)
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Central directory                                                          */
/* -------------------------------------------------------------------------- */

interface DirectoryLocation {
  readonly count: number;
  readonly offset: number;
  readonly size: number;
}

/**
 * The End Of Central Directory record is at the end of the file, followed
 * only by a comment of up to 64 KiB. When its fields are maxed out, the real
 * values are in the ZIP64 end record, found through a locator just before it.
 */
async function locateCentralDirectory(blob: Blob): Promise<DirectoryLocation> {
  const tailLength = Math.min(blob.size, RecordSize.EndOfCentralDirectory + MAX_COMMENT_LENGTH);
  const tailStart = blob.size - tailLength;
  const tail = await readView(blob, tailStart, tailLength);

  const end = findEndRecord(tail);
  let count = tail.getUint16(end + Field.EndEntryCount, true);
  let size = tail.getUint32(end + Field.EndDirectorySize, true);
  let offset = tail.getUint32(end + Field.EndDirectoryOffset, true);

  const locator = end - RecordSize.Zip64EndLocator;
  const usesZip64 = count === UINT16_MAX || size === UINT32_MAX || offset === UINT32_MAX;
  if (usesZip64 && locator >= 0 && tail.getUint32(locator, true) === Signature.Zip64EndLocator) {
    const recordOffset = Number(tail.getBigUint64(locator + Field.Zip64LocatorEndOffset, true));
    const record = await readView(blob, recordOffset, RecordSize.Zip64EndOfCentralDirectory);
    if (record.getUint32(0, true) !== Signature.Zip64EndOfCentralDirectory) {
      throw OTapeError.of('zip-directory-damaged');
    }
    count = Number(record.getBigUint64(Field.Zip64EndEntryCount, true));
    size = Number(record.getBigUint64(Field.Zip64EndDirectorySize, true));
    offset = Number(record.getBigUint64(Field.Zip64EndDirectoryOffset, true));
  }

  if (offset + size > blob.size) throw OTapeError.of('zip-directory-damaged');
  return { count, offset, size };
}

function findEndRecord(tail: DataView): number {
  for (let offset = tail.byteLength - RecordSize.EndOfCentralDirectory; offset >= 0; offset--) {
    if (tail.getUint32(offset, true) === Signature.EndOfCentralDirectory) return offset;
  }
  throw OTapeError.of('zip-end-not-found');
}

function parseCentralDirectory(view: DataView, count: number): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let position = 0;
  for (let index = 0; index < count; index++) {
    if (position + RecordSize.CentralDirectoryHeader > view.byteLength)
      throw OTapeError.of('zip-directory-damaged');
    if (view.getUint32(position, true) !== Signature.CentralDirectoryHeader) {
      throw OTapeError.of('zip-directory-damaged');
    }
    const { entry, length } = parseDirectoryHeader(view, position);
    entries.push(entry);
    position += length;
  }
  return entries;
}

function parseDirectoryHeader(view: DataView, start: number): { entry: ZipEntry; length: number } {
  const u16 = (field: number): number => view.getUint16(start + field, true);
  const u32 = (field: number): number => view.getUint32(start + field, true);

  const nameLength = u16(Field.CentralNameLength);
  const extraLength = u16(Field.CentralExtraLength);
  const commentLength = u16(Field.CentralCommentLength);
  const nameStart = start + RecordSize.CentralDirectoryHeader;
  const extraStart = nameStart + nameLength;

  const madeOnUnix = u16(Field.CentralVersionMadeBy) >> 8 === HOST_UNIX;
  const unixMode = u32(Field.CentralExternalAttributes) >>> 16;

  const sizes = readZip64Sizes(view, extraStart, extraStart + extraLength, {
    size: u32(Field.CentralSize),
    compressedSize: u32(Field.CentralCompressedSize),
    headerOffset: u32(Field.CentralLocalHeaderOffset),
  });

  const entry: ZipEntry = {
    name: utf8.decode(new Uint8Array(view.buffer, view.byteOffset + nameStart, nameLength)),
    method: u16(Field.CentralMethod),
    encrypted: (u16(Field.CentralFlags) & FLAG_ENCRYPTED) !== 0,
    symlink: madeOnUnix && (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK,
    ...sizes,
  };
  return { entry, length: RecordSize.CentralDirectoryHeader + nameLength + extraLength + commentLength };
}

type EntrySizes = Pick<ZipEntry, 'size' | 'compressedSize' | 'headerOffset'>;

/**
 * The ZIP64 extra field holds 64-bit values for exactly those fields that
 * are 0xffffffff in the header, always in this order.
 */
function readZip64Sizes(view: DataView, start: number, end: number, sizes: EntrySizes): EntrySizes {
  const result = { ...sizes };
  for (let position = start; position + 4 <= end;) {
    const id = view.getUint16(position, true);
    const length = view.getUint16(position + 2, true);
    if (id === ZIP64_EXTRA_FIELD_ID) {
      let value = position + 4;
      for (const key of ['size', 'compressedSize', 'headerOffset'] as const) {
        if (result[key] === UINT32_MAX && value + 8 <= end) {
          result[key] = Number(view.getBigUint64(value, true));
          value += 8;
        }
      }
    }
    position += 4 + length;
  }
  return result;
}

async function readView(blob: Blob, offset: number, length: number): Promise<DataView> {
  return new DataView(await blob.slice(offset, offset + length).arrayBuffer());
}
