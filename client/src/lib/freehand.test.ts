import { describe, expect, it } from 'vitest';
import { finalizeFreehandStroke } from './freehand';

const METERS_PER_DEGREE_LAT = 111_111;
const ORIGIN: [number, number] = [-79.52, 43.84];

const toLngLat = (
  origin: [number, number],
  offsetXMeters: number,
  offsetYMeters: number
): [number, number] => {
  const [originLng, originLat] = origin;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((originLat * Math.PI) / 180);

  return [
    originLng + offsetXMeters / metersPerDegreeLng,
    originLat + offsetYMeters / METERS_PER_DEGREE_LAT
  ];
};

describe('finalizeFreehandStroke', () => {
  it('creates ring and raw stroke points for a valid drawn path', () => {
    const stroke = finalizeFreehandStroke([
      [-79.5202, 43.8438],
      [-79.52, 43.84375],
      [-79.5197, 43.8437],
      [-79.5193, 43.84385],
      [-79.51925, 43.8442],
      [-79.5195, 43.84445],
      [-79.51995, 43.8445],
      [-79.5202, 43.8442]
    ]);

    expect(stroke).not.toBeNull();
    expect((stroke?.rawStrokePoints.length ?? 0) >= (stroke?.ringPoints.length ?? 0)).toBe(true);
    expect((stroke?.ringPoints.length ?? 0) >= 3).toBe(true);
  });

  it('removes redundant vertices from clearly straight runs', () => {
    const stroke = finalizeFreehandStroke([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 3, 0.05),
      toLngLat(ORIGIN, 6, -0.04),
      toLngLat(ORIGIN, 9, 0.06),
      toLngLat(ORIGIN, 12, 0),
      toLngLat(ORIGIN, 12, 8),
      toLngLat(ORIGIN, 6, 8.02),
      toLngLat(ORIGIN, 0, 8),
      toLngLat(ORIGIN, 0.02, 2)
    ]);

    expect(stroke).not.toBeNull();
    expect(stroke?.ringPoints).toHaveLength(5);
  });

  it('normalizes drawing speed and caps vertex density by distance', () => {
    const sparseStroke = finalizeFreehandStroke([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 3, 0.12),
      toLngLat(ORIGIN, 6, -0.14),
      toLngLat(ORIGIN, 9, 0.16),
      toLngLat(ORIGIN, 12, -0.15),
      toLngLat(ORIGIN, 15, 0.11),
      toLngLat(ORIGIN, 18, 0),
      toLngLat(ORIGIN, 18, 8),
      toLngLat(ORIGIN, 0, 8),
      toLngLat(ORIGIN, 0, 0.3)
    ]);
    const denseStroke = finalizeFreehandStroke([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 1, 0.05),
      toLngLat(ORIGIN, 2, 0.09),
      toLngLat(ORIGIN, 3, 0.12),
      toLngLat(ORIGIN, 4, 0.04),
      toLngLat(ORIGIN, 5, -0.06),
      toLngLat(ORIGIN, 6, -0.14),
      toLngLat(ORIGIN, 7, -0.02),
      toLngLat(ORIGIN, 8, 0.06),
      toLngLat(ORIGIN, 9, 0.16),
      toLngLat(ORIGIN, 10, 0.03),
      toLngLat(ORIGIN, 11, -0.08),
      toLngLat(ORIGIN, 12, -0.15),
      toLngLat(ORIGIN, 13, -0.02),
      toLngLat(ORIGIN, 14, 0.05),
      toLngLat(ORIGIN, 15, 0.11),
      toLngLat(ORIGIN, 16, 0.05),
      toLngLat(ORIGIN, 17, 0.02),
      toLngLat(ORIGIN, 18, 0),
      toLngLat(ORIGIN, 18, 8),
      toLngLat(ORIGIN, 0, 8),
      toLngLat(ORIGIN, 0, 0.3)
    ]);
    const expectedRing = [
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 18, 0),
      toLngLat(ORIGIN, 18, 8),
      toLngLat(ORIGIN, 0, 8)
    ];

    expect(sparseStroke).not.toBeNull();
    expect(denseStroke).not.toBeNull();
    expect(sparseStroke?.ringPoints).toEqual(expectedRing);
    expect(denseStroke?.ringPoints).toEqual(expectedRing);
    expect(denseStroke?.ringPoints).toEqual(sparseStroke?.ringPoints);
    expect((denseStroke?.rawStrokePoints.length ?? 0) > (denseStroke?.ringPoints.length ?? 0)).toBe(true);
  });

  it('preserves sharp corners instead of flattening them away', () => {
    const stroke = finalizeFreehandStroke([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 4, 0),
      toLngLat(ORIGIN, 8, 0),
      toLngLat(ORIGIN, 8, 4),
      toLngLat(ORIGIN, 8, 8),
      toLngLat(ORIGIN, 0, 8),
      toLngLat(ORIGIN, 0, 0.2)
    ]);

    expect(stroke).not.toBeNull();
    expect(stroke?.ringPoints).toEqual([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 8, 0),
      toLngLat(ORIGIN, 8, 8),
      toLngLat(ORIGIN, 0, 8)
    ]);
  });

  it('preserves intentional curves with intermediate points', () => {
    const curvePoints = Array.from({ length: 9 }, (_, index) => {
      const angle = (Math.PI / 2) * (index / 8);
      return toLngLat(ORIGIN, Math.cos(angle) * 10, Math.sin(angle) * 10);
    });
    const stroke = finalizeFreehandStroke([
      ...curvePoints,
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 10, 0.2)
    ]);

    expect(stroke).not.toBeNull();
    expect((stroke?.ringPoints.length ?? 0) > 4).toBe(true);
  });

  it('does not globally thin the ring based on maxRingPoints anymore', () => {
    const strokePoints = [
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 2, 0),
      toLngLat(ORIGIN, 4, 0),
      toLngLat(ORIGIN, 6, 0),
      toLngLat(ORIGIN, 8, 0),
      toLngLat(ORIGIN, 10, 3),
      toLngLat(ORIGIN, 8, 6),
      toLngLat(ORIGIN, 4, 7),
      toLngLat(ORIGIN, 0, 8)
    ];

    const defaultStroke = finalizeFreehandStroke(strokePoints);
    const constrainedStroke = finalizeFreehandStroke(strokePoints, { maxRingPoints: 3 });

    expect(defaultStroke).not.toBeNull();
    expect(constrainedStroke).not.toBeNull();
    expect(constrainedStroke?.ringPoints).toEqual(defaultStroke?.ringPoints);
  });

  it('collapses overlapping start-end closure into one clean join corner', () => {
    const stroke = finalizeFreehandStroke([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 8, 0),
      toLngLat(ORIGIN, 8, 8),
      toLngLat(ORIGIN, 0, 8),
      toLngLat(ORIGIN, 0.55, 1.1),
      toLngLat(ORIGIN, 0.2, 0.35),
      toLngLat(ORIGIN, 0.05, 0.08)
    ]);

    expect(stroke).not.toBeNull();
    expect(stroke?.ringPoints).toEqual([
      toLngLat(ORIGIN, 0, 0),
      toLngLat(ORIGIN, 8, 0),
      toLngLat(ORIGIN, 8, 8),
      toLngLat(ORIGIN, 0, 8)
    ]);
  });

  it('ignores tiny accidental strokes', () => {
    const stroke = finalizeFreehandStroke([
      [-79.52, 43.84],
      [-79.520001, 43.840001],
      [-79.520002, 43.840002]
    ]);

    expect(stroke).toBeNull();
  });
});
