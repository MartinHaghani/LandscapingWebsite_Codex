import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSessionRangePricing } from './pricing.js';

describe('computeSessionRangePricing', () => {
  it('returns weekly 26-30 window with seasonal totals', () => {
    const pricing = computeSessionRangePricing(123.456, 'weekly');

    assert.equal(pricing.serviceFrequency, 'weekly');
    assert.equal(pricing.sessionsMin, 26);
    assert.equal(pricing.sessionsMax, 30);
    assert.equal(pricing.perSessionTotal, 123.46);
    assert.equal(pricing.seasonalTotalMin, 3209.96);
    assert.equal(pricing.seasonalTotalMax, 3703.8);
  });

  it('returns biweekly 13-15 window with seasonal totals', () => {
    const pricing = computeSessionRangePricing(200, 'biweekly');

    assert.equal(pricing.serviceFrequency, 'biweekly');
    assert.equal(pricing.sessionsMin, 13);
    assert.equal(pricing.sessionsMax, 15);
    assert.equal(pricing.perSessionTotal, 200);
    assert.equal(pricing.seasonalTotalMin, 2600);
    assert.equal(pricing.seasonalTotalMax, 3000);
  });
});
