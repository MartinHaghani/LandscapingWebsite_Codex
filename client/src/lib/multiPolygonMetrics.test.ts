import { describe, expect, it } from 'vitest';
import { computeMetrics } from './geometry';
import { computeMultiPolygonMetrics } from './multiPolygonMetrics';

describe('computeMultiPolygonMetrics', () => {
  it('subtracts overlapping obstacle area from service area', () => {
    const polygonA: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];

    const polygonB: [number, number][] = [
      [0.005, 0],
      [0.015, 0],
      [0.015, 0.01],
      [0.005, 0.01]
    ];

    const areaSum = computeMetrics(polygonA).areaM2 + computeMetrics(polygonB).areaM2;
    const metrics = computeMultiPolygonMetrics([
      { id: 'a', kind: 'service', ringPoints: polygonA, rawStrokePoints: polygonA },
      { id: 'b', kind: 'obstacle', ringPoints: polygonB, rawStrokePoints: polygonB }
    ]);

    expect(metrics.validServicePolygonCount).toBe(1);
    expect(metrics.validObstaclePolygonCount).toBe(1);
    expect(metrics.geometry?.type).toBe('Polygon');
    expect(metrics.areaM2).toBeLessThan(areaSum);
    expect(metrics.perimeterM).toBeGreaterThan(0);
  });

  it('increases perimeter when obstacle cuts an interior hole', () => {
    const polygonA: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];

    const obstacle: [number, number][] = [
      [0.003, 0.003],
      [0.007, 0.003],
      [0.007, 0.007],
      [0.003, 0.007]
    ];

    const serviceOnly = computeMetrics(polygonA);

    const metrics = computeMultiPolygonMetrics([
      { id: 'a', kind: 'service', ringPoints: polygonA, rawStrokePoints: polygonA },
      { id: 'b', kind: 'obstacle', ringPoints: obstacle, rawStrokePoints: obstacle }
    ]);

    expect(metrics.areaM2).toBeLessThan(serviceOnly.areaM2);
    expect(metrics.perimeterM).toBeGreaterThan(serviceOnly.perimeterM);
  });

  it('ignores obstacle geometry outside the service area', () => {
    const service: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];
    const obstacleOutside: [number, number][] = [
      [0.02, 0.02],
      [0.03, 0.02],
      [0.03, 0.03],
      [0.02, 0.03]
    ];
    const serviceOnly = computeMetrics(service);

    const metrics = computeMultiPolygonMetrics([
      { id: 'service', kind: 'service', ringPoints: service, rawStrokePoints: service },
      {
        id: 'obstacle-outside',
        kind: 'obstacle',
        ringPoints: obstacleOutside,
        rawStrokePoints: obstacleOutside
      }
    ]);

    expect(Math.abs(metrics.areaM2 - serviceOnly.areaM2)).toBeLessThan(1);
    expect(Math.abs(metrics.perimeterM - serviceOnly.perimeterM)).toBeLessThan(1);
  });

  it('returns null geometry when obstacles fully remove service area', () => {
    const service: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];
    const obstacleCover: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];

    const metrics = computeMultiPolygonMetrics([
      { id: 'service', kind: 'service', ringPoints: service, rawStrokePoints: service },
      {
        id: 'obstacle-cover',
        kind: 'obstacle',
        ringPoints: obstacleCover,
        rawStrokePoints: obstacleCover
      }
    ]);

    expect(metrics.geometry).toBeNull();
    expect(metrics.effectiveGeometryEmpty).toBe(true);
    expect(metrics.areaM2).toBe(0);
    expect(metrics.perimeterM).toBe(0);
  });

  it('deduplicates overlapping obstacles before subtraction', () => {
    const service: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01]
    ];
    const obstacleA: [number, number][] = [
      [0.002, 0.002],
      [0.006, 0.002],
      [0.006, 0.006],
      [0.002, 0.006]
    ];
    const obstacleB: [number, number][] = [
      [0.004, 0.002],
      [0.008, 0.002],
      [0.008, 0.006],
      [0.004, 0.006]
    ];

    const metrics = computeMultiPolygonMetrics([
      { id: 'service', kind: 'service', ringPoints: service, rawStrokePoints: service },
      { id: 'obstacle-a', kind: 'obstacle', ringPoints: obstacleA, rawStrokePoints: obstacleA },
      { id: 'obstacle-b', kind: 'obstacle', ringPoints: obstacleB, rawStrokePoints: obstacleB }
    ]);

    expect(metrics.areaM2).toBeGreaterThan(0);
    expect(metrics.areaM2).toBeLessThan(computeMetrics(service).areaM2);
  });

  it('ignores polygons with fewer than 3 distinct points', () => {
    const metrics = computeMultiPolygonMetrics([
      {
        id: 'valid',
        kind: 'service',
        ringPoints: [[0, 0], [0.01, 0], [0, 0.01]],
        rawStrokePoints: null
      },
      {
        id: 'invalid',
        kind: 'obstacle',
        ringPoints: [[1, 1], [1, 1], [1, 1]],
        rawStrokePoints: null
      }
    ]);

    expect(metrics.validServicePolygonCount).toBe(1);
    expect(metrics.validObstaclePolygonCount).toBe(0);
    expect(metrics.areaM2).toBeGreaterThan(0);
  });
});
