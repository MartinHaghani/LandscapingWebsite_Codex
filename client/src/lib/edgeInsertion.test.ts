import { describe, expect, it } from 'vitest';
import {
  findEdgeInsertionHit,
  insertPointIntoRing,
  type EdgeInsertionLngLat,
  type ScreenPoint
} from './edgeInsertion';

const identityProjector = {
  project: ([x, y]: EdgeInsertionLngLat): ScreenPoint => ({ x, y }),
  unproject: ({ x, y }: ScreenPoint): EdgeInsertionLngLat => [x, y]
};

describe('edge insertion helpers', () => {
  const square: EdgeInsertionLngLat[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ];

  it('finds the nearest middle segment and projects onto the clicked edge', () => {
    const hit = findEdgeInsertionHit(square, { x: 12, y: 4 }, identityProjector, 14);

    expect(hit).not.toBeNull();
    expect(hit?.segmentIndex).toBe(1);
    expect(hit?.insertIndex).toBe(2);
    expect(hit?.projectedPoint).toEqual({ x: 10, y: 4 });
    expect(hit?.lngLat).toEqual([10, 4]);
  });

  it('returns null when the pointer is outside the insertion tolerance', () => {
    const hit = findEdgeInsertionHit(square, { x: 30, y: 30 }, identityProjector, 14);

    expect(hit).toBeNull();
  });

  it('uses the closing segment as the last insertion target', () => {
    const hit = findEdgeInsertionHit(square, { x: -2, y: 4 }, identityProjector, 14);

    expect(hit).not.toBeNull();
    expect(hit?.segmentIndex).toBe(3);
    expect(hit?.insertIndex).toBe(4);
    expect(hit?.lngLat).toEqual([0, 4]);
  });

  it('inserts the new point at the computed index', () => {
    const nextRing = insertPointIntoRing(square, 2, [10, 4]);

    expect(nextRing).toEqual([
      [0, 0],
      [10, 0],
      [10, 4],
      [10, 10],
      [0, 10]
    ]);
  });
});
