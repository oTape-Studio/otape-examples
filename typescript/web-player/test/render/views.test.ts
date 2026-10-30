import { describe, expect, it } from 'vitest';
import { describeCassette } from '../../src/core/cassette/describe.ts';
import type { Cassette } from '../../src/core/cassette/model.ts';
import type { Manifest } from '../../src/core/manifest/types.ts';
import { ReelModel } from '../../src/deck/reel-model.ts';
import { CassetteView } from '../../src/render/cassette-view.ts';
import { JCardView } from '../../src/render/jcard-view.ts';
import { minimalManifest, recordedSide, type TestManifest } from '../helpers/fixtures.ts';

function cassette(change: (manifest: TestManifest) => void = () => undefined): Cassette {
  const manifest = minimalManifest();
  change(manifest);
  return describeCassette(manifest as unknown as Manifest, () => true);
}

const texts = (element: Element): string[] =>
  [...element.querySelectorAll('text')].map((text) => text.textContent);

describe('CassetteView', () => {
  it('draws the procedural label: side letter, title, side title and type (§10.4)', () => {
    const view = new CassetteView(
      cassette((m) => (m.sides['B'] = { write_protect: 'intact', audio: null, title: 'Inbound' })),
      'B',
    );

    expect(texts(view.element)).toEqual(['B', 'Night Drive', 'Inbound', 'C60']);
    expect(view.element.getAttribute('aria-label')).toBe('Night Drive, side B');
  });

  it('draws four stripes for the stripes style (§10.3)', () => {
    const view = new CassetteView(
      cassette((m) => (m['appearance'] = { label: { style: 'stripes', accent: '#E4572E' } })),
      'A',
    );
    const stripes = [...view.element.querySelectorAll('rect')].filter(
      (rect) => rect.getAttribute('height') === '1.6',
    );
    expect(stripes).toHaveLength(4);
  });

  it('uses label and face images instead of drawing them (§12.3)', () => {
    const view = new CassetteView(cassette(), 'A', { face: 'blob:face', label: 'blob:label' });
    const images = [...view.element.querySelectorAll('image')].map((image) => image.getAttribute('href'));

    expect(images).toEqual(['blob:face', 'blob:label']);
    expect(texts(view.element)).toEqual([]);
  });

  it('moves the reels with the tape packs (Appendix B.3)', () => {
    const view = new CassetteView(cassette(), 'A');
    const reels = new ReelModel(1800);
    view.update(reels.at(0));

    const radii = [...view.element.querySelectorAll('circle')]
      .map((circle) => Number(circle.getAttribute('r')))
      .filter((r) => r > 10);
    expect(radii).toEqual([Math.round(reels.fullRadius * 100) / 100, 11]);
  });

  it('draws the shell in the appearance colour with its alpha (§10.1)', () => {
    const view = new CassetteView(
      cassette((m) => (m['appearance'] = { shell: { color: '#3A3F478C', finish: 'transparent' } })),
      'A',
    );
    const fills = [...view.element.querySelectorAll('rect')].map((rect) => rect.getAttribute('fill'));
    expect(fills).toContain('rgb(58 63 71 / 0.549)');
  });
});

describe('JCardView', () => {
  it('draws title, subtitle, track lists and dedication (§11.2)', () => {
    const view = new JCardView(
      cassette((m) => {
        m.sides['A'] = recordedSide(10);
        m['jcard'] = {
          front: { subtitle: 'a mixtape' },
          tracklist: { A: ['Intro', 'Midnight City'], B: [] },
          dedication: 'For everyone still awake.',
        };
      }),
    );

    expect(texts(view.element)).toEqual([
      'Night Drive',
      'a mixtape',
      'SIDE A',
      '1. Intro',
      '2. Midnight City',
      'For everyone still awake.',
    ]);
  });

  it('shows the front image when there is one', () => {
    const view = new JCardView(cassette(), 'blob:front');
    expect(view.element.querySelector('image')?.getAttribute('href')).toBe('blob:front');
  });
});
