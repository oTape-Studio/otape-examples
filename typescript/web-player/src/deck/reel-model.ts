/**
 * The tape-pack model of Appendix B.3: how much tape is on each reel at a
 * head position, and how far the reels have turned. It drives the drawing
 * of the reels and the three-digit mechanical counter.
 *
 * Lengths are in millimetres, the unit of the drawing.
 */

/** Tape speed: 4.76 cm/s. */
const TAPE_SPEED_MM_PER_SECOND = 47.6;

/** Radius of an empty reel (the hub). */
export const HUB_RADIUS_MM = 11;

/** Tape thickness by side length: thinner tape for longer cassettes. */
const TAPE_THICKNESS: readonly { readonly maxSideSeconds: number; readonly mm: number }[] = [
  { maxSideSeconds: 35 * 60, mm: 0.018 },
  { maxSideSeconds: 50 * 60, mm: 0.012 },
];
const LONG_PLAY_THICKNESS_MM = 0.009;

const COUNTER_MODULUS = 1000;

export interface ReelState {
  /** Radius of the tape pack on the take-up reel (right, as seen). */
  readonly takeUpRadius: number;
  /** Radius of the tape pack on the supply reel (left, as seen). */
  readonly supplyRadius: number;
  /** Turns of the take-up reel since the start of the side. */
  readonly takeUpTurns: number;
  /** Turns of the supply reel since the start of the side. */
  readonly supplyTurns: number;
}

export class ReelModel {
  readonly #tapeLength: number;
  readonly #thickness: number;
  readonly #fullRadius: number;

  constructor(sideSeconds: number) {
    this.#tapeLength = TAPE_SPEED_MM_PER_SECOND * sideSeconds;
    this.#thickness = tapeThickness(sideSeconds);
    this.#fullRadius = this.#packRadius(this.#tapeLength);
  }

  /** Radius of a reel holding the whole tape. About 24.7 mm on a C60. */
  get fullRadius(): number {
    return this.#fullRadius;
  }

  at(headSeconds: number): ReelState {
    const wound = Math.min(this.#tapeLength, Math.max(0, TAPE_SPEED_MM_PER_SECOND * headSeconds));
    const takeUpRadius = this.#packRadius(wound);
    const supplyRadius = this.#packRadius(this.#tapeLength - wound);
    return {
      takeUpRadius,
      supplyRadius,
      takeUpTurns: (takeUpRadius - HUB_RADIUS_MM) / this.#thickness,
      supplyTurns: (this.#fullRadius - supplyRadius) / this.#thickness,
    };
  }

  /** The mechanical counter: take-up revolutions, three digits (Appendix B.3). */
  counter(headSeconds: number): string {
    const turns = Math.floor(this.at(headSeconds).takeUpTurns) % COUNTER_MODULUS;
    return String(turns).padStart(3, '0');
  }

  /** r = √(r₀² + x·t/π) */
  #packRadius(length: number): number {
    return Math.sqrt(HUB_RADIUS_MM ** 2 + (length * this.#thickness) / Math.PI);
  }
}

function tapeThickness(sideSeconds: number): number {
  return TAPE_THICKNESS.find((band) => sideSeconds <= band.maxSideSeconds)?.mm ?? LONG_PLAY_THICKNESS_MM;
}
