import { describe, expect, it } from 'vitest';
import { describeCassette } from '../../src/core/cassette/describe.ts';
import type { Manifest } from '../../src/core/manifest/types.ts';
import { drawLabel } from '../../src/render/label.ts';
import { minimalManifest } from '../helpers/fixtures.ts';

function label(appearance: Record<string, unknown>): SVGGElement {
  const manifest = minimalManifest();
  manifest['appearance'] = { label: appearance };
  const cassette = describeCassette(manifest as unknown as Manifest, () => true);
  return drawLabel(cassette, 'A', null).element;
}

const badgeFill = (element: SVGGElement): string | null =>
  [...element.querySelectorAll('text')].at(-1)?.getAttribute('fill') ?? null;

describe('drawLabel (§10.3)', () => {
  it('ruled: an accent rule on top and three hairlines', () => {
    const element = label({ style: 'ruled', accent: '#C8102E' });
    expect(element.querySelectorAll('line')).toHaveLength(3);
    expect(element.querySelector('rect[height="2.2"]')?.getAttribute('fill')).toBe('rgb(200 16 46 / 1)');
  });

  it('gradient: accent → #FF5A8C → #FFD966 across the bottom band', () => {
    const element = label({ style: 'gradient', accent: '#FF8A3D' });
    const stops = [...element.querySelectorAll('stop')].map((stop) => stop.getAttribute('stop-color'));
    expect(stops).toEqual(['#ff8a3d', '#FF5A8C', '#FFD966']);
  });

  it('kraft: the same fibres for the same cassette', () => {
    const fibres = (element: SVGGElement): string[] =>
      [...element.querySelectorAll('line')].map((line) => line.getAttribute('x1') ?? '');
    const first = label({ style: 'kraft' });
    expect(first.querySelectorAll('line').length).toBeGreaterThan(100);
    expect(fibres(first)).toEqual(fibres(label({ style: 'kraft' })));
  });

  it('prints the type badge in paper colour on a band, in ink otherwise (§10.4)', () => {
    expect(badgeFill(label({ style: 'stripes', paper: '#FAFAF5' }))).toBe('rgb(250 250 245 / 1)');
    expect(badgeFill(label({ style: 'plain', ink: '#202020' }))).toBe('rgb(32 32 32 / 1)');
  });

  it('always cuts the keep-out zone, even from an image (§12.5)', () => {
    const manifest = minimalManifest();
    const cassette = describeCassette(manifest as unknown as Manifest, () => true);
    const { element } = drawLabel(cassette, 'A', 'blob:label');

    expect(element.getAttribute('mask')).toMatch(/^url\(#label-\d+-keep-out\)$/);
    expect(element.querySelectorAll('mask circle')).toHaveLength(2);
  });
});
