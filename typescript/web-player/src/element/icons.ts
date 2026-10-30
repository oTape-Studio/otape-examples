/** Transport icons: 24 × 24 SVG path data, drawn with `currentColor`. */

export const ICONS = {
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  rewind: 'M11 6.5v11L3.5 12zM20.5 6.5v11L13 12z',
  fastForward: 'M13 6.5v11l7.5-5.5zM3.5 6.5v11L11 12z',
  flip: 'M7 4 3 8l4 4V9h10V7H7zm10 8v3H7v2h10v3l4-4z',
  eject: 'M12 5 5 13h14zM5 16h14v3H5z',
  cassette:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2l-1.5-3h-7L7 20H5a2 2 0 0 1-2-2zm5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
} as const;

export type IconName = keyof typeof ICONS;

export function iconMarkup(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
}
