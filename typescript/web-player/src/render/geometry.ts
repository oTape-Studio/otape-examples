/**
 * Physical geometry of oTAPE 1.0, in millimetres (§11, §12, Appendix B).
 * Origin at the top-left of each object, x to the right, y down, cassette
 * upright with the head opening at the bottom.
 *
 * Mirrors `geometry/otape-geometry-1.0.json` of the specification.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

/** The cassette face (§12.4). */
export const Shell = {
  width: 100.4,
  height: 63.8,
  cornerRadius: 3.5,
  window: { x: 30.2, y: 21.5, width: 40.0, height: 12.0 },
  windowCornerRadius: 1.5,
  leftHub: { x: 29.0, y: 27.5 },
  rightHub: { x: 71.4, y: 27.5 },
  hubHoleRadius: 8.5,
  driveHubRadius: 6.0,
  headOpening: [
    { x: 17.0, y: 63.8 },
    { x: 23.6, y: 49.5 },
    { x: 76.8, y: 49.5 },
    { x: 83.4, y: 63.8 },
  ],
  screwRadius: 1.2,
  screws: [
    { x: 3.0, y: 3.0 },
    { x: 97.4, y: 3.0 },
    { x: 3.0, y: 60.8 },
    { x: 97.4, y: 60.8 },
    { x: 50.2, y: 52.6 },
  ],
  labelOrigin: { x: 5.7, y: 3.5 },
} as const;

/** The label, in label coordinates (§10.4, §12.5). */
export const Label = {
  width: 89.0,
  height: 42.0,
  cornerRadius: 2.0,
  /** Window and hub holes grown by 0.5 mm: always transparent. */
  keepOut: {
    window: { x: 24.0, y: 17.5, width: 41.0, height: 13.0 },
    holes: [
      { x: 23.3, y: 24.0 },
      { x: 65.7, y: 24.0 },
    ],
    holeRadius: 9.0,
  },
  sideLetterBox: { x: 2.5, y: 3.0, width: 6.5, height: 8.0 },
  sideLetterCapHeight: 4.5,
  titleLine: { x: 11.0, baseline: 9.5, width: 75.5, capHeight: 4.0 },
  sideTitleLine: { x: 11.0, baseline: 14.0, width: 75.5, scale: 0.65 },
  bottomBand: { x: 0, y: 33.0, width: 89.0, height: 9.0 },
  typeBadge: { right: 86.5, baseline: 38.8, capHeight: 2.6 },
  ruledLines: { y: [10.5, 15.5, 31.5], from: 11.0, to: 86.5, opacity: 0.25 },
  ruledTopRuleHeight: 2.2,
  stripes: { top: 33.0, height: 1.6, pitch: 2.2 },
} as const;

/** The J-card front panel (§11.2). */
export const JCardFront = {
  width: 63.5,
  height: 101.6,
  safeInset: 3.0,
} as const;
