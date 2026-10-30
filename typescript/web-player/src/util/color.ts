/** sRGB colours of the form `#RRGGBB` or `#RRGGBBAA` (§10.2). */

const COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

export interface Color {
  /** `#rrggbb`, lowercase, without alpha: usable in CSS and SVG. */
  readonly hex: string;
  /** 0 (transparent) … 1 (opaque). */
  readonly alpha: number;
}

export function isColor(value: unknown): value is string {
  return typeof value === 'string' && COLOR.test(value);
}

/** Parse a colour, or return `fallback` parsed if `value` is not a valid colour. */
export function parseColor(value: unknown, fallback: string): Color {
  const source = isColor(value) ? value : fallback;
  const alpha = source.length === 9 ? parseInt(source.slice(7), 16) / 255 : 1;
  return { hex: source.slice(0, 7).toLowerCase(), alpha };
}

/** The colour as a CSS `rgb()` with alpha, optionally multiplied by `opacity`. */
export function toCss(color: Color, opacity = 1): string {
  const channel = (index: number): number => parseInt(color.hex.slice(index, index + 2), 16);
  const alpha = Math.round(color.alpha * opacity * 1000) / 1000;
  return `rgb(${channel(1)} ${channel(3)} ${channel(5)} / ${alpha})`;
}
