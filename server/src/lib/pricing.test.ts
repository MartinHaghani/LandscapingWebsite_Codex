import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computePerSessionTotal, computeSessionRangePricing, normalizeServiceFrequency } from './pricing.js';

describe('computeSessionRangePricing', () => {
  it('returns weekly fixed 20-visit totals with discount math', () => {
    const pricing = computeSessionRangePricing(123.456, 'weekly');

    assert.equal(pricing.serviceFrequency, 'weekly');
    assert.equal(pricing.sessionsMin, 20);
    assert.equal(pricing.sessionsMax, 20);
    assert.equal(pricing.perSessionTotal, 123.46);
    assert.equal(pricing.fullSeasonTotal, 2469.2);
    assert.equal(pricing.seasonalDiscountRate, 0.2);
    assert.equal(pricing.seasonalDiscountedTotal, 1975.36);
    assert.equal(pricing.seasonalSavingsTotal, 493.84);
    assert.equal(pricing.seasonalTotalMin, 2469.2);
    assert.equal(pricing.seasonalTotalMax, 2469.2);
  });

  it('calculates seasonal totals from the minimum per-visit floor', () => {
    const pricing = computeSessionRangePricing(45, 'weekly');

    assert.equal(pricing.perSessionTotal, 45);
    assert.equal(pricing.fullSeasonTotal, 900);
    assert.equal(pricing.seasonalDiscountedTotal, 720);
    assert.equal(pricing.seasonalSavingsTotal, 180);
  });

  it('normalizes removed or unknown service-frequency values to weekly', () => {
    assert.equal(normalizeServiceFrequency('removed'), 'weekly');
    assert.equal(normalizeServiceFrequency(null), 'weekly');
  });
});

describe('computePerSessionTotal', () => {
  it('uses area, perimeter, and distance terms', () => {
    const total = computePerSessionTotal(1000, 100, 5);
    assert.equal(total, 85);
  });

  it('applies minimum price floor of 45', () => {
    const total = computePerSessionTotal(5, 5, 0);
    assert.equal(total, 45);
  });
});
