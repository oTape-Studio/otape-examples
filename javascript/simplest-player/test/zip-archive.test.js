import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErrorCode, ZipArchive } from '../src/index.js';
import { makeZip } from './helpers/make-zip.js';

const text = (bytes) => new TextDecoder().decode(bytes);

describe('ZipArchive', () => {
  it('reads stored and deflated entries', async () => {
    const archive = new ZipArchive(await makeZip([
      { name: 'stored.txt', content: 'plain' },
      { name: 'packed.txt', content: 'squeezed '.repeat(50), deflate: true },
    ]));

    assert.equal(text(await archive.read('stored.txt')), 'plain');
    assert.equal(text(await archive.read('packed.txt')), 'squeezed '.repeat(50));
  });

  it('lists files and leaves out directory entries', async () => {
    const archive = new ZipArchive(await makeZip([
      { name: 'audio/', content: '' },
      { name: 'audio/side-a.m4a', content: 'x' },
    ]));

    assert.deepEqual([...archive.entries.keys()], ['audio/side-a.m4a']);
    assert.equal(archive.has('audio/'), false);
  });

  it('rejects data that is not a ZIP archive', () => {
    const notZip = new TextEncoder().encode('{"format":"oTAPE"}').buffer;
    assert.throws(() => new ZipArchive(notZip), { code: ErrorCode.NOT_A_ZIP });
  });

  it('reports a missing entry', async () => {
    const archive = new ZipArchive(await makeZip([{ name: 'a.txt', content: 'a' }]));
    await assert.rejects(archive.read('b.txt'), { code: ErrorCode.ZIP_ENTRY_MISSING });
  });
});
