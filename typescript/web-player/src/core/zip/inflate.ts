import { OTapeError } from '../issues.ts';

interface InflateTarget {
  readonly name: string;
  /** Declared uncompressed size. Inflating past it is treated as an attack (§17). */
  readonly size: number;
}

/**
 * Inflate raw deflate data with the platform's DecompressionStream, refusing
 * to produce more bytes than the entry declares (decompression bombs, §17).
 */
export async function inflateRaw(data: Blob, target: InflateTarget): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Uint8Array(target.size);
  let written = 0;

  // A reader loop rather than `for await`: async iteration of streams is
  // not available in every browser yet.
  const reader = data.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (written + value.byteLength > target.size) {
        throw OTapeError.of('zip-entry-too-large', { name: target.name });
      }
      output.set(value, written);
      written += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return written === target.size ? output : output.subarray(0, written);
}
