/** Small helpers for building SVG with the DOM. */

import type { FontFace } from './fonts.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type Attributes = Readonly<Record<string, string | number | undefined>>;
type Child = SVGElement | string;

/** `svg('rect', { x: 0, width: 10 }, [children])`. Undefined attributes are skipped. */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  children: readonly Child[] = [],
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(name, String(value));
  }
  element.append(...children);
  return element;
}

let nextId = 0;

/** A document-unique id prefix, so several drawings on one page don't share masks. */
export function uniqueId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

/** Text attributes for a font face at a size. */
export function fontAttributes(face: FontFace, size: number): Attributes {
  return {
    'font-family': face.family,
    'font-weight': face.weight,
    'font-size': round(size),
  };
}

/** Round to 0.01 mm: plenty for drawing, and keeps the markup short. */
export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Make text fit a width: shrink it down to `minScale`, then cut it with an
 * ellipsis (§10.4). Needs layout, so call it once the SVG is in the document
 * and fonts have loaded. Does nothing where text can't be measured.
 */
export function fitText(text: SVGTextElement, maxWidth: number, minScale = 0.6): void {
  if (typeof text.getComputedTextLength !== 'function') return;
  const original = text.dataset['text'] ?? text.textContent;
  text.dataset['text'] = original;
  text.textContent = original;

  const baseSize = Number(text.dataset['size'] ?? text.getAttribute('font-size'));
  text.dataset['size'] = String(baseSize);
  text.setAttribute('font-size', String(baseSize));

  const width = text.getComputedTextLength();
  if (width <= maxWidth || width === 0) return;

  const scale = Math.max(minScale, maxWidth / width);
  text.setAttribute('font-size', String(round(baseSize * scale)));
  if (text.getComputedTextLength() <= maxWidth) return;

  let shown = original;
  while (shown.length > 1 && text.getComputedTextLength() > maxWidth) {
    shown = shown.slice(0, -1);
    text.textContent = `${shown.trimEnd()}…`;
  }
}
