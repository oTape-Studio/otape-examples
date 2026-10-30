/**
 * Lettering roles (§10.5). oTAPE names a role, not a typeface, so each role
 * maps to a font stack: the open alternative the specification names first,
 * then the macOS reference face, then a generic family.
 *
 * Load the open fonts on the page (see {@link FONT_STYLESHEET_URL}) to get
 * the intended look everywhere; without them the stacks fall back gracefully.
 */

import type { FontRole } from '../core/constants.ts';

export interface FontFace {
  readonly family: string;
  readonly weight: number;
  /** Cap height as a fraction of the font size, to size text by cap height. */
  readonly capHeight: number;
}

export const FONT_ROLES: Readonly<Record<FontRole, FontFace>> = {
  marker: { family: "'Permanent Marker', 'Marker Felt', cursive", weight: 400, capHeight: 0.74 },
  pen: { family: "'Caveat', 'Noteworthy', cursive", weight: 700, capHeight: 0.62 },
  typewriter: {
    family: "'Special Elite', 'American Typewriter', 'Courier New', monospace",
    weight: 400,
    capHeight: 0.7,
  },
  sans: {
    family: "'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
    weight: 700,
    capHeight: 0.73,
  },
  serif: { family: "'Libre Baskerville', Baskerville, Georgia, serif", weight: 400, capHeight: 0.7 },
  stencil: {
    family: "'Big Shoulders Stencil Display', 'Futura Condensed ExtraBold', Impact, sans-serif",
    weight: 800,
    capHeight: 0.72,
  },
};

/** Heavy sans for side letters and type badges (§10.4). */
export const HEAVY_SANS: FontFace = { ...FONT_ROLES.sans, weight: 800 };

/** Google Fonts stylesheet with the open alternatives of every role. */
export const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@800&family=Caveat:wght@700' +
  '&family=Inter:wght@400;600;700;800&family=Libre+Baskerville&family=Permanent+Marker&family=Special+Elite' +
  '&display=swap';

/** Font size that gives `face` the requested cap height. */
export function fontSizeForCapHeight(face: FontFace, capHeight: number): number {
  return capHeight / face.capHeight;
}
