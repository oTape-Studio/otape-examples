/**
 * The J-card front (§11.2): the `jcard_front` image, or the procedural cover
 * with title, subtitle, creator, track lists and dedication.
 */

import type { Cassette } from '../core/cassette/model.ts';
import { SIDES } from '../core/constants.ts';
import { toCss } from '../util/color.ts';
import { FONT_ROLES, fontSizeForCapHeight, type FontFace } from './fonts.ts';
import { JCardFront } from './geometry.ts';
import { fitText, fontAttributes, svg } from './svg.ts';

/** Cap heights of §11.2, in mm. */
const CapHeight = {
  title: 5,
  subtitle: 2.4,
  creator: 2.2,
  heading: 2,
  track: 2,
  dedication: 2.6,
} as const;

/** Vertical gap after each kind of line, in mm. */
const LineGap = {
  title: 4,
  subtitle: 3.4,
  section: 2.5,
  heading: 3.6,
  track: 3.4,
} as const;

const SANS: FontFace = { ...FONT_ROLES.sans, weight: 600 };
const SANS_BOLD: FontFace = { ...FONT_ROLES.sans, weight: 800 };

export class JCardView {
  readonly element: SVGSVGElement;
  readonly #fitted: SVGTextElement[] = [];

  constructor(cassette: Cassette, frontImageUrl: string | null = null) {
    const { width, height } = JCardFront;
    const content = frontImageUrl
      ? [svg('image', { href: frontImageUrl, width, height, preserveAspectRatio: 'none' })]
      : this.#procedural(cassette);

    this.element = svg(
      'svg',
      { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'J-card' },
      content,
    );
  }

  /** Fit long lines to the panel. Call once in the document with fonts loaded. */
  layoutText(): void {
    const width = JCardFront.width - 2 * JCardFront.safeInset;
    for (const text of this.#fitted) fitText(text, width);
  }

  #procedural(cassette: Cassette): SVGElement[] {
    const { jcard } = cassette;
    const ink = toCss(jcard.ink);
    const role = FONT_ROLES[jcard.font];
    const x = JCardFront.safeInset;
    const elements: SVGElement[] = [
      svg('rect', { width: JCardFront.width, height: JCardFront.height, fill: toCss(jcard.cardColor) }),
    ];

    let y = JCardFront.safeInset;
    const line = (text: string, face: FontFace, capHeight: number, gap: number, opacity = 1): void => {
      if (!text) return;
      y += capHeight;
      const element = svg(
        'text',
        { x, y, fill: ink, opacity, ...fontAttributes(face, fontSizeForCapHeight(face, capHeight)) },
        [text],
      );
      this.#fitted.push(element);
      elements.push(element);
      y += gap;
    };

    line(jcard.title, role, CapHeight.title, LineGap.title);
    line(jcard.subtitle, SANS, CapHeight.subtitle, LineGap.subtitle, 0.85);
    line(cassette.creator, SANS, CapHeight.creator, LineGap.subtitle, 0.7);

    for (const side of SIDES) {
      const tracks = jcard.tracklist[side];
      if (tracks.length === 0) continue;
      y += LineGap.section;
      line(`SIDE ${side}`, SANS_BOLD, CapHeight.heading, LineGap.heading);
      tracks.forEach((track, index) => {
        line(`${index + 1}. ${track}`, SANS, CapHeight.track, LineGap.track, 0.9);
      });
    }

    if (jcard.dedication) {
      const size = fontSizeForCapHeight(role, CapHeight.dedication);
      const dedication = svg(
        'text',
        { x, y: JCardFront.height - JCardFront.safeInset - 1, fill: ink, ...fontAttributes(role, size) },
        [jcard.dedication],
      );
      this.#fitted.push(dedication);
      elements.push(dedication);
    }
    return elements;
  }
}
