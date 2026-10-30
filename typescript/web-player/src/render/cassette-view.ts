/**
 * The cassette face, drawn back to front as in §12.3:
 *
 *   1. mechanism: tape packs and drive hubs, animated from the head position
 *   2. shell: the face image, or the procedural shell of `appearance.shell`
 *   3. label: the label image, or the procedural label
 *   4. glass: a subtle reflection over the window
 *
 * The view is built once per cassette side. {@link CassetteView.update}
 * then only moves the reels, so it is cheap to call on every frame.
 */

import type { Cassette } from '../core/cassette/model.ts';
import { ShellFinish, type Side } from '../core/constants.ts';
import type { ReelState } from '../deck/reel-model.ts';
import { toCss } from '../util/color.ts';
import { fitText } from './svg.ts';
import { Shell, type Point } from './geometry.ts';
import { drawLabel, type LabelDrawing } from './label.ts';
import { round, svg, uniqueId } from './svg.ts';

const Colors = {
  tape: '#3a2a20',
  tapeSheen: '#5a4232',
  hub: '#f2f0ea',
  hubShadow: '#c9c5bb',
  hubHole: '#1a1a1a',
  screw: '#8d8d8d',
  interior: '#141414',
} as const;

const HUB_TEETH = 6;
const HUB_BORE_RADIUS = 3.6;
const TAPE_PATH_Y = 60.6;
const HEAD_OPENING_SHADE = 0.35;
const GLASS_HIGHLIGHT = 0.22;

export interface CassetteArtworkUrls {
  /** `cassette_face_a` or `_b` of the side shown. */
  readonly face?: string | null;
  /** `label_a` or `_b` of the side shown. */
  readonly label?: string | null;
}

interface Reel {
  readonly pack: SVGCircleElement;
  readonly hub: SVGGElement;
  readonly center: Point;
}

export class CassetteView {
  readonly element: SVGSVGElement;
  readonly #left: Reel;
  readonly #right: Reel;
  readonly #label: LabelDrawing;

  constructor(cassette: Cassette, side: Side, artwork: CassetteArtworkUrls = {}) {
    const id = uniqueId('cassette');
    this.#left = createReel(Shell.leftHub);
    this.#right = createReel(Shell.rightHub);
    this.#label = drawLabel(cassette, side, artwork.label ?? null);

    this.element = svg(
      'svg',
      {
        viewBox: `0 0 ${Shell.width} ${Shell.height}`,
        role: 'img',
        'aria-label': `${cassette.title || 'Cassette'}, side ${side}`,
      },
      [
        drawMechanism(this.#left, this.#right),
        drawShell(cassette, artwork.face ?? null, id),
        svg('g', { transform: `translate(${Shell.labelOrigin.x} ${Shell.labelOrigin.y})` }, [
          this.#label.element,
        ]),
        drawGlass(id),
      ],
    );
  }

  /** Move the reels to the head position. */
  update(reels: ReelState): void {
    // Seen from the front, the tape runs from the left reel to the right one.
    updateReel(this.#left, reels.supplyRadius, reels.supplyTurns);
    updateReel(this.#right, reels.takeUpRadius, reels.takeUpTurns);
  }

  /** Fit label text to its lines. Call once the view is in the document and fonts are loaded. */
  layoutText(): void {
    for (const { text, width } of this.#label.fitted) fitText(text, width);
  }
}

/* -------------------------------------------------------------------------- */
/* Layers                                                                     */
/* -------------------------------------------------------------------------- */

function drawMechanism(left: Reel, right: Reel): SVGGElement {
  const tapeTop = Math.min(left.center.y, right.center.y);
  return svg('g', { 'aria-hidden': 'true' }, [
    svg('rect', { width: Shell.width, height: Shell.height, rx: Shell.cornerRadius, fill: Colors.interior }),
    left.pack,
    right.pack,
    // The tape running past the head, seen through the head opening.
    svg('path', {
      d: `M ${left.center.x - 14} ${tapeTop} L 17.6 ${TAPE_PATH_Y} H 82.8 L ${right.center.x + 14} ${tapeTop}`,
      fill: 'none',
      stroke: Colors.tape,
      'stroke-width': 0.6,
    }),
    left.hub,
    right.hub,
  ]);
}

function drawShell(cassette: Cassette, faceUrl: string | null, id: string): SVGGElement {
  if (faceUrl) {
    return svg('g', {}, [
      svg('image', { href: faceUrl, width: Shell.width, height: Shell.height, preserveAspectRatio: 'none' }),
    ]);
  }

  const { color, finish } = cassette.appearance.shell;
  const maskId = `${id}-shell-cutouts`;
  const { window } = Shell;
  const headOpening = Shell.headOpening.map((point) => `${point.x},${point.y}`).join(' ');

  return svg('g', {}, [
    svg('mask', { id: maskId, maskUnits: 'userSpaceOnUse' }, [
      svg('rect', { width: Shell.width, height: Shell.height, fill: '#fff' }),
      svg('rect', { ...window, rx: Shell.windowCornerRadius, fill: '#000' }),
      ...[Shell.leftHub, Shell.rightHub].map((hub) =>
        svg('circle', { cx: hub.x, cy: hub.y, r: Shell.hubHoleRadius, fill: '#000' }),
      ),
    ]),
    svg('rect', {
      width: Shell.width,
      height: Shell.height,
      rx: Shell.cornerRadius,
      fill: toCss(color),
      mask: `url(#${maskId})`,
    }),
    // An opaque shell keeps a moulded edge; a transparent one shows its outline.
    svg('rect', {
      x: 0.3,
      y: 0.3,
      width: Shell.width - 0.6,
      height: Shell.height - 0.6,
      rx: Shell.cornerRadius - 0.3,
      fill: 'none',
      stroke: finish === ShellFinish.Transparent ? 'rgb(255 255 255 / 0.25)' : 'rgb(0 0 0 / 0.25)',
      'stroke-width': 0.6,
    }),
    svg('polygon', { points: headOpening, fill: `rgb(0 0 0 / ${HEAD_OPENING_SHADE})` }),
    svg('rect', {
      ...window,
      rx: Shell.windowCornerRadius,
      fill: 'none',
      stroke: 'rgb(0 0 0 / 0.35)',
      'stroke-width': 0.4,
    }),
    ...Shell.screws.map(drawScrew),
  ]);
}

function drawScrew(center: Point): SVGGElement {
  const r = Shell.screwRadius;
  return svg('g', { 'aria-hidden': 'true' }, [
    svg('circle', { cx: center.x, cy: center.y, r, fill: Colors.screw }),
    svg('path', {
      d: `M ${center.x - r * 0.6} ${center.y} H ${center.x + r * 0.6} M ${center.x} ${center.y - r * 0.6} V ${center.y + r * 0.6}`,
      stroke: 'rgb(0 0 0 / 0.45)',
      'stroke-width': 0.25,
    }),
  ]);
}

function drawGlass(id: string): SVGGElement {
  const gradientId = `${id}-glass`;
  return svg('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }, [
    svg('linearGradient', { id: gradientId, x1: 0, y1: 0, x2: 0.4, y2: 1 }, [
      svg('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': GLASS_HIGHLIGHT }),
      svg('stop', { offset: 0.45, 'stop-color': '#fff', 'stop-opacity': 0.04 }),
      svg('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }),
    ]),
    svg('rect', { ...Shell.window, rx: Shell.windowCornerRadius, fill: `url(#${gradientId})` }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Reels                                                                      */
/* -------------------------------------------------------------------------- */

function createReel(center: Point): Reel {
  const pack = svg('circle', {
    cx: center.x,
    cy: center.y,
    r: Shell.driveHubRadius,
    fill: Colors.tape,
    stroke: Colors.tapeSheen,
    'stroke-width': 0.3,
  });

  const teeth = Array.from({ length: HUB_TEETH }, (_, index) =>
    svg('rect', {
      x: center.x - 0.5,
      y: center.y - HUB_BORE_RADIUS - 0.1,
      width: 1,
      height: 1.4,
      fill: Colors.hub,
      transform: `rotate(${(360 / HUB_TEETH) * index} ${center.x} ${center.y})`,
    }),
  );
  const hub = svg('g', {}, [
    svg('circle', {
      cx: center.x,
      cy: center.y,
      r: Shell.driveHubRadius,
      fill: Colors.hub,
      stroke: Colors.hubShadow,
      'stroke-width': 0.3,
    }),
    svg('circle', { cx: center.x, cy: center.y, r: HUB_BORE_RADIUS, fill: Colors.hubHole }),
    ...teeth,
  ]);

  return { pack, hub, center };
}

function updateReel(reel: Reel, packRadius: number, turns: number): void {
  reel.pack.setAttribute('r', String(round(packRadius)));
  const degrees = round((turns * 360) % 360);
  reel.hub.setAttribute('transform', `rotate(${degrees} ${reel.center.x} ${reel.center.y})`);
}
