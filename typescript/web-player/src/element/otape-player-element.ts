/**
 * <otape-player>: an embeddable oTAPE player.
 *
 *   <script type="module" src="otape-player/register.js"></script>
 *   <otape-player src="night-drive.otape" droppable></otape-player>
 *
 * Attributes
 *   src        URL of a cassette to load
 *   droppable  accept cassettes dropped on the player or chosen with a file picker
 *
 * Events (all bubble and cross the shadow boundary)
 *   otape-load    a cassette was inserted       detail: { cassette }
 *   otape-error   opening or playback failed    detail: { error }
 *   otape-change  side or transport changed     detail: { mode, side }
 *
 * Keyboard (while focus is inside the player)
 *   K play/stop · J rewind · L fast forward · F flip
 */

import { CassetteFile } from '../core/cassette/cassette-file.ts';
import type { Cassette } from '../core/cassette/model.ts';
import { ArtworkSlot, type Side } from '../core/constants.ts';
import { describeIssue, OTapeError } from '../core/issues.ts';
import { Deck, DeckErrorCode, Mode, type DeckError } from '../deck/deck.ts';
import { CassetteView } from '../render/cassette-view.ts';
import { JCardView } from '../render/jcard-view.ts';
import { formatTime } from '../util/time.ts';
import { DEFAULT_LABELS, type PlayerLabels } from './labels.ts';
import { STYLES } from './styles.ts';
import { collectRefs, TEMPLATE, type Refs } from './template.ts';

export interface OTapePlayerEventMap {
  'otape-load': CustomEvent<{ readonly cassette: Cassette }>;
  'otape-error': CustomEvent<{ readonly error: unknown }>;
  'otape-change': CustomEvent<{ readonly mode: Mode; readonly side: Side }>;
}

type TransportAction = 'play' | 'stop' | 'rewind' | 'fastForward' | 'flip' | 'eject';

/** Keyboard shortcuts, by `KeyboardEvent.key` in lower case. */
const SHORTCUTS: Readonly<Record<string, TransportAction | 'toggle'>> = {
  k: 'toggle',
  j: 'rewind',
  l: 'fastForward',
  f: 'flip',
};

/** Share of a side the tape map moves per arrow key. */
const TAPEMAP_KEY_STEP = 0.05;
const FLIP_ANIMATION_MS = 280;

const ARTWORK_BY_SIDE = {
  A: { face: ArtworkSlot.CassetteFaceA, label: ArtworkSlot.LabelA },
  B: { face: ArtworkSlot.CassetteFaceB, label: ArtworkSlot.LabelB },
} as const satisfies Record<Side, { face: ArtworkSlot; label: ArtworkSlot }>;

export class OTapePlayerElement extends HTMLElement {
  static readonly observedAttributes = ['src', 'droppable'];

  /** The deck inside. Use it for anything the buttons don't cover. */
  readonly deck = new Deck();

  readonly #refs: Refs;
  #labels: PlayerLabels = DEFAULT_LABELS;
  #view: CassetteView | null = null;
  #viewKey = '';
  #artworkUrls = new Map<ArtworkSlot, string>();
  #frame = 0;
  #loads = 0;
  #subscriptions: (() => void)[] = [];

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const style = document.createElement('style');
    style.textContent = STYLES;
    const template = document.createElement('template');
    template.innerHTML = TEMPLATE;
    root.append(style, template.content.cloneNode(true));
    this.#refs = collectRefs(root);
    this.#bindControls();
    this.#renderLabels();
  }

  /* ------------------------------------------------------------------------ */
  /* Public API                                                               */
  /* ------------------------------------------------------------------------ */

  get src(): string {
    return this.getAttribute('src') ?? '';
  }

  set src(value: string) {
    this.setAttribute('src', value);
  }

  get droppable(): boolean {
    return this.hasAttribute('droppable');
  }

  set droppable(value: boolean) {
    this.toggleAttribute('droppable', value);
  }

  /** The inserted cassette, or `null`. */
  get cassette(): Cassette | null {
    return this.deck.cassette;
  }

  get labels(): PlayerLabels {
    return this.#labels;
  }

  /** Replace some or all texts. Missing ones keep their defaults. */
  set labels(labels: Partial<PlayerLabels>) {
    this.#labels = { ...DEFAULT_LABELS, ...labels };
    this.#renderLabels();
    this.#renderState();
  }

  /**
   * Insert a cassette from a File, a Blob or a URL. Resolves with the
   * cassette; rejects with an {@link OTapeError} for an invalid file.
   */
  async load(source: Blob | string | URL): Promise<Cassette> {
    const load = ++this.#loads;
    this.#showAlert(null);
    this.#refs.emptyText.textContent = this.#labels.loading;
    try {
      const file =
        typeof source === 'string' || source instanceof URL
          ? await CassetteFile.fetch(new URL(source, document.baseURI))
          : await CassetteFile.open(source);
      if (load !== this.#loads) return file.cassette;

      await this.deck.insert(file);
      this.#dispatch('otape-load', { cassette: file.cassette });
      return file.cassette;
    } catch (error) {
      if (load === this.#loads) {
        this.#showAlert(
          this.#labels.openFailed,
          error instanceof OTapeError ? error.issues.map(describeIssue) : [],
        );
        this.#renderState();
        this.#dispatch('otape-error', { error });
      }
      throw error;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Lifecycle                                                                */
  /* ------------------------------------------------------------------------ */

  connectedCallback(): void {
    this.#subscriptions = [
      this.deck.on('change', () => {
        this.#renderState();
        this.#dispatch('otape-change', { mode: this.deck.mode, side: this.deck.side });
      }),
      this.deck.on('error', (error) => {
        this.#showDeckError(error);
        this.#dispatch('otape-error', { error });
      }),
    ];
    this.#renderState();
  }

  disconnectedCallback(): void {
    this.deck.stop();
    for (const unsubscribe of this.#subscriptions) unsubscribe();
    this.#subscriptions = [];
    cancelAnimationFrame(this.#frame);
  }

  attributeChangedCallback(name: string, previous: string | null, value: string | null): void {
    if (name === 'src' && value && value !== previous) {
      // Failures are shown in the player and reported as otape-error.
      this.load(value).catch(() => undefined);
    }
    if (name === 'droppable') this.#renderLabels();
  }

  /* ------------------------------------------------------------------------ */
  /* Input                                                                    */
  /* ------------------------------------------------------------------------ */

  #bindControls(): void {
    const refs = this.#refs;

    for (const button of refs.transport.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      button.addEventListener('click', () => {
        this.#perform(button.dataset['action'] as TransportAction);
      });
    }

    refs.volume.addEventListener('input', () => {
      this.deck.volume = refs.volume.valueAsNumber;
    });

    refs.choose.addEventListener('click', () => {
      refs.fileInput.click();
    });
    refs.fileInput.addEventListener('change', () => {
      const file = refs.fileInput.files?.[0];
      refs.fileInput.value = '';
      if (file) this.load(file).catch(() => undefined);
    });

    refs.stage.addEventListener('dragover', (event) => {
      if (!this.droppable) return;
      event.preventDefault();
      refs.stage.classList.add('drag-over');
    });
    refs.stage.addEventListener('dragleave', () => {
      refs.stage.classList.remove('drag-over');
    });
    refs.stage.addEventListener('drop', (event) => {
      refs.stage.classList.remove('drag-over');
      if (!this.droppable) return;
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) this.load(file).catch(() => undefined);
    });

    refs.tapemap.addEventListener('pointerdown', (event) => {
      const box = refs.tapemap.getBoundingClientRect();
      if (box.width > 0) this.deck.cue(((event.clientX - box.left) / box.width) * this.deck.sideSeconds);
    });
    refs.tapemap.addEventListener('keydown', (event) => {
      this.#onTapemapKey(event);
    });

    refs.showLicense.addEventListener('click', () => {
      void this.#showLicense();
    });

    this.shadowRoot?.addEventListener('keydown', (event) => {
      this.#onShortcut(event as KeyboardEvent);
    });
  }

  #perform(action: TransportAction | 'toggle'): void {
    const deck = this.deck;
    switch (action) {
      case 'toggle':
        if (deck.mode === Mode.Stopped) void deck.play();
        else deck.stop();
        return;
      case 'play':
      case 'flip':
        void deck[action]();
        return;
      default:
        deck[action]();
    }
  }

  #onShortcut(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLInputElement) return;
    const action = SHORTCUTS[event.key.toLowerCase()];
    if (!action || !this.deck.cassette) return;
    event.preventDefault();
    this.#perform(action);
  }

  /** The tape map is a slider: keys wind the tape there, as clicking does. */
  #onTapemapKey(event: KeyboardEvent): void {
    const { sideSeconds, head } = this.deck;
    const step = sideSeconds * TAPEMAP_KEY_STEP;
    const targets: Readonly<Record<string, number>> = {
      ArrowLeft: head - step,
      ArrowDown: head - step,
      ArrowRight: head + step,
      ArrowUp: head + step,
      Home: 0,
      End: sideSeconds,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.deck.cue(Math.min(sideSeconds, Math.max(0, target)));
  }

  /* ------------------------------------------------------------------------ */
  /* Rendering                                                                */
  /* ------------------------------------------------------------------------ */

  /** Texts that only change with the labels. */
  #renderLabels(): void {
    const refs = this.#refs;
    const labels = this.#labels;
    const buttons: Readonly<Record<TransportAction, HTMLButtonElement>> = {
      play: refs.play,
      stop: refs.stop,
      rewind: refs.rewind,
      fastForward: refs.fastForward,
      flip: refs.flip,
      eject: refs.eject,
    };
    for (const [action, button] of Object.entries(buttons)) {
      const label = labels[action as TransportAction];
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    refs.transport.setAttribute('aria-label', 'Transport');
    refs.counter.setAttribute('aria-label', labels.counter);
    refs.tapemap.setAttribute('aria-label', labels.tape);
    refs.volumeLabel.textContent = labels.volume;
    refs.emptyText.textContent = this.droppable ? labels.emptyDroppable : labels.empty;
    refs.choose.textContent = labels.chooseFile;
    refs.choose.hidden = !this.droppable;
    refs.about.textContent = labels.about;
    refs.markersHeading.textContent = labels.markers;
    refs.rightsHeading.textContent = labels.rights;
    refs.showLicense.textContent = labels.showLicense;
    refs.warningsHeading.textContent = labels.warnings;
  }

  /** Everything that changes with the cassette, side or mode. */
  #renderState(): void {
    const { deck } = this;
    const refs = this.#refs;
    const cassette = deck.cassette;
    const loaded = cassette !== null;

    refs.empty.hidden = loaded;
    refs.display.hidden = !loaded;
    refs.info.hidden = !loaded;
    for (const button of [refs.play, refs.stop, refs.rewind, refs.fastForward, refs.flip, refs.eject]) {
      button.disabled = !loaded;
    }

    const pressed: Readonly<Record<Mode, HTMLButtonElement>> = {
      [Mode.Playing]: refs.play,
      [Mode.Stopped]: refs.stop,
      [Mode.FastForward]: refs.fastForward,
      [Mode.Rewinding]: refs.rewind,
    };
    for (const [mode, button] of Object.entries(pressed)) {
      button.setAttribute('aria-pressed', String(mode === deck.mode && mode !== Mode.Stopped));
    }

    if (!cassette) {
      this.#clearCassette();
      return;
    }

    const side = cassette.sides[deck.side];
    const labels = this.#labels;
    refs.title.textContent = [cassette.title || labels.untitled, cassette.creator]
      .filter(Boolean)
      .join(' · ');
    refs.type.textContent = cassette.typeLabel;
    refs.side.textContent = deck.side;
    refs.side.title = labels.side(deck.side);
    refs.sideTitle.textContent = [
      side.title,
      side.recordedSeconds > 0 ? labels.recorded(formatTime(side.recordedSeconds)) : labels.blankSide,
    ]
      .filter(Boolean)
      .join(' · ');
    refs.protection.textContent = labels.writeProtect[side.writeProtect];
    refs.status.textContent = labels.modes[deck.mode];

    refs.recorded.style.width = percent(side.recordedSeconds / cassette.sideSeconds);
    refs.tapemap.setAttribute('aria-valuemax', String(Math.round(cassette.sideSeconds)));

    void this.#renderCassette(cassette);
    this.#renderFrame();
    if (deck.mode !== Mode.Stopped) this.#startAnimation();
  }

  /** Things that move with the tape, once per animation frame while it runs. */
  #renderFrame(): void {
    const { deck } = this;
    const refs = this.#refs;
    const cassette = deck.cassette;
    if (!cassette) return;

    const head = deck.head;
    refs.counter.textContent = deck.counter;
    refs.time.textContent = formatTime(head);
    refs.remaining.textContent = this.#labels.remaining(formatTime(cassette.sideSeconds - head));
    refs.head.style.left = percent(head / cassette.sideSeconds);
    refs.tapemap.setAttribute('aria-valuenow', String(Math.round(head)));
    refs.tapemap.setAttribute('aria-valuetext', formatTime(head));

    const marker = deck.currentMarker;
    refs.now.textContent = deck.onBlankTape ? this.#labels.blankTape : (marker?.title ?? '');
    for (const item of refs.markers.querySelectorAll<HTMLButtonElement>('button')) {
      item.setAttribute('aria-current', String(item.dataset['title'] === marker?.title && !deck.onBlankTape));
    }

    const reels = deck.reels;
    if (reels) this.#view?.update(reels);
  }

  #startAnimation(): void {
    cancelAnimationFrame(this.#frame);
    const tick = (): void => {
      this.#renderFrame();
      if (this.deck.mode !== Mode.Stopped) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  /** Rebuild the drawing when the cassette or side changes. */
  async #renderCassette(cassette: Cassette): Promise<void> {
    const side = this.deck.side;
    const key = `${cassette.id}:${side}`;
    if (key === this.#viewKey) return;
    const previousKey = this.#viewKey;
    this.#viewKey = key;

    const sameCassette = previousKey.startsWith(`${cassette.id}:`);
    if (!sameCassette) {
      this.#revokeArtwork();
      await this.#loadArtwork();
      if (this.#viewKey !== key) return;
      this.#renderDetails(cassette);
    }

    const artwork = ARTWORK_BY_SIDE[side];
    const view = new CassetteView(cassette, side, {
      face: this.#artworkUrls.get(artwork.face) ?? null,
      label: this.#artworkUrls.get(artwork.label) ?? null,
    });

    const container = this.#refs.cassette;
    if (sameCassette && !prefersReducedMotion()) {
      container.classList.add('is-flipping');
      await delay(FLIP_ANIMATION_MS);
      if (this.#viewKey !== key) return;
    }
    container.replaceChildren(view.element);
    container.classList.remove('is-flipping');
    this.#view = view;
    this.#renderMarkerTicks(cassette);
    this.#renderFrame();

    await fontsReady();
    view.layoutText();
  }

  #renderMarkerTicks(cassette: Cassette): void {
    const { markers } = cassette.sides[this.deck.side];
    this.#refs.markerTicks.replaceChildren(
      ...markers.map((marker) => {
        const tick = document.createElement('div');
        tick.className = 'tapemap__marker';
        tick.style.left = percent(marker.seconds / cassette.sideSeconds);
        tick.title = marker.title;
        return tick;
      }),
    );
    this.#renderMarkerList(cassette);
  }

  #renderMarkerList(cassette: Cassette): void {
    const refs = this.#refs;
    const { markers } = cassette.sides[this.deck.side];
    refs.markersSection.hidden = markers.length === 0;
    refs.markers.replaceChildren(
      ...markers.map((marker) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset['title'] = marker.title;
        button.setAttribute('aria-label', this.#labels.windTo(marker.title));
        const time = document.createElement('time');
        time.textContent = formatTime(marker.seconds);
        const title = document.createElement('span');
        title.textContent = marker.title;
        button.append(time, title);
        button.addEventListener('click', () => {
          this.deck.cue(marker.seconds);
        });
        const item = document.createElement('li');
        item.append(button);
        return item;
      }),
    );
  }

  /** Details that only change with the cassette. */
  #renderDetails(cassette: Cassette): void {
    const refs = this.#refs;

    const jcard = new JCardView(cassette, this.#artworkUrls.get(ArtworkSlot.JCardFront) ?? null);
    refs.jcard.replaceChildren(jcard.element);
    void fontsReady().then(() => {
      jcard.layoutText();
    });

    refs.description.textContent = cassette.description;
    refs.descriptionSection.hidden = !cassette.description;

    const rights = cassette.rights;
    refs.rightsSection.hidden = !rights;
    refs.copyright.textContent = rights?.copyright ?? '';
    refs.license.textContent = rights?.license ?? '';
    const url = safeHttpUrl(rights?.licenseUrl);
    if (url) refs.license.href = url;
    else refs.license.removeAttribute('href');
    refs.license.hidden = !rights?.license;
    refs.showLicense.hidden = !rights?.file;
    refs.licenseText.hidden = true;

    refs.warningsSection.hidden = cassette.warnings.length === 0;
    refs.warnings.replaceChildren(
      ...cassette.warnings.map((issue) => {
        const item = document.createElement('li');
        item.textContent = describeIssue(issue);
        return item;
      }),
    );
  }

  /** The licence file is plain text or Markdown and is shown as text, never as HTML (§6.4, §17). */
  async #showLicense(): Promise<void> {
    const text = await this.deck.file?.licenseText();
    this.#refs.licenseText.textContent = text ?? '';
    this.#refs.licenseText.hidden = !text;
  }

  async #loadArtwork(): Promise<void> {
    const file = this.deck.file;
    if (!file) return;
    const slots = Object.keys(file.cassette.artwork) as ArtworkSlot[];
    const images = await Promise.all(
      slots.map(async (slot) => [slot, await file.artwork(slot).catch(() => null)] as const),
    );
    for (const [slot, blob] of images) {
      if (blob) this.#artworkUrls.set(slot, URL.createObjectURL(blob));
    }
  }

  #revokeArtwork(): void {
    for (const url of this.#artworkUrls.values()) URL.revokeObjectURL(url);
    this.#artworkUrls = new Map();
  }

  #clearCassette(): void {
    cancelAnimationFrame(this.#frame);
    this.#revokeArtwork();
    this.#view = null;
    this.#viewKey = '';
    this.#refs.cassette.replaceChildren();
    this.#refs.jcard.replaceChildren();
    this.#refs.info.open = false;
    this.#renderLabels();
  }

  #showDeckError(error: DeckError): void {
    this.#showAlert(
      error.code === DeckErrorCode.Unplayable ? this.#labels.unplayable : this.#labels.playbackFailed,
    );
  }

  #showAlert(message: string | null, details: readonly string[] = []): void {
    const alert = this.#refs.alert;
    alert.hidden = message === null;
    alert.replaceChildren();
    if (message === null) return;
    alert.append(message);
    if (details.length > 0) {
      const list = document.createElement('ul');
      list.append(
        ...details.map((detail) => {
          const item = document.createElement('li');
          item.textContent = detail;
          return item;
        }),
      );
      alert.append(list);
    }
  }

  #dispatch<K extends keyof OTapePlayerEventMap>(type: K, detail: OTapePlayerEventMap[K]['detail']): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'otape-player': OTapePlayerElement;
  }
  interface HTMLElementEventMap {
    'otape-load': OTapePlayerEventMap['otape-load'];
    'otape-error': OTapePlayerEventMap['otape-error'];
    'otape-change': OTapePlayerEventMap['otape-change'];
  }
}

/** Register the element. Safe to call more than once. */
export function defineOTapePlayer(tagName = 'otape-player'): void {
  if (!customElements.get(tagName)) customElements.define(tagName, class extends OTapePlayerElement {});
}

function percent(fraction: number): string {
  return `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(3)}%`;
}

/** Only http(s) links from a manifest become clickable. */
function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Text is measured once web fonts have loaded, where the platform can tell. */
function fontsReady(): Promise<unknown> {
  return 'fonts' in document ? document.fonts.ready : Promise.resolve();
}

function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
