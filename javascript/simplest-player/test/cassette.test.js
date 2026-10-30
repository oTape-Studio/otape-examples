import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErrorCode, MarkerKind, markerAt, openCassette, typeLabel, WriteProtect } from '../src/index.js';
import { minimalManifest, sampleCassette } from './helpers/fixtures.js';
import { makeCassetteZip, makeZip } from './helpers/make-zip.js';

const decodeToFake = async (bytes) => ({ byteLength: bytes.byteLength });
const failToDecode = async () => { throw new Error('unsupported'); };

describe('openCassette', () => {
  it('opens the example cassette', async () => {
    const cassette = await openCassette(await sampleCassette(), decodeToFake);

    assert.equal(cassette.title, 'Test Tones');
    assert.equal(cassette.typeLabel, 'C46');
    assert.equal(cassette.sideSeconds, 1380);
    assert.equal(cassette.rate, 44100);

    const { A, B } = cassette.sides;
    assert.equal(A.recordedSeconds, 6);
    assert.equal(A.writeProtect, WriteProtect.BROKEN);
    assert.ok(A.buffer);
    assert.deepEqual(A.markers.map((m) => [m.title, m.seconds]), [['Tone', 0], ['Pause', 3], ['Tone again', 4]]);

    assert.equal(B.recordedSeconds, 0);
    assert.equal(B.buffer, null);
  });

  it('still opens a cassette whose audio cannot be decoded (§7.3)', async () => {
    const cassette = await openCassette(await sampleCassette(), failToDecode);
    assert.equal(cassette.sides.A.playable, false);
    assert.equal(cassette.sides.A.buffer, null);
  });

  it('rejects an archive without a manifest', async () => {
    const zip = await makeZip([{ name: 'mimetype', content: 'application/vnd.otape.cassette' }]);
    await assert.rejects(openCassette(zip, decodeToFake), { code: ErrorCode.MANIFEST_MISSING });
  });

  it('rejects a manifest that is not JSON', async () => {
    const zip = await makeZip([{ name: 'manifest.json', content: '{ not json' }]);
    await assert.rejects(openCassette(zip, decodeToFake), { code: ErrorCode.MANIFEST_NOT_JSON });
  });

  it('applies defaults and normalises markers', async () => {
    const manifest = minimalManifest();
    delete manifest.cassette.title;
    manifest.sides.A.markers = [
      { frame: 88200, title: 'Second', kind: 'mystery' },
      { frame: 0, title: 'First' },
      { title: 'No frame' },
    ];

    const cassette = await openCassette(await makeCassetteZip(manifest), decodeToFake);

    assert.equal(cassette.title, 'Untitled cassette');
    assert.deepEqual(cassette.sides.A.markers, [
      { title: 'First', kind: MarkerKind.TRACK, seconds: 0 },
      { title: 'Second', kind: MarkerKind.NOTE, seconds: 2 },
    ]);
  });
});

describe('typeLabel', () => {
  it('keeps standard types', () => {
    assert.equal(typeLabel('C90', 2700), 'C90');
  });

  it('names a custom cassette after its total minutes (§5.1)', () => {
    assert.equal(typeLabel('custom', 37 * 60), 'C74');
  });
});

describe('markerAt', () => {
  const markers = [{ title: 'One', seconds: 0 }, { title: 'Two', seconds: 10 }];

  it('finds the marker at or before a position', () => {
    assert.equal(markerAt(markers, 9.9).title, 'One');
    assert.equal(markerAt(markers, 10).title, 'Two');
  });

  it('returns null before the first marker', () => {
    assert.equal(markerAt([{ title: 'Late', seconds: 5 }], 1), null);
  });
});
