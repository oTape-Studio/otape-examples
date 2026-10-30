/** Shared test data and fakes. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeZip, type ZipInput } from '../../tools/zip-writer.ts';
import type { PlaybackOutput } from '../../src/deck/playback-output.ts';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

/** A file from test/fixtures as a Blob. */
export function fixtureBlob(name: string): Blob {
  return new Blob([readFileSync(join(FIXTURES, name))]);
}

/** A manifest from test/fixtures/manifests (copied from otape-spec). */
export function specManifest(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, 'manifests', name), 'utf8')) as unknown;
}

export interface TestManifest {
  format: string;
  format_version: string;
  cassette: Record<string, unknown>;
  sides: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

/** A minimal valid manifest: a blank C60 (§6.3). A fresh copy on every call. */
export function minimalManifest(): TestManifest {
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

/** A recorded side A for a manifest: `seconds` of AAC at 44.1 kHz. */
export function recordedSide(seconds: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    write_protect: 'intact',
    audio: { file: 'audio/side-a.m4a', codec: 'aac-lc', recorded_frames: seconds * 44100 },
    ...extra,
  };
}

/** A cassette archive with a manifest and optional extra entries. */
export async function cassetteBlob(manifest: unknown, extra: readonly ZipInput[] = []): Promise<Blob> {
  const zip = await writeZip([
    { name: 'mimetype', data: 'application/vnd.otape.cassette' },
    { name: 'manifest.json', data: JSON.stringify(manifest), deflate: true },
    ...extra,
  ]);
  return new Blob([zip as Uint8Array<ArrayBuffer>]);
}

/** A PlaybackOutput that records calls. `play` resolves when `release()` is called, if held. */
export class FakeOutput implements PlaybackOutput {
  readonly calls: string[] = [];
  loaded: Blob | null = null;
  volume = 1;
  playable = true;
  #held: (() => void) | null = null;
  holdPlay = false;

  canPlay(): boolean {
    return this.playable;
  }

  load(audio: Blob | null): void {
    this.loaded = audio;
    this.calls.push(audio ? `load:${audio.size}` : 'load:null');
  }

  play(fromSeconds: number): Promise<void> {
    this.calls.push(`play:${fromSeconds.toFixed(1)}`);
    if (!this.holdPlay) return Promise.resolve();
    return new Promise((resolve) => (this.#held = resolve));
  }

  release(): void {
    this.#held?.();
    this.#held = null;
  }

  pause(): void {
    this.calls.push('pause');
  }

  dispose(): void {
    this.calls.push('dispose');
  }
}
