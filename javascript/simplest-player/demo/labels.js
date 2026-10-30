/**
 * Every text the demo shows, in one place, so it can be reworded or
 * translated without touching the logic.
 *
 * @module demo/labels
 */

import { Mode, WriteProtect } from '../src/index.js';

/** Transport button captions, keyed by Player method. */
export const CONTROL_LABELS = Object.freeze({
  rewind: '◀◀ Rew',
  play: '▶ Play',
  stop: '■ Stop',
  fastForward: 'FF ▶▶',
  flip: 'Flip',
  eject: 'Eject',
});

/** What the deck is doing. */
export const MODE_LABELS = Object.freeze({
  [Mode.STOP]: 'Stopped',
  [Mode.PLAY]: 'Playing',
  [Mode.FAST_FORWARD]: 'Fast forward',
  [Mode.REWIND]: 'Rewinding',
});

/** State of the side's record tab (§8.1). */
export const WRITE_PROTECT_LABELS = Object.freeze({
  [WriteProtect.INTACT]: 'Record tab intact',
  [WriteProtect.BROKEN]: 'Write-protected',
  [WriteProtect.TAPED_OVER]: 'Tab taped over',
});

/** Text built from values. */
export const MESSAGES = Object.freeze({
  openFailed: (reason) => `Cannot open this cassette: ${reason}`,
  exampleUnavailable: 'Could not fetch the example. Serve this folder over HTTP, or choose the file above.',
  byCreator: (title, creator) => (creator ? `${title} · ${creator}` : title),
  side: (letter, title) => (title ? `Side ${letter}: ${title}` : `Side ${letter}`),
  recorded: (time) => `${time} recorded`,
  blankSide: 'Blank side',
  codecUnsupported: (codec) => `${codec} is not supported by this browser`,
  position: (head, length) => `${head} / ${length}`,
  nowPlaying: (title) => `Now: ${title}`,
  blankTape: 'Blank tape',
});

/** Joins the parts of a status line. */
export const SEPARATOR = ' · ';
