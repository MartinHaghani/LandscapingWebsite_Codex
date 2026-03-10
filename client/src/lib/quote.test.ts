import { describe, expect, it } from 'vitest';
import { getSeasonalTotalRange } from './quote';

describe('seasonal pricing range', () => {
  it('uses weekly session window 26-30', () => {
    const totals = getSeasonalTotalRange(145.25, 'weekly');

    expect(totals.sessionsMin).toBe(26);
    expect(totals.sessionsMax).toBe(30);
    expect(totals.seasonalTotalMin).toBe(3776.5);
    expect(totals.seasonalTotalMax).toBe(4357.5);
  });

  it('uses biweekly session window 13-15', () => {
    const totals = getSeasonalTotalRange(145.25, 'biweekly');

    expect(totals.sessionsMin).toBe(13);
    expect(totals.sessionsMax).toBe(15);
    expect(totals.seasonalTotalMin).toBe(1888.25);
    expect(totals.seasonalTotalMax).toBe(2178.75);
  });
});
