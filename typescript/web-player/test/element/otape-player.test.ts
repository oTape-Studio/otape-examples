import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { defineOTapePlayer, type OTapePlayerElement } from '../../src/element/otape-player-element.ts';
import { DEFAULT_LABELS } from '../../src/element/labels.ts';
import { cassetteBlob, fixtureBlob, minimalManifest } from '../helpers/fixtures.ts';

function mount(attributes: Record<string, string> = {}): OTapePlayerElement {
  const player = document.createElement('otape-player');
  for (const [name, value] of Object.entries(attributes)) player.setAttribute(name, value);
  document.body.append(player);
  return player;
}

function shadow(player: OTapePlayerElement, ref: string): HTMLElement {
  const element = player.shadowRoot?.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
  if (!element) throw new Error(`No element ${ref}`);
  return element;
}

describe('<otape-player>', () => {
  beforeAll(() => {
    defineOTapePlayer();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('starts empty, with the transport disabled', () => {
    const player = mount();

    expect(shadow(player, 'empty').hidden).toBe(false);
    expect(shadow(player, 'display').hidden).toBe(true);
    expect((shadow(player, 'play') as HTMLButtonElement).disabled).toBe(true);
    expect(shadow(player, 'emptyText').textContent).toBe(DEFAULT_LABELS.empty);
  });

  it('offers a file picker when droppable', () => {
    const player = mount({ droppable: '' });
    expect(shadow(player, 'emptyText').textContent).toBe(DEFAULT_LABELS.emptyDroppable);
    expect(shadow(player, 'choose').hidden).toBe(false);
  });

  it('loads a cassette, shows it and announces it', async () => {
    const player = mount();
    const loaded = vi.fn();
    player.addEventListener('otape-load', loaded);

    const cassette = await player.load(fixtureBlob('sample-tones.otape'));

    expect(cassette.title).toBe('Test Tones');
    expect(loaded).toHaveBeenCalledOnce();
    expect(shadow(player, 'title').textContent).toBe('Test Tones · oTAPE examples');
    expect(shadow(player, 'type').textContent).toBe('C46');
    expect(shadow(player, 'protection').textContent).toBe(DEFAULT_LABELS.writeProtect.broken);
    expect((shadow(player, 'play') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows why a file was rejected and reports it', async () => {
    const player = mount();
    const failed = vi.fn();
    player.addEventListener('otape-error', failed);
    const manifest = minimalManifest();
    manifest.cassette['side_length_seconds'] = 1700;

    await expect(player.load(await cassetteBlob(manifest))).rejects.toThrow(
      'C60 must be 1800 s per side (§5.1)',
    );

    const alert = shadow(player, 'alert');
    expect(alert.hidden).toBe(false);
    expect(alert.textContent).toContain('C60 must be 1800 s per side (§5.1)');
    expect(failed).toHaveBeenCalledOnce();
  });

  it('never puts cassette text into the page as markup', async () => {
    const player = mount();
    const manifest = minimalManifest();
    manifest.cassette['title'] = '<img src=x onerror=alert(1)>';

    await player.load(await cassetteBlob(manifest));

    expect(shadow(player, 'title').textContent).toBe('<img src=x onerror=alert(1)>');
    expect(player.shadowRoot?.querySelector('img')).toBeNull();
  });

  it('can be reworded through its labels', () => {
    const player = mount();
    player.labels = { play: 'Odtwórz' };

    expect(shadow(player, 'play').getAttribute('aria-label')).toBe('Odtwórz');
    expect(shadow(player, 'stop').getAttribute('aria-label')).toBe(DEFAULT_LABELS.stop);
  });

  it('winds with the keyboard shortcuts', async () => {
    const player = mount();
    await player.load(fixtureBlob('sample-tones.otape'));

    shadow(player, 'stop').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'l', bubbles: true, composed: true }),
    );
    expect(player.deck.mode).toBe('fast-forward');

    shadow(player, 'stop').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', bubbles: true, composed: true }),
    );
    expect(player.deck.mode).toBe('stopped');
  });
});
