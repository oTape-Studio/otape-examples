// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { entryRestriction, ZipReader } from '../../src/core/zip/zip-reader.ts';
import { OTapeError } from '../../src/core/issues.ts';
import { writeZip, type ZipInput, type ZipOptions } from '../../tools/zip-writer.ts';

async function open(inputs: readonly ZipInput[], options?: ZipOptions): Promise<ZipReader> {
  const bytes = await writeZip(inputs, options);
  return ZipReader.open(new Blob([bytes as Uint8Array<ArrayBuffer>]));
}

describe('ZipReader', () => {
  it('reads stored and deflated entries', async () => {
    const text = 'squeezed '.repeat(200);
    const zip = await open([
      { name: 'plain.txt', data: 'plain' },
      { name: 'packed.txt', data: text, deflate: true },
    ]);

    await expect(zip.text('plain.txt')).resolves.toBe('plain');
    await expect(zip.text('packed.txt')).resolves.toBe(text);
  });

  it('hands out a stored entry as a typed slice of the file', async () => {
    const audio = new Uint8Array(4096).map((_, index) => index % 251);
    const zip = await open([{ name: 'audio/side-a.m4a', data: audio }]);

    const blob = await zip.blob('audio/side-a.m4a', 'audio/mp4');

    expect(blob.type).toBe('audio/mp4');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(audio);
  });

  it('lists files without directory entries, in archive order', async () => {
    const zip = await open([
      { name: 'mimetype', data: 'x' },
      { name: 'audio/', data: '' },
      { name: 'audio/side-a.m4a', data: 'a' },
    ]);

    expect([...zip.entries.keys()]).toEqual(['mimetype', 'audio/side-a.m4a']);
    expect(zip.firstEntry?.name).toBe('mimetype');
  });

  it('reads ZIP64 end records (§3.1)', async () => {
    const zip = await open([{ name: 'manifest.json', data: '{}' }], { zip64: true });
    await expect(zip.text('manifest.json')).resolves.toBe('{}');
  });

  it('rejects data that is not a ZIP archive', async () => {
    await expect(ZipReader.open(new Blob(['{"format":"oTAPE"}']))).rejects.toMatchObject({
      code: 'not-a-zip',
    });
  });

  it('reports a missing entry', async () => {
    const zip = await open([{ name: 'a.txt', data: 'a' }]);
    expect(() => zip.entry('b.txt')).toThrow(OTapeError);
  });

  it('refuses to read an encrypted entry', async () => {
    const zip = await open([{ name: 'secret.bin', data: 'x', flags: 1 }]);

    expect(entryRestriction(zip.entry('secret.bin'))).toBe('encrypted');
    await expect(zip.bytes('secret.bin')).rejects.toMatchObject({ code: 'zip-entry-not-allowed' });
  });

  it('stops inflating at the declared size (§17)', async () => {
    const zip = await open([
      { name: 'bomb.txt', data: 'a'.repeat(100_000), deflate: true, declaredSize: 10 },
    ]);
    await expect(zip.bytes('bomb.txt')).rejects.toMatchObject({ code: 'zip-entry-too-large' });
  });
});
