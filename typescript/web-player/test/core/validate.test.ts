// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IssueList, type IssueCode } from '../../src/core/issues.ts';
import { isSafePath } from '../../src/core/manifest/paths.ts';
import { validateManifest, type EntryLookup } from '../../src/core/manifest/validate.ts';
import { minimalManifest, recordedSide, specManifest, type TestManifest } from '../helpers/fixtures.ts';

const anyEntry: EntryLookup = { has: () => true };
const noEntry: EntryLookup = { has: () => false };

function validate(manifest: unknown, archive: EntryLookup = noEntry): IssueList {
  const issues = new IssueList();
  validateManifest(manifest, archive, issues);
  return issues;
}

function codes(issues: IssueList): IssueCode[] {
  return issues.all.map((issue) => issue.code);
}

function manifestWith(change: (manifest: TestManifest) => void): TestManifest {
  const manifest = minimalManifest();
  change(manifest);
  return manifest;
}

describe('validateManifest', () => {
  it('accepts the minimal manifest and returns it typed', () => {
    const issues = new IssueList();
    const manifest = validateManifest(minimalManifest(), noEntry, issues);

    expect(issues.all).toEqual([]);
    expect(manifest?.cassette.type).toBe('C60');
  });

  describe('example manifests of the specification', () => {
    it.each(['manifest-minimal.json', 'manifest-full.json', 'manifest-custom-48k.json'])(
      'accepts %s',
      (name) => {
        expect(validate(specManifest(name), anyEntry).errors).toEqual([]);
      },
    );

    it.each<[string, IssueCode]>([
      ['invalid-overlong-side.json', 'recorded-frames-too-long'],
      ['invalid-rights-html.json', 'rights-file-invalid'],
      ['invalid-write-protect.json', 'write-protect-invalid'],
    ])('rejects %s', (name, code) => {
      expect(codes(validate(specManifest(name), anyEntry))).toContain(code);
    });
  });

  it.each<[string, () => unknown, IssueCode]>([
    ['a root that is not an object', () => [], 'manifest-not-object'],
    ['another format', () => manifestWith((m) => (m.format = 'otape')), 'not-otape'],
    ['a malformed version', () => manifestWith((m) => (m.format_version = '1')), 'version-invalid'],
    ['a newer major version', () => manifestWith((m) => (m.format_version = '2.0')), 'version-unsupported'],
    ['an id that is not a UUID', () => manifestWith((m) => (m.cassette['id'] = 'tape-1')), 'id-invalid'],
    [
      'a created_at that is not RFC 3339',
      () => manifestWith((m) => (m.cassette['created_at'] = 'yesterday')),
      'created-at-invalid',
    ],
    [
      'a type with the wrong side length',
      () => manifestWith((m) => (m.cassette['side_length_seconds'] = 1700)),
      'side-length-mismatch',
    ],
    ['an unknown type', () => manifestWith((m) => (m.cassette['type'] = 'C200')), 'type-unknown'],
    [
      'a custom side that is too long',
      () =>
        manifestWith((m) => {
          m.cassette['type'] = 'custom';
          m.cassette['side_length_seconds'] = 5401;
        }),
      'custom-length-out-of-range',
    ],
    [
      'an unknown timeline rate',
      () => manifestWith((m) => (m.cassette['timeline_rate'] = 96000)),
      'timeline-rate-invalid',
    ],
    ['a missing side', () => manifestWith((m) => delete m.sides['B']), 'side-missing'],
    [
      'an audio path outside the archive',
      () => manifestWith((m) => (m.sides['A'] = { write_protect: 'intact', audio: { file: '../a.m4a' } })),
      'audio-path-unsafe',
    ],
    [
      'an audio file that is not in the archive',
      () => manifestWith((m) => (m.sides['A'] = recordedSide(10))),
      'audio-file-missing',
    ],
  ])('rejects %s', (_, build, code) => {
    const issues = validate(build());
    expect(issues.hasErrors).toBe(true);
    expect(codes(issues)).toContain(code);
  });

  it('collects every error, not just the first', () => {
    const manifest = manifestWith((m) => {
      m.cassette['id'] = 'nope';
      m.sides['A'] = { write_protect: 'gone', audio: null };
    });
    expect(codes(validate(manifest))).toEqual(['id-invalid', 'write-protect-invalid']);
  });

  it('names the spec section in each message', () => {
    const [issue] = validate(manifestWith((m) => (m.cassette['side_length_seconds'] = 1700))).all;
    expect(issue).toMatchObject({ section: '§5.1', message: 'C60 must be 1800 s per side' });
  });

  it('treats recorded_frames = 0 as a blank side', () => {
    const manifest = manifestWith((m) => (m.sides['A'] = recordedSide(0)));
    expect(validate(manifest).all).toEqual([]);
  });

  it('only warns about malformed optional values', () => {
    const manifest = manifestWith((m) => {
      m.sides['A'] = recordedSide(10, { markers: [{ frame: -1, title: 'Bad' }] });
      (m.sides['A']['audio'] as Record<string, unknown>)['codec'] = 'opus';
      m['appearance'] = { shell: { color: 'purple' } };
      m['artwork'] = { label_a: 'artwork/missing.png' };
    });
    const issues = validate(manifest, { has: (path) => path.startsWith('audio/') });

    expect(issues.errors).toEqual([]);
    expect(codes(issues)).toEqual([
      'marker-invalid',
      'codec-unknown',
      'color-invalid',
      'artwork-path-invalid',
    ]);
  });
});

describe('isSafePath', () => {
  it('accepts relative archive paths', () => {
    expect(isSafePath('audio/side-a.m4a')).toBe(true);
  });

  it.each([
    '/audio/a.m4a',
    'audio\\a.m4a',
    '../a.m4a',
    'audio/./a.m4a',
    'audio//a.m4a',
    'manifest.json',
    'mimetype',
    '',
    42,
  ])('rejects %j', (path) => {
    expect(isSafePath(path)).toBe(false);
  });
});
