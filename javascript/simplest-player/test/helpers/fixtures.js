/**
 * Shared test data.
 */

import { readFile } from 'node:fs/promises';

/** A minimal valid manifest: a blank C60 (§6.3). Returns a fresh copy. */
export function minimalManifest() {
  return {
    format: 'oTAPE',
    format_version: '1.0',
    cassette: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Night Drive',
      type: 'C60',
      side_length_seconds: 1800,
      created_at: '2026-10-28T22:00:00Z',
    },
    sides: {
      A: { write_protect: 'intact', audio: null },
      B: { write_protect: 'intact', audio: null },
    },
  };
}

/** A manifest copied from otape-spec/examples/manifests. */
export async function specManifest(name) {
  const url = new URL(`../fixtures/manifests/${name}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

/** The bytes of examples/sample-tones.otape as an ArrayBuffer. */
export async function sampleCassette() {
  const bytes = await readFile(new URL('../../examples/sample-tones.otape', import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** Stands in for AudioOutput: decodes to a fake buffer and records calls. */
export class FakeOutput {
  calls = [];

  async decode(bytes) {
    return { byteLength: bytes.byteLength };
  }

  play(buffer, offset, duration) {
    this.calls.push({ method: 'play', offset, duration });
  }

  stop() {
    this.calls.push({ method: 'stop' });
  }
}

/** Stands in for localStorage. */
export class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.get(key) ?? null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}
