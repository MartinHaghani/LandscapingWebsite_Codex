import { describe, expect, it } from 'vitest';
import { getQuoteTotal, getSeasonalPricing, getSeasonalTotalRange } from './quote';

describe('seasonal pricing range', () => {
  it('uses weekly fixed 26-session totals', () => {
    const totals = getSeasonalTotalRange(145.25, 'weekly');

    expect(totals.sessionsMin).toBe(26);
    expect(totals.sessionsMax).toBe(26);
    expect(totals.seasonalTotalMin).toBe(3776.5);
    expect(totals.seasonalTotalMax).toBe(3776.5);
  });

  it('uses biweekly fixed 14-session totals', () => {
    const totals = getSeasonalTotalRange(145.25, 'biweekly');

    expect(totals.sessionsMin).toBe(14);
    expect(totals.sessionsMax).toBe(14);
    expect(totals.seasonalTotalMin).toBe(2033.5);
    expect(totals.seasonalTotalMax).toBe(2033.5);
  });
});

describe('per-session quote total', () => {
  it('includes distance term in formula', () => {
    const total = getQuoteTotal({ areaM2: 1000, perimeterM: 100 }, 5);
    expect(total).toBe(85);
  });

  it('applies minimum floor of 50', () => {
    const total = getQuoteTotal({ areaM2: 10, perimeterM: 10 }, 0);
    expect(total).toBe(50);
  });
});

describe('seasonal discount pricing', () => {
  it('calculates discounted seasonal totals and savings', () => {
    const seasonal = getSeasonalPricing(100, 'weekly');
    expect(seasonal.fullSeasonTotal).toBe(2600);
    expect(seasonal.seasonalDiscountRate).toBe(0.2);
    expect(seasonal.seasonalDiscountedTotal).toBe(2080);
    expect(seasonal.seasonalSavingsTotal).toBe(520);
  });
});
