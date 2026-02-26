import { describe, expect, it } from 'vitest';
import { closeRing, toFt, toFt2 } from './geometry';

describe('geometry helpers', () => {
  it('closes polygon rings by repeating first point', () => {
    const ring = closeRing([
      [0, 0],
      [1, 0],
      [1, 1]
    ]);

    expect(ring).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0]
    ]);
  });

  it('converts m² to ft² accurately', () => {
    expect(toFt2(10)).toBeCloseTo(107.639, 3);
  });

  it('converts meters to feet accurately', () => {
    expect(toFt(10)).toBeCloseTo(32.8084, 4);
  });
});
