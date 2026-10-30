/**
 * Demo page: switches example cassettes and logs the player's events.
 * Everything oTAPE-specific happens inside <otape-player>.
 */

import '../src/register.ts';
import type { OTapePlayerElement } from '../src/index.ts';

const MAX_LOG_ENTRIES = 8;

const player = document.querySelector<OTapePlayerElement>('#player');
const log = document.querySelector<HTMLOListElement>('#log');
const exampleButtons = document.querySelectorAll<HTMLButtonElement>('.examples [data-src]');

if (!player || !log) throw new Error('Demo markup is incomplete');

for (const button of exampleButtons) {
  button.addEventListener('click', () => {
    player.src = button.dataset['src'] ?? '';
    for (const other of exampleButtons) other.setAttribute('aria-pressed', String(other === button));
  });
}

player.addEventListener('otape-load', (event) => {
  const { cassette } = event.detail;
  addLogEntry('otape-load', `${cassette.title || 'Untitled'} · ${cassette.typeLabel}`);
});

player.addEventListener('otape-change', (event) => {
  addLogEntry('otape-change', `${event.detail.mode} · side ${event.detail.side}`);
});

player.addEventListener('otape-error', (event) => {
  const { error } = event.detail;
  addLogEntry('otape-error', error instanceof Error ? error.message : String(error));
});

function addLogEntry(type: string, message: string): void {
  const item = document.createElement('li');
  const name = document.createElement('code');
  name.textContent = type;
  item.append(name, ` ${message}`);
  log?.prepend(item);
  while (log && log.children.length > MAX_LOG_ENTRIES) log.lastElementChild?.remove();
}
