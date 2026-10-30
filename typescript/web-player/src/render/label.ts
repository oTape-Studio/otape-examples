/**
 * The cassette label (§10.3, §10.4, §12.5), drawn in label coordinates.
 *
 * Either the label image of the side, or the procedural label described by
 * `appearance.label`. Both are cut by the keep-out zone, which is always
 * transparent so the reels show through.
 */

import type { Cassette } from '../core/cassette/model.ts';
import { LabelStyle, type Side } from '../core/constants.ts';
import { toCss } from '../util/color.ts';
import { FONT_ROLES, fontSizeForCapHeight, HEAVY_SANS } from './fonts.ts';
import { Label } from './geometry.ts';
import { fontAttributes, svg, uniqueId } from './svg.ts';

/** The third and fourth colours of the gradient style (§10.3). */
const GRADIENT_STOPS = ['#FF5A8C', '#FFD966'] as const;

/** Opacity of each stripe of the stripes style, top to bottom (§10.3). */
const STRIPES: readonly { readonly color: 'accent' | 'ink'; readonly opacity: number }[] = [
  { color: 'accent', opacity: 1 },
  { color: 'accent', opacity: 0.75 },
  { color: 'ink', opacity: 0.85 },
  { color: 'accent', opacity: 0.5 },
];

const KRAFT_FIBRES = 160;
const HAIRLINE = 0.2;
const LETTER_BOX_STROKE = 0.35;
const BADGE_LETTER_SPACING = 0.25;

export interface LabelDrawing {
  readonly element: SVGGElement;
  /** Text that must fit its line once fonts are loaded, with the width it has. */
  readonly fitted: readonly { readonly text: SVGTextElement; readonly width: number }[];
}

/**
 * @param imageUrl  URL of the side's label image, if the cassette has one
 */
export function drawLabel(cassette: Cassette, side: Side, imageUrl: string | null): LabelDrawing {
  const id = uniqueId('label');
  const shapeId = `${id}-shape`;
  const keepOutId = `${id}-keep-out`;

  const defs = svg('defs', {}, [
    svg('clipPath', { id: shapeId }, [labelShape()]),
    svg('mask', { id: keepOutId, maskUnits: 'userSpaceOnUse' }, keepOutMask()),
  ]);

  if (imageUrl) {
    const image = svg('image', {
      href: imageUrl,
      width: Label.width,
      height: Label.height,
      preserveAspectRatio: 'none',
      'clip-path': `url(#${shapeId})`,
    });
    return { element: svg('g', { mask: `url(#${keepOutId})` }, [defs, image]), fitted: [] };
  }

  const { content, fitted } = proceduralLabel(cassette, side, id);
  const element = svg('g', { mask: `url(#${keepOutId})` }, [
    defs,
    svg('g', { 'clip-path': `url(#${shapeId})` }, content),
  ]);
  return { element, fitted };
}

function labelShape(): SVGRectElement {
  return svg('rect', { width: Label.width, height: Label.height, rx: Label.cornerRadius });
}

/** White shows, black hides: the label minus window and hub holes. */
function keepOutMask(): SVGElement[] {
  const { window, holes, holeRadius } = Label.keepOut;
  return [
    svg('rect', { width: Label.width, height: Label.height, fill: '#fff' }),
    svg('rect', { ...window, rx: 1.5, fill: '#000' }),
    ...holes.map((hole) => svg('circle', { cx: hole.x, cy: hole.y, r: holeRadius, fill: '#000' })),
  ];
}

function proceduralLabel(
  cassette: Cassette,
  side: Side,
  id: string,
): { content: SVGElement[]; fitted: LabelDrawing['fitted'] } {
  const { label } = cassette.appearance;
  const ink = toCss(label.ink);
  const face = FONT_ROLES[label.font];

  const titleSize = fontSizeForCapHeight(face, Label.titleLine.capHeight);
  const title = svg(
    'text',
    { x: Label.titleLine.x, y: Label.titleLine.baseline, fill: ink, ...fontAttributes(face, titleSize) },
    [cassette.title],
  );
  const sideTitle = svg(
    'text',
    {
      x: Label.sideTitleLine.x,
      y: Label.sideTitleLine.baseline,
      fill: ink,
      ...fontAttributes(face, titleSize * Label.sideTitleLine.scale),
    },
    [cassette.sides[side].title],
  );

  const content = [
    svg('rect', { width: Label.width, height: Label.height, fill: toCss(label.paper) }),
    ...styleDecoration(cassette, id),
    sideLetter(side, ink),
    title,
    sideTitle,
    typeBadge(cassette),
  ];
  return {
    content,
    fitted: [
      { text: title, width: Label.titleLine.width },
      { text: sideTitle, width: Label.sideTitleLine.width },
    ],
  };
}

function styleDecoration(cassette: Cassette, id: string): SVGElement[] {
  const { style, ink, accent } = cassette.appearance.label;

  switch (style) {
    case LabelStyle.Ruled:
      return [
        svg('rect', { width: Label.width, height: Label.ruledTopRuleHeight, fill: toCss(accent) }),
        ...Label.ruledLines.y.map((y) =>
          svg('line', {
            x1: Label.ruledLines.from,
            x2: Label.ruledLines.to,
            y1: y,
            y2: y,
            stroke: toCss(ink, Label.ruledLines.opacity),
            'stroke-width': HAIRLINE,
          }),
        ),
      ];

    case LabelStyle.Stripes:
      return STRIPES.map((stripe, index) =>
        svg('rect', {
          y: Label.stripes.top + index * Label.stripes.pitch,
          width: Label.width,
          height: Label.stripes.height,
          fill: toCss(stripe.color === 'ink' ? ink : accent, stripe.opacity),
        }),
      );

    case LabelStyle.Gradient: {
      const gradientId = `${id}-gradient`;
      const stops = [accent.hex, ...GRADIENT_STOPS];
      return [
        svg(
          'linearGradient',
          { id: gradientId },
          stops.map((color, index) =>
            svg('stop', { offset: index / (stops.length - 1), 'stop-color': color }),
          ),
        ),
        svg('rect', { ...Label.bottomBand, fill: `url(#${gradientId})` }),
      ];
    }

    case LabelStyle.Kraft:
      return kraftFibres(cassette.id);

    case LabelStyle.Plain:
      return [];
  }
}

/** Fine darker fibres on the paper. Seeded by the cassette id, so a tape always looks the same. */
function kraftFibres(seed: string): SVGElement[] {
  const random = seededRandom(seed);
  return Array.from({ length: KRAFT_FIBRES }, () => {
    const x = random() * Label.width;
    const y = random() * Label.height;
    const length = 1 + random() * 3;
    const angle = (random() - 0.5) * 0.6;
    return svg('line', {
      x1: x,
      y1: y,
      x2: x + Math.cos(angle) * length,
      y2: y + Math.sin(angle) * length,
      stroke: `rgb(60 40 20 / ${0.08 + random() * 0.12})`,
      'stroke-width': 0.08 + random() * 0.12,
      'stroke-linecap': 'round',
    });
  });
}

function sideLetter(side: Side, ink: string): SVGGElement {
  const box = Label.sideLetterBox;
  const size = fontSizeForCapHeight(HEAVY_SANS, Label.sideLetterCapHeight);
  return svg('g', {}, [
    svg('rect', { ...box, rx: 0.6, fill: 'none', stroke: ink, 'stroke-width': LETTER_BOX_STROKE }),
    svg(
      'text',
      {
        x: box.x + box.width / 2,
        y: box.y + (box.height + Label.sideLetterCapHeight) / 2,
        'text-anchor': 'middle',
        fill: ink,
        ...fontAttributes(HEAVY_SANS, size),
      },
      [side],
    ),
  ]);
}

/** Paper colour on the stripes and gradient bands, ink otherwise (§10.4). */
function typeBadge(cassette: Cassette): SVGTextElement {
  const { style, paper, ink } = cassette.appearance.label;
  const onBand = style === LabelStyle.Stripes || style === LabelStyle.Gradient;
  return svg(
    'text',
    {
      x: Label.typeBadge.right,
      y: Label.typeBadge.baseline,
      'text-anchor': 'end',
      'letter-spacing': BADGE_LETTER_SPACING,
      fill: toCss(onBand ? paper : ink),
      ...fontAttributes(HEAVY_SANS, fontSizeForCapHeight(HEAVY_SANS, Label.typeBadge.capHeight)),
    },
    [cassette.typeLabel],
  );
}

/** mulberry32 over a string hash: small, fast and deterministic. */
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++)
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
