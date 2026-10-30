/**
 * Demo page: UI glue around the Player. No oTAPE logic lives here.
 *
 * @module demo/app
 */

import { Mode, Player, PlayerEvent, formatTime } from '../src/index.js';
import {
  CONTROL_LABELS,
  MESSAGES,
  MODE_LABELS,
  SEPARATOR,
  WRITE_PROTECT_LABELS,
} from './labels.js';

const EXAMPLE_URL = 'examples/sample-tones.otape';

/**
 * Transport buttons in display order. `action` is the Player method to call;
 * `mode`, when set, lights the button while the deck is in that mode.
 */
const CONTROLS = Object.freeze([
  { action: 'rewind', mode: Mode.REWIND },
  { action: 'play', mode: Mode.PLAY },
  { action: 'stop', mode: Mode.STOP },
  { action: 'fastForward', mode: Mode.FAST_FORWARD },
  { action: 'flip' },
  { action: 'eject' },
]);

const player = new Player();

const dom = {
  fileInput: document.getElementById('file-input'),
  dropZone: document.getElementById('drop-zone'),
  exampleButton: document.getElementById('example-button'),
  error: document.getElementById('error'),
  deck: document.getElementById('deck'),
  title: document.getElementById('title'),
  details: document.getElementById('details'),
  status: document.getElementById('status'),
  time: document.getElementById('time'),
  progress: document.getElementById('progress'),
  nowPlaying: document.getElementById('now-playing'),
  controls: document.getElementById('controls'),
};

/** @type {Map<string, HTMLButtonElement>} buttons keyed by the mode they show */
const modeButtons = new Map();

/* ----- opening files ----- */

/** @param {ArrayBuffer} buffer */
async function openCassette(buffer) {
  hideError();
  try {
    await player.load(buffer);
  } catch (error) {
    showError(MESSAGES.openFailed(error.message));
  }
}

/** @param {File | undefined} file */
async function openFile(file) {
  if (file) await openCassette(await file.arrayBuffer());
}

/** fetch() only works when the page is served over HTTP. */
async function openExample() {
  try {
    const response = await fetch(EXAMPLE_URL);
    if (!response.ok) throw new Error(response.statusText);
    await openCassette(await response.arrayBuffer());
  } catch {
    showError(MESSAGES.exampleUnavailable);
  }
}

function bindFileInputs() {
  dom.fileInput.addEventListener('change', () => openFile(dom.fileInput.files[0]));
  dom.exampleButton.addEventListener('click', openExample);

  dom.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dom.dropZone.classList.add('is-over');
  });
  dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('is-over'));
  dom.dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dom.dropZone.classList.remove('is-over');
    openFile(event.dataTransfer.files[0]);
  });
}

/* ----- controls ----- */

function renderControls() {
  for (const { action, mode } of CONTROLS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = CONTROL_LABELS[action];
    button.addEventListener('click', () => player[action]());
    if (mode) modeButtons.set(mode, button);
    dom.controls.append(button);
  }
}

/* ----- display ----- */

/** Things that change with the cassette, side or mode. */
function renderCassette() {
  const { cassette, currentSide: side } = player;
  dom.deck.hidden = !cassette;
  if (!cassette) return;

  dom.title.textContent = MESSAGES.byCreator(cassette.title, cassette.creator);
  dom.details.textContent = joinParts([
    cassette.typeLabel,
    MESSAGES.side(side.letter, side.title),
    side.recordedSeconds ? MESSAGES.recorded(formatTime(side.recordedSeconds)) : MESSAGES.blankSide,
    !side.playable && MESSAGES.codecUnsupported(side.codec),
  ]);
  dom.status.textContent = joinParts([MODE_LABELS[player.mode], WRITE_PROTECT_LABELS[side.writeProtect]]);

  for (const [mode, button] of modeButtons) {
    button.setAttribute('aria-pressed', String(mode === player.mode));
  }
}

/** Things that change as the tape moves, redrawn on every animation frame. */
function renderHead() {
  if (player.cassette) {
    const { head, sideSeconds, currentMarker } = player;
    dom.time.textContent = MESSAGES.position(formatTime(head), formatTime(sideSeconds));
    dom.progress.value = head / sideSeconds;
    dom.nowPlaying.textContent = nowPlayingText(currentMarker);
  }
  requestAnimationFrame(renderHead);
}

function nowPlayingText(marker) {
  if (player.onBlankTape) return MESSAGES.blankTape;
  return marker ? MESSAGES.nowPlaying(marker.title) : '';
}

function joinParts(parts) {
  return parts.filter(Boolean).join(SEPARATOR);
}

function showError(text) {
  dom.error.textContent = text;
  dom.error.hidden = false;
}

function hideError() {
  dom.error.hidden = true;
}

/* ----- start ----- */

renderControls();
bindFileInputs();
player.addEventListener(PlayerEvent.CHANGE, renderCassette);
requestAnimationFrame(renderHead);
