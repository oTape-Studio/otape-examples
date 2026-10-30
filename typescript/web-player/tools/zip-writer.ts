/**
 * A minimal ZIP writer for tests and scripts: stored and deflate entries,
 * optional ZIP64 end records. Not part of the player.
 */

export interface ZipInput {
  readonly name: string;
  readonly data: string | Uint8Array;
  /** Compress with deflate instead of storing. */
  readonly deflate?: boolean;
  /** General-purpose flags to set, e.g. 1 for "encrypted". */
  readonly flags?: number;
  /** Uncompressed size to declare instead of the real one, to test size checks. */
  readonly declaredSize?: number;
}

export interface ZipOptions {
  /** Write ZIP64 end records with maxed-out classic fields. */
  readonly zip64?: boolean;
}

const encoder = new TextEncoder();

export async function writeZip(inputs: readonly ZipInput[], options: ZipOptions = {}): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const input of inputs) {
    const name = encoder.encode(input.name);
    const raw = typeof input.data === 'string' ? encoder.encode(input.data) : input.data;
    const data = input.deflate ? await deflateRaw(raw) : raw;
    const method = input.deflate ? 8 : 0;
    const crc = crc32(raw);
    const flags = (input.flags ?? 0) | 0x0800; // UTF-8 names

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, flags, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, input.declaredSize ?? raw.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, flags, true);
    central.setUint16(10, method, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, input.declaredSize ?? raw.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    directory.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const directoryOffset = offset;
  chunks.push(...directory);

  if (options.zip64) chunks.push(...zip64EndRecords(inputs.length, directorySize, directoryOffset));

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, options.zip64 ? 0xffff : inputs.length, true);
  end.setUint16(10, options.zip64 ? 0xffff : inputs.length, true);
  end.setUint32(12, options.zip64 ? 0xffffffff : directorySize, true);
  end.setUint32(16, options.zip64 ? 0xffffffff : directoryOffset, true);
  chunks.push(new Uint8Array(end.buffer));

  return concat(chunks);
}

function zip64EndRecords(count: number, size: number, offset: number): Uint8Array[] {
  const record = new DataView(new ArrayBuffer(56));
  record.setUint32(0, 0x06064b50, true);
  record.setBigUint64(4, 44n, true);
  record.setUint16(12, 45, true);
  record.setUint16(14, 45, true);
  record.setBigUint64(24, BigInt(count), true);
  record.setBigUint64(32, BigInt(count), true);
  record.setBigUint64(40, BigInt(size), true);
  record.setBigUint64(48, BigInt(offset), true);

  const locator = new DataView(new ArrayBuffer(20));
  locator.setUint32(0, 0x07064b50, true);
  locator.setBigUint64(8, BigInt(offset + size), true);
  locator.setUint32(16, 1, true);

  return [new Uint8Array(record.buffer), new Uint8Array(locator.buffer)];
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
