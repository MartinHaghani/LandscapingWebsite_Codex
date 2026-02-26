import { describe, expect, it } from 'vitest';
import { getQuoteTotal, getRecommendedPlan } from './quote';

describe('quote utilities', () => {
  it('selects a starter plan for smaller areas', () => {
    expect(getRecommendedPlan(320)).toBe('Starter Autonomy Plan');
  });

  it('selects a precision weekly plan for medium areas', () => {
    expect(getRecommendedPlan(900)).toBe('Precision Weekly Plan');
  });

  it('computes a deterministic quote total', () => {
    expect(getQuoteTotal({ areaM2: 500, perimeterM: 100 })).toBe(129.5);
  });
});
