/**
 * Builds public/examples/demo-tape.otape: a short custom cassette with
 * synthesised music on both sides, track markers, a procedural look and a
 * J-card, and no images, to show what a player draws on its own.
 *
 *   npm run make:demo
 *
 * Needs macOS for `afconvert`, which encodes the AAC-LC audio (§7.3).
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeZip } from '../tools/zip-writer.ts';

const RATE = 44100;
const SIDE_SECONDS = 150;
const OUTPUT = new URL('../public/examples/demo-tape.otape', import.meta.url);

interface Piece {
  readonly title: string;
  readonly seconds: number;
  /** Root frequencies of the chords, one chord per bar. */
  readonly chords: readonly number[];
  readonly tempo: number;
  readonly brightness: number;
}

const A = 220;
const semitone = (root: number, steps: number): number => root * 2 ** (steps / 12);

const SIDE_A: readonly Piece[] = [
  {
    title: 'Morning Signal',
    seconds: 26,
    chords: [semitone(A, 3), semitone(A, -2), semitone(A, 0), semitone(A, -4)],
    tempo: 104,
    brightness: 0.8,
  },
  {
    title: 'Slow Orbit',
    seconds: 30,
    chords: [semitone(A, -5), semitone(A, -1), semitone(A, -3), semitone(A, 2)],
    tempo: 72,
    brightness: 0.45,
  },
];

const SIDE_B: readonly Piece[] = [
  {
    title: 'Night Shift',
    seconds: 34,
    chords: [semitone(A, 0), semitone(A, 5), semitone(A, 3), semitone(A, -2)],
    tempo: 88,
    brightness: 0.6,
  },
];

const GAP_SECONDS = 2.5;

/* -------------------------------------------------------------------------- */

function synthesise(pieces: readonly Piece[]): {
  samples: Float32Array[];
  markers: { frame: number; title: string }[];
} {
  const total = pieces.reduce((sum, piece) => sum + piece.seconds, 0) + GAP_SECONDS * pieces.length;
  const left = new Float32Array(Math.round(total * RATE));
  const right = new Float32Array(left.length);
  const markers: { frame: number; title: string }[] = [];

  let start = Math.round(0.8 * RATE);
  for (const piece of pieces) {
    markers.push({ frame: start, title: piece.title });
    renderPiece(piece, left, right, start);
    start += Math.round((piece.seconds + GAP_SECONDS) * RATE);
  }
  return { samples: [left, right], markers };
}

function renderPiece(piece: Piece, left: Float32Array, right: Float32Array, offset: number): void {
  const beat = 60 / piece.tempo;
  const bar = beat * 4;
  const length = Math.round(piece.seconds * RATE);

  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const chord = piece.chords[Math.floor(t / bar) % piece.chords.length]!;
    const fade = Math.min(1, t / 1.5, (piece.seconds - t) / 2);

    // Pad: a soft major-seventh chord.
    let pad = 0;
    for (const interval of [0, 4, 7, 11]) {
      const f = semitone(chord, interval);
      pad += Math.sin(2 * Math.PI * f * t) + 0.3 * piece.brightness * Math.sin(4 * Math.PI * f * t);
    }
    pad *= 0.05;

    // Arpeggio: one note per eighth, plucked.
    const step = Math.floor(t / (beat / 2));
    const noteTime = t - step * (beat / 2);
    const note = semitone(chord * 2, [0, 7, 12, 4, 11, 7][step % 6]!);
    const pluck = Math.sin(2 * Math.PI * note * t) * Math.exp(-noteTime * 6) * 0.16;

    // Bass on every beat.
    const beatTime = t % beat;
    const bass = Math.sin(2 * Math.PI * (chord / 2) * t) * Math.exp(-beatTime * 3) * 0.22;

    const pan = 0.5 + 0.35 * Math.sin(step * 1.7);
    const index = offset + i;
    if (index >= left.length) break;
    left[index] = fade * (pad + bass + pluck * (1 - pan));
    right[index] = fade * (pad + bass + pluck * pan);
  }
}

function wav(channels: readonly Float32Array[]): Uint8Array {
  const frames = channels[0]!.length;
  const bytes = new DataView(new ArrayBuffer(44 + frames * channels.length * 2));
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) bytes.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  bytes.setUint32(4, 36 + frames * channels.length * 2, true);
  ascii(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, channels.length, true);
  bytes.setUint32(24, RATE, true);
  bytes.setUint32(28, RATE * channels.length * 2, true);
  bytes.setUint16(32, channels.length * 2, true);
  bytes.setUint16(34, 16, true);
  ascii(36, 'data');
  bytes.setUint32(40, frames * channels.length * 2, true);
  for (let i = 0; i < frames; i++) {
    channels.forEach((channel, c) => {
      const value = Math.max(-1, Math.min(1, channel[i]!));
      bytes.setInt16(44 + (i * channels.length + c) * 2, value * 0x7fff, true);
    });
  }
  return new Uint8Array(bytes.buffer);
}

function encodeAac(channels: readonly Float32Array[], directory: string, name: string): Uint8Array {
  const input = join(directory, `${name}.wav`);
  const output = join(directory, `${name}.m4a`);
  writeFileSync(input, wav(channels));
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '256000', input, output]);
  return readFileSync(output);
}

/* -------------------------------------------------------------------------- */

const directory = mkdtempSync(join(tmpdir(), 'otape-demo-'));
try {
  const sideA = synthesise(SIDE_A);
  const sideB = synthesise(SIDE_B);

  const audio = (side: ReturnType<typeof synthesise>, file: string) => ({
    file,
    codec: 'aac-lc',
    sample_rate: RATE,
    channels: 2,
    bit_rate: 256000,
    recorded_frames: side.samples[0]!.length,
    duration_seconds: Math.round((side.samples[0]!.length / RATE) * 1000) / 1000,
  });

  const manifest = {
    format: 'oTAPE',
    format_version: '1.0',
    cassette: {
      id: 'd3a1f0c2-5b7e-4c1a-9e2f-6a8b0c4d2e19',
      serial_number: 'OT-DEMO-01',
      title: 'Demo Tape',
      creator: 'oTAPE examples',
      description:
        'A short custom cassette with synthesised music on both sides. Everything you see is drawn from the manifest: there are no images in this file.',
      genre: 'Synthesised',
      type: 'custom',
      side_length_seconds: SIDE_SECONDS,
      timeline_rate: RATE,
      created_at: '2026-10-30T12:00:00Z',
      created_with: 'otape-examples make-demo-cassette',
      rights: {
        copyright: 'oTAPE examples',
        license: 'CC0-1.0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        file: 'docs/license.txt',
      },
    },
    sides: {
      A: {
        title: 'Daylight',
        write_protect: 'broken',
        audio: audio(sideA, 'audio/side-a.m4a'),
        markers: sideA.markers.map((marker) => ({ ...marker, kind: 'track' })),
      },
      B: {
        title: 'After Dark',
        write_protect: 'intact',
        audio: audio(sideB, 'audio/side-b.m4a'),
        markers: sideB.markers.map((marker) => ({ ...marker, kind: 'track' })),
      },
    },
    appearance: {
      preset: 'sunset',
      shell: { color: '#7A2E8E99', finish: 'transparent' },
      label: { style: 'gradient', paper: '#1C1033', ink: '#FFE8A3', accent: '#FF8A3D', font: 'stencil' },
    },
    jcard: {
      card_color: '#1C1033',
      ink: '#FFE8A3',
      font: 'stencil',
      front: { title: 'Demo Tape', subtitle: 'synthesised in TypeScript' },
      spine: { text: 'DEMO TAPE · oTAPE' },
      tracklist: { A: SIDE_A.map((piece) => piece.title), B: SIDE_B.map((piece) => piece.title) },
      dedication: 'For everyone building an oTAPE player.',
    },
    history: [
      { type: 'created', timestamp: '2026-10-30T12:00:00Z' },
      { type: 'write_protect_changed', timestamp: '2026-10-30T12:05:00Z', side: 'A', state: 'broken' },
    ],
  };

  const zip = await writeZip([
    { name: 'mimetype', data: 'application/vnd.otape.cassette' },
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2), deflate: true },
    { name: 'audio/side-a.m4a', data: encodeAac(sideA.samples, directory, 'side-a') },
    { name: 'audio/side-b.m4a', data: encodeAac(sideB.samples, directory, 'side-b') },
    {
      name: 'docs/license.txt',
      data: 'Demo Tape by oTAPE examples is dedicated to the public domain under CC0 1.0.\n',
      deflate: true,
    },
  ]);
  writeFileSync(OUTPUT, zip);
  console.log(`Wrote ${OUTPUT.pathname} (${zip.length} bytes)`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
