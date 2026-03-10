import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MultiPolygon, Polygon } from 'geojson';
import { createServiceAreaPayload, pointInGeometry } from './serviceArea.js';
import {
  loadBaseStationsFromEnv,
  loadServedRegionsFromEnv,
  type BaseStationConfig
} from './serviceAreaConfig.js';

const collectCoordinates = (geometry: Polygon | MultiPolygon): [number, number][] => {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flatMap((ring) =>
      ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number])
    );
  }

  return geometry.coordinates.flatMap((polygonCoordinates) =>
    polygonCoordinates.flatMap((ring) =>
      ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number])
    )
  );
};

describe('serviceArea geometry hardening', () => {
  it('does not expose exact station center coordinates in overlay geometry', () => {
    const stations: BaseStationConfig[] = [
      {
        label: 'internal-station-a',
        address: 'internal-only',
        lat: 32.8304,
        lng: -96.8092,
        active: true
      }
    ];

    const payload = createServiceAreaPayload(stations, ['Dallas Test Region'], '2026-03-03T00:00:00.000Z');
    assert.equal(payload.type, 'FeatureCollection');
    assert.ok(payload.features.length > 0);

    const coordinates = collectCoordinates(payload.features[0].geometry);
    const hasExactStationCenter = coordinates.some(
      (coordinate) => coordinate[0] === stations[0].lng && coordinate[1] === stations[0].lat
    );

    assert.equal(hasExactStationCenter, false);
  });

  it('quantizes overlay coordinates to 3 decimal places', () => {
    const stations: BaseStationConfig[] = [
      {
        label: 'internal-station-b',
        address: 'internal-only',
        lat: 32.75,
        lng: -96.91,
        active: true
      }
    ];

    const payload = createServiceAreaPayload(stations, ['Dallas Test Region'], '2026-03-03T00:00:00.000Z');
    const coordinates = collectCoordinates(payload.features[0].geometry);

    coordinates.forEach((coordinate) => {
      assert.equal(coordinate[0], Number(coordinate[0].toFixed(3)));
      assert.equal(coordinate[1], Number(coordinate[1].toFixed(3)));
    });
  });
});

describe('serviceArea default config', () => {
  it('defaults to one active L6A1M7 base station in non-production', () => {
    const stations = loadBaseStationsFromEnv({
      NODE_ENV: 'development'
    });

    assert.equal(stations.length, 1);
    assert.equal(stations[0].label, 'internal-l6a1m7-station');
    assert.equal(stations[0].address, 'L6A1M7');
    assert.equal(stations[0].lat, 43.844147);
    assert.equal(stations[0].lng, -79.51962);
    assert.equal(stations[0].active, true);
  });

  it('defaults served regions to Vaughan, Ontario', () => {
    const regions = loadServedRegionsFromEnv({});
    assert.deepEqual(regions, ['Vaughan, Ontario']);
  });
});

describe('pointInGeometry', () => {
  it('returns true for points in polygon exterior and false for hole', () => {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0]
        ],
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1]
        ]
      ]
    };

    assert.equal(pointInGeometry([0.5, 0.5], polygon), true);
    assert.equal(pointInGeometry([2, 2], polygon), false);
    assert.equal(pointInGeometry([5, 5], polygon), false);
  });

  it('returns true when point is inside any multipolygon member', () => {
    const multiPolygon: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ],
        [
          [
            [10, 10],
            [11, 10],
            [11, 11],
            [10, 11],
            [10, 10]
          ]
        ]
      ]
    };

    assert.equal(pointInGeometry([10.5, 10.5], multiPolygon), true);
    assert.equal(pointInGeometry([5, 5], multiPolygon), false);
  });
});
