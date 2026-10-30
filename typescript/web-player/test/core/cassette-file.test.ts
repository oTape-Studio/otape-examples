// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CassetteFile } from '../../src/core/cassette/cassette-file.ts';
import { typeLabel } from '../../src/core/cassette/describe.ts';
import { OTapeError } from '../../src/core/issues.ts';
import { writeZip } from '../../tools/zip-writer.ts';
import { cassetteBlob, fixtureBlob, minimalManifest, recordedSide } from '../helpers/fixtures.ts';

describe('CassetteFile', () => {
  describe('the example cassette of the specification', () => {
    it('describes the cassette', async () => {
      const { cassette } = await CassetteFile.open(fixtureBlob('sample-tones.otape'));

      expect(cassette).toMatchObject({
        title: 'Test Tones',
        creator: 'oTAPE examples',
        typeLabel: 'C46',
        sideSeconds: 1380,
        rate: 44100,
        warnings: [],
      });
      expect(cassette.sides.A).toMatchObject({ title: 'Tones', writeProtect: 'broken', recordedSeconds: 6 });
      expect(cassette.sides.A.markers.map((m) => [m.title, m.kind, m.seconds])).toEqual([
        ['Tone', 'track', 0],
        ['Pause', 'note', 3],
        ['Tone again', 'track', 4],
      ]);
      expect(cassette.sides.B).toMatchObject({ recordedSeconds: 0, audio: null });
    });

    it('parses appearance, J-card and rights', async () => {
      const { cassette } = await CassetteFile.open(fixtureBlob('sample-tones.otape'));

      expect(cassette.appearance.shell).toEqual({
        color: { hex: '#3a3f47', alpha: 0x8c / 255 },
        finish: 'transparent',
      });
      expect(cassette.appearance.label).toMatchObject({ style: 'stripes', font: 'pen' });
      expect(cassette.jcard).toMatchObject({
        title: 'Test Tones',
        font: 'stencil',
        tracklist: { A: ['Tone', 'Tone again'] },
      });
      expect(cassette.rights).toMatchObject({ license: 'CC-BY-4.0', file: 'docs/license.txt' });
      expect(cassette.artwork).toEqual({
        label_a: 'artwork/label-a.png',
        jcard_front: 'artwork/jcard-front.png',
      });
    });

    it('reads audio, artwork and licence on demand', async () => {
      const file = await CassetteFile.open(fixtureBlob('sample-tones.otape'));

      const audio = await file.audio('A');
      expect(audio?.type).toBe('audio/mp4');
      expect(audio?.size).toBe(78671);
      await expect(file.audio('B')).resolves.toBeNull();

      const label = await file.artwork('label_a');
      expect(label?.type).toBe('image/png');
      await expect(file.artwork('label_b')).resolves.toBeNull();

      await expect(file.licenseText()).resolves.toContain('Creative Commons');
    });
  });

  it('opens a blank cassette', async () => {
    const { cassette } = await CassetteFile.open(fixtureBlob('blank-c60.otape'));
    expect(cassette.typeLabel).toBe('C60');
    expect(cassette.sides.A.recordedSeconds).toBe(0);
  });

  it('applies the defaults of the specification', async () => {
    const manifest = minimalManifest();
    manifest['appearance'] = { label: { style: 'holographic', font: 'gothic' } };
    manifest.sides['A'] = recordedSide(10, {
      markers: [
        { frame: 0, title: 'Mystery', kind: 'chapter' },
        { frame: 44100, title: 'Plain' },
      ],
    });
    const file = await CassetteFile.open(
      await cassetteBlob(manifest, [{ name: 'audio/side-a.m4a', data: 'aac' }]),
    );

    const { cassette } = file;
    expect(cassette.appearance.shell).toEqual({ color: { hex: '#1b1b1d', alpha: 1 }, finish: 'opaque' });
    expect(cassette.appearance.label).toMatchObject({ style: 'plain', font: 'sans' });
    expect(cassette.jcard).toMatchObject({ title: 'Night Drive', spineText: 'NIGHT DRIVE', font: 'marker' });
    expect(cassette.sides.A.markers.map((m) => m.kind)).toEqual(['note', 'track']);
  });

  it('warns, but opens, when the mimetype entry is missing (§3.2)', async () => {
    const zip = await writeZip([{ name: 'manifest.json', data: JSON.stringify(minimalManifest()) }]);
    const { cassette } = await CassetteFile.open(new Blob([zip as Uint8Array<ArrayBuffer>]));
    expect(cassette.warnings.map((w) => w.code)).toEqual(['mimetype-missing']);
  });

  it('rejects an invalid cassette with every error', async () => {
    const manifest = minimalManifest();
    manifest.cassette['id'] = 'nope';
    manifest.sides['A'] = recordedSide(10);

    const error = await CassetteFile.open(await cassetteBlob(manifest)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OTapeError);
    expect((error as OTapeError).issues.map((issue) => issue.code)).toEqual([
      'id-invalid',
      'audio-file-missing',
    ]);
  });

  it('rejects a manifest that is not JSON', async () => {
    const zip = await writeZip([{ name: 'manifest.json', data: '{ nope' }]);
    await expect(CassetteFile.open(new Blob([zip as Uint8Array<ArrayBuffer>]))).rejects.toMatchObject({
      code: 'manifest-not-json',
    });
  });
});

describe('typeLabel', () => {
  it('keeps standard types and names custom ones by total minutes (§5.1)', () => {
    expect(typeLabel('C90', 2700)).toBe('C90');
    expect(typeLabel('custom', 37 * 60)).toBe('C74');
  });
});
