/**
 * Static markup of <otape-player>. Cassette data never goes into this
 * string: it is set later with `textContent`, so a manifest can't inject
 * markup into the page.
 */

import { iconMarkup } from './icons.ts';

export const TEMPLATE = /* html */ `
<div class="player" part="player">
  <div class="stage" part="stage" data-ref="stage">
    <div class="cassette" part="cassette" data-ref="cassette"></div>
    <div class="empty" part="empty" data-ref="empty">
      ${iconMarkup('cassette')}
      <p data-ref="emptyText"></p>
      <button type="button" class="choose" data-ref="choose"></button>
      <input type="file" accept=".otape,application/vnd.otape.cassette" data-ref="fileInput" hidden>
    </div>
  </div>

  <p class="alert" role="alert" data-ref="alert" hidden></p>

  <div class="display" part="display" data-ref="display" hidden>
    <div class="row">
      <span class="counter" data-ref="counter" role="img">000</span>
      <span class="title" data-ref="title"></span>
      <span class="badge" data-ref="type"></span>
      <span class="badge" data-ref="side"></span>
    </div>
    <div class="row meta">
      <span data-ref="sideTitle"></span>
      <span class="spacer"></span>
      <span data-ref="protection"></span>
    </div>
    <div class="tapemap" role="slider" tabindex="0" aria-valuemin="0" data-ref="tapemap">
      <div class="tapemap__recorded" data-ref="recorded"></div>
      <div data-ref="markerTicks"></div>
      <div class="tapemap__head" data-ref="head"></div>
    </div>
    <div class="row">
      <span class="time" data-ref="time">0:00</span>
      <span class="status" data-ref="status" aria-live="polite"></span>
      <span class="spacer"></span>
      <span class="time" data-ref="remaining"></span>
    </div>
    <div class="now" data-ref="now" aria-live="polite"></div>
  </div>

  <div class="transport" part="transport" role="toolbar" data-ref="transport">
    <button type="button" class="key" data-action="rewind" data-ref="rewind">${iconMarkup('rewind')}</button>
    <button type="button" class="key" data-action="play" data-ref="play">${iconMarkup('play')}</button>
    <button type="button" class="key" data-action="stop" data-ref="stop">${iconMarkup('stop')}</button>
    <button type="button" class="key" data-action="fastForward" data-ref="fastForward">${iconMarkup('fastForward')}</button>
    <button type="button" class="key" data-action="flip" data-ref="flip">${iconMarkup('flip')}</button>
    <button type="button" class="key" data-action="eject" data-ref="eject">${iconMarkup('eject')}</button>
    <label class="volume">
      <span data-ref="volumeLabel"></span>
      <input type="range" min="0" max="1" step="0.01" value="1" data-ref="volume">
    </label>
  </div>

  <details class="info" part="info" data-ref="info" hidden>
    <summary data-ref="about"></summary>
    <div class="info__body">
      <div class="jcard" data-ref="jcard"></div>
      <div>
        <section data-ref="descriptionSection"><p data-ref="description"></p></section>
        <section data-ref="markersSection">
          <h3 data-ref="markersHeading"></h3>
          <ul class="markers" data-ref="markers"></ul>
        </section>
        <section data-ref="rightsSection">
          <h3 data-ref="rightsHeading"></h3>
          <p data-ref="copyright"></p>
          <p><a data-ref="license" target="_blank" rel="noopener noreferrer"></a></p>
          <button type="button" class="link-button" data-ref="showLicense"></button>
          <pre class="license" data-ref="licenseText" hidden></pre>
        </section>
        <section data-ref="warningsSection">
          <h3 data-ref="warningsHeading"></h3>
          <ul class="warnings" data-ref="warnings"></ul>
        </section>
      </div>
    </div>
  </details>
</div>
`;

/** Every `data-ref` in the template, with its element type. */
export interface Refs {
  readonly stage: HTMLDivElement;
  readonly cassette: HTMLDivElement;
  readonly empty: HTMLDivElement;
  readonly emptyText: HTMLParagraphElement;
  readonly choose: HTMLButtonElement;
  readonly fileInput: HTMLInputElement;
  readonly alert: HTMLParagraphElement;
  readonly display: HTMLDivElement;
  readonly counter: HTMLSpanElement;
  readonly title: HTMLSpanElement;
  readonly type: HTMLSpanElement;
  readonly side: HTMLSpanElement;
  readonly sideTitle: HTMLSpanElement;
  readonly protection: HTMLSpanElement;
  readonly tapemap: HTMLDivElement;
  readonly recorded: HTMLDivElement;
  readonly markerTicks: HTMLDivElement;
  readonly head: HTMLDivElement;
  readonly time: HTMLSpanElement;
  readonly status: HTMLSpanElement;
  readonly remaining: HTMLSpanElement;
  readonly now: HTMLDivElement;
  readonly transport: HTMLDivElement;
  readonly rewind: HTMLButtonElement;
  readonly play: HTMLButtonElement;
  readonly stop: HTMLButtonElement;
  readonly fastForward: HTMLButtonElement;
  readonly flip: HTMLButtonElement;
  readonly eject: HTMLButtonElement;
  readonly volumeLabel: HTMLSpanElement;
  readonly volume: HTMLInputElement;
  readonly info: HTMLDetailsElement;
  readonly about: HTMLElement;
  readonly jcard: HTMLDivElement;
  readonly descriptionSection: HTMLElement;
  readonly description: HTMLParagraphElement;
  readonly markersSection: HTMLElement;
  readonly markersHeading: HTMLHeadingElement;
  readonly markers: HTMLUListElement;
  readonly rightsSection: HTMLElement;
  readonly rightsHeading: HTMLHeadingElement;
  readonly copyright: HTMLParagraphElement;
  readonly license: HTMLAnchorElement;
  readonly showLicense: HTMLButtonElement;
  readonly licenseText: HTMLPreElement;
  readonly warningsSection: HTMLElement;
  readonly warningsHeading: HTMLHeadingElement;
  readonly warnings: HTMLUListElement;
}

/** Collect the `data-ref` elements of a rendered template. */
export function collectRefs(root: ParentNode): Refs {
  const refs: Record<string, Element> = {};
  for (const element of root.querySelectorAll('[data-ref]')) {
    refs[(element as HTMLElement).dataset['ref'] ?? ''] = element;
  }
  return refs as unknown as Refs;
}
