import { describe, expect, it } from 'vitest';
import { getQuoteTotal, getSeasonalPricing, getSeasonalTotalRange } from './quote';

describe('seasonal pricing range', () => {
  it('uses weekly fixed 20-visit totals', () => {
    const totals = getSeasonalTotalRange(145.25, 'weekly');

    expect(totals.sessionsMin).toBe(20);
    expect(totals.sessionsMax).toBe(20);
    expect(totals.seasonalTotalMin).toBe(2905);
    expect(totals.seasonalTotalMax).toBe(2905);
  });
});

describe('per-visit quote total', () => {
  it('includes distance term in formula', () => {
    const total = getQuoteTotal({ areaM2: 1000, perimeterM: 100 }, 5);
    expect(total).toBe(85);
  });

  it('applies minimum floor of 45', () => {
    const total = getQuoteTotal({ areaM2: 10, perimeterM: 10 }, 0);
    expect(total).toBe(45);
  });
});

describe('seasonal discount pricing', () => {
  it('calculates discounted seasonal totals and savings', () => {
    const seasonal = getSeasonalPricing(100, 'weekly');
    expect(seasonal.fullSeasonTotal).toBe(2000);
    expect(seasonal.seasonalDiscountRate).toBe(0.2);
    expect(seasonal.seasonalDiscountedTotal).toBe(1600);
    expect(seasonal.seasonalSavingsTotal).toBe(400);
  });

  it('calculates seasonal totals from the minimum per-visit floor', () => {
    const seasonal = getSeasonalPricing(45, 'weekly');
    expect(seasonal.fullSeasonTotal).toBe(900);
    expect(seasonal.seasonalDiscountedTotal).toBe(720);
    expect(seasonal.seasonalSavingsTotal).toBe(180);
  });
});
