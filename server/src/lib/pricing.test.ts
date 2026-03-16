import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computePerSessionTotal, computeSessionRangePricing } from './pricing.js';

describe('computeSessionRangePricing', () => {
  it('returns weekly fixed 26-session totals with discount math', () => {
    const pricing = computeSessionRangePricing(123.456, 'weekly');

    assert.equal(pricing.serviceFrequency, 'weekly');
    assert.equal(pricing.sessionsMin, 26);
    assert.equal(pricing.sessionsMax, 26);
    assert.equal(pricing.perSessionTotal, 123.46);
    assert.equal(pricing.fullSeasonTotal, 3209.96);
    assert.equal(pricing.seasonalDiscountRate, 0.2);
    assert.equal(pricing.seasonalDiscountedTotal, 2567.97);
    assert.equal(pricing.seasonalSavingsTotal, 641.99);
    assert.equal(pricing.seasonalTotalMin, 3209.96);
    assert.equal(pricing.seasonalTotalMax, 3209.96);
  });

  it('returns biweekly fixed 14-session totals', () => {
    const pricing = computeSessionRangePricing(200, 'biweekly');

    assert.equal(pricing.serviceFrequency, 'biweekly');
    assert.equal(pricing.sessionsMin, 14);
    assert.equal(pricing.sessionsMax, 14);
    assert.equal(pricing.perSessionTotal, 200);
    assert.equal(pricing.fullSeasonTotal, 2800);
    assert.equal(pricing.seasonalDiscountedTotal, 2240);
    assert.equal(pricing.seasonalSavingsTotal, 560);
    assert.equal(pricing.seasonalTotalMin, 2800);
    assert.equal(pricing.seasonalTotalMax, 2800);
  });
});

describe('computePerSessionTotal', () => {
  it('uses area, perimeter, and distance terms', () => {
    const total = computePerSessionTotal(1000, 100, 5);
    assert.equal(total, 85);
  });

  it('applies minimum price floor of 50', () => {
    const total = computePerSessionTotal(5, 5, 0);
    assert.equal(total, 50);
  });
});
