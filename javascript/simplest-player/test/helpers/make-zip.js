/**
 * Builds small ZIP archives in memory for tests.
 */

const encoder = new TextEncoder();

/**
 * @typedef {object} TestEntry
 * @property {string} name
 * @property {string | Uint8Array} content
 * @property {boolean} [deflate]  compress with deflate instead of storing
 */

/**
 * @param {TestEntry[]} entries
 * @returns {Promise<ArrayBuffer>}
 */
export async function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, content, deflate = false } of entries) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const stored = deflate ? await deflateRaw(data) : data;
    const method = deflate ? 8 : 0;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, stored.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    localParts.push(new Uint8Array(local.buffer), nameBytes, stored);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(10, method, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, stored.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + stored.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)]).arrayBuffer();
}

/**
 * A ZIP holding a manifest, plus optional extra entries.
 *
 * @param {object} manifest
 * @param {TestEntry[]} [extra]
 */
export function makeCassetteZip(manifest, extra = []) {
  return makeZip([
    { name: 'mimetype', content: 'application/vnd.otape.cassette' },
    { name: 'manifest.json', content: JSON.stringify(manifest), deflate: true },
    ...extra,
  ]);
}

async function deflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
