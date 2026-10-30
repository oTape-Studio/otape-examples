// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HUB_RADIUS_MM, ReelModel } from '../../src/deck/reel-model.ts';

describe('ReelModel (Appendix B.3)', () => {
  const c60 = new ReelModel(1800);

  it('gives a full C60 pack a radius of about 24.7 mm', () => {
    expect(c60.fullRadius).toBeCloseTo(24.7, 1);
  });

  it('moves the tape from the supply reel to the take-up reel', () => {
    expect(c60.at(0)).toMatchObject({
      takeUpRadius: HUB_RADIUS_MM,
      supplyRadius: c60.fullRadius,
      takeUpTurns: 0,
    });
    expect(c60.at(1800)).toMatchObject({ takeUpRadius: c60.fullRadius, supplyRadius: HUB_RADIUS_MM });
  });

  it('turns the take-up reel fast at first and slower as it fills', () => {
    const early = c60.at(60).takeUpTurns - c60.at(0).takeUpTurns;
    const late = c60.at(1800).takeUpTurns - c60.at(1740).takeUpTurns;
    expect(early).toBeGreaterThan(late * 1.5);
  });

  it('drives a three-digit counter', () => {
    expect(c60.counter(0)).toBe('000');
    expect(c60.counter(600)).toMatch(/^\d{3}$/);
    expect(Number(c60.counter(600))).toBeGreaterThan(0);
  });

  it('uses thinner tape on longer cassettes', () => {
    expect(new ReelModel(3600).fullRadius).toBeLessThan(new ReelModel(2700).fullRadius * 1.1);
  });
});
