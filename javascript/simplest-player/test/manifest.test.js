import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErrorCode, isSafePath, validateManifest } from '../src/index.js';
import { minimalManifest, specManifest } from './helpers/fixtures.js';

const anyEntry = () => true;
const noEntry = () => false;

/** Minimal manifest with one change applied. */
function manifestWith(change) {
  const manifest = minimalManifest();
  change(manifest);
  return manifest;
}

describe('validateManifest', () => {
  it('accepts the minimal manifest', () => {
    assert.doesNotThrow(() => validateManifest(minimalManifest(), noEntry));
  });

  describe('the example manifests of the specification', () => {
    for (const name of ['manifest-minimal.json', 'manifest-full.json', 'manifest-custom-48k.json']) {
      it(`accepts ${name}`, async () => {
        const manifest = await specManifest(name);
        assert.doesNotThrow(() => validateManifest(manifest, anyEntry));
      });
    }

    const invalid = {
      'invalid-overlong-side.json': ErrorCode.RECORDED_FRAMES_TOO_LONG,
      'invalid-rights-html.json': ErrorCode.RIGHTS_FILE_INVALID,
      'invalid-write-protect.json': ErrorCode.WRITE_PROTECT_INVALID,
    };
    for (const [name, code] of Object.entries(invalid)) {
      it(`rejects ${name}`, async () => {
        const manifest = await specManifest(name);
        assert.throws(() => validateManifest(manifest, anyEntry), { code });
      });
    }
  });

  const cases = [
    ['a root that is not an object', () => [], ErrorCode.MANIFEST_NOT_OBJECT],
    ['another format', () => manifestWith((m) => { m.format = 'otape'; }), ErrorCode.NOT_OTAPE],
    ['a malformed version', () => manifestWith((m) => { m.format_version = '1'; }), ErrorCode.VERSION_INVALID],
    ['a newer major version', () => manifestWith((m) => { m.format_version = '2.0'; }), ErrorCode.VERSION_UNSUPPORTED],
    ['an id that is not a UUID', () => manifestWith((m) => { m.cassette.id = 'tape-1'; }), ErrorCode.ID_INVALID],
    ['a type with the wrong side length', () => manifestWith((m) => { m.cassette.side_length_seconds = 1700; }), ErrorCode.SIDE_LENGTH_MISMATCH],
    ['an unknown type', () => manifestWith((m) => { m.cassette.type = 'C200'; }), ErrorCode.TYPE_UNKNOWN],
    ['a custom side that is too long', () => manifestWith((m) => {
      m.cassette.type = 'custom';
      m.cassette.side_length_seconds = 5401;
    }), ErrorCode.CUSTOM_LENGTH_OUT_OF_RANGE],
    ['an unknown timeline rate', () => manifestWith((m) => { m.cassette.timeline_rate = 96000; }), ErrorCode.TIMELINE_RATE_INVALID],
    ['a missing side', () => manifestWith((m) => { delete m.sides.B; }), ErrorCode.SIDE_MISSING],
    ['an audio path outside the archive', () => manifestWith((m) => {
      m.sides.A.audio = { file: '../side-a.m4a', codec: 'aac-lc', recorded_frames: 10 };
    }), ErrorCode.AUDIO_PATH_UNSAFE],
    ['an audio file that is not in the archive', () => manifestWith((m) => {
      m.sides.A.audio = { file: 'audio/side-a.m4a', codec: 'aac-lc', recorded_frames: 10 };
    }), ErrorCode.AUDIO_FILE_MISSING],
  ];

  for (const [description, build, code] of cases) {
    it(`rejects ${description}`, () => {
      assert.throws(() => validateManifest(build(), noEntry), { code });
    });
  }

  it('names the spec section in the message', () => {
    const manifest = manifestWith((m) => { m.cassette.side_length_seconds = 1700; });
    assert.throws(() => validateManifest(manifest, noEntry), {
      section: '§5.1',
      message: 'C60 must be 1800 s per side (§5.1)',
    });
  });

  it('treats recorded_frames = 0 as a blank side', () => {
    const manifest = manifestWith((m) => {
      m.sides.A.audio = { file: 'audio/side-a.m4a', codec: 'aac-lc', recorded_frames: 0 };
    });
    assert.doesNotThrow(() => validateManifest(manifest, noEntry));
  });
});

describe('isSafePath', () => {
  it('accepts relative archive paths', () => {
    assert.equal(isSafePath('audio/side-a.m4a'), true);
  });

  for (const path of ['/audio/a.m4a', 'audio\\a.m4a', '../a.m4a', 'audio/./a.m4a', 'audio//a.m4a', 'manifest.json', 'mimetype', '']) {
    it(`rejects ${JSON.stringify(path)}`, () => {
      assert.equal(isSafePath(path), false);
    });
  }
});
