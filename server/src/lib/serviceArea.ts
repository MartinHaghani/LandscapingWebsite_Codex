import { featureCollection, polygon } from '@turf/helpers';
import union from '@turf/union';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import type { BaseStationConfig } from './serviceAreaConfig.js';

const EARTH_RADIUS_KM = 6_371.0088;
const COVERAGE_RADIUS_KM = 10;
const CIRCLE_VERTEX_COUNT = 72;
const SIMPLIFY_TOLERANCE_DEGREES = 0.0016;
const QUANTIZE_DECIMALS = 3;
const JITTER_DEGREES = 0.00025;
const BOUNDARY_EPSILON = 1e-9;

export interface ServiceAreaMetadata {
  updatedAt: string;
  approximate: true;
  coverageRadiusKm: number;
  disclaimer: string;
  servedRegions: string[];
}

export interface ServiceAreaFeatureCollection extends FeatureCollection<Polygon | MultiPolygon> {
  metadata: ServiceAreaMetadata;
}

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;
const decimalFactor = 10 ** QUANTIZE_DECIMALS;
const clampLatitude = (value: number) => Math.max(-90, Math.min(90, value));

const normalizeLongitude = (value: number) => {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Number.isFinite(wrapped) ? wrapped : value;
};

const toCoordinate = (position: Position): [number, number] => [position[0], position[1]];

const coordinatesEqual = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];

const closeRing = (ring: [number, number][]) => {
  if (ring.length === 0) {
    return [];
  }

  if (coordinatesEqual(ring[0], ring[ring.length - 1])) {
    return [...ring];
  }

  return [...ring, ring[0]];
};

const destinationPoint = (
  center: [number, number],
  distanceKm: number,
  bearingDegrees: number
): [number, number] => {
  const [centerLng, centerLat] = center;
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(centerLat);
  const lng1 = toRadians(centerLng);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const lat2 = Math.asin(sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearing));
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * sinAngular * cosLat1,
      cosAngular - sinLat1 * Math.sin(lat2)
    );

  return [normalizeLongitude(toDegrees(lng2)), clampLatitude(toDegrees(lat2))];
};

const buildStationCoverageRing = (station: BaseStationConfig) => {
  const center: [number, number] = [station.lng, station.lat];
  const ring: [number, number][] = [];

  for (let index = 0; index < CIRCLE_VERTEX_COUNT; index += 1) {
    const bearing = (index / CIRCLE_VERTEX_COUNT) * 360;
    ring.push(destinationPoint(center, COVERAGE_RADIUS_KM, bearing));
  }

  return closeRing(ring);
};

const mergeCoverageFeatures = (stations: BaseStationConfig[]) => {
  const features = stations.map((station) => polygon([buildStationCoverageRing(station)]));

  if (features.length === 0) {
    return null;
  }

  let merged: Feature<Polygon | MultiPolygon> = features[0];

  for (let index = 1; index < features.length; index += 1) {
    const combined = union(featureCollection([merged, features[index]]));
    if (!combined) {
      throw new Error('Service area union failed.');
    }
    merged = combined;
  }

  return merged;
};

const squaredDistance = (a: [number, number], b: [number, number]) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

const squaredSegmentDistance = (
  point: [number, number],
  start: [number, number],
  end: [number, number]
) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;

  return dx * dx + dy * dy;
};

const simplifyLine = (points: [number, number][], toleranceDegrees: number) => {
  if (points.length <= 2) {
    return [...points];
  }

  const squaredTolerance = toleranceDegrees * toleranceDegrees;
  const markers = new Uint8Array(points.length);
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let maxDistance = 0;
    let candidateIndex = -1;

    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(points[index], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        candidateIndex = index;
      }
    }

    if (candidateIndex > 0 && maxDistance > squaredTolerance) {
      markers[candidateIndex] = 1;
      stack.push([first, candidateIndex], [candidateIndex, last]);
    }
  }

  const simplified: [number, number][] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (markers[index] === 1) {
      simplified.push(points[index]);
    }
  }

  return simplified.length >= 3 ? simplified : [...points];
};

const fraction = (value: number) => value - Math.floor(value);
const randomFromSeed = (seed: number) => fraction(Math.sin(seed) * 43_758.5453123);

const quantizeCoordinate = (value: number) => Math.round(value * decimalFactor) / decimalFactor;

const applyNoiseAndQuantize = (
  point: [number, number],
  index: number,
  jitterSeed: number
): [number, number] => {
  const lngNoise = (randomFromSeed(jitterSeed + index * 1.381 + point[0]) - 0.5) * 2 * JITTER_DEGREES;
  const latNoise = (randomFromSeed(jitterSeed + index * 2.197 + point[1]) - 0.5) * 2 * JITTER_DEGREES;

  const lng = quantizeCoordinate(normalizeLongitude(point[0] + lngNoise));
  const lat = quantizeCoordinate(clampLatitude(point[1] + latNoise));

  return [lng, lat];
};

const countDistinctPoints = (ring: [number, number][]) =>
  new Set(ring.slice(0, -1).map((point) => `${point[0]}:${point[1]}`)).size;

const hardenRing = (ring: Position[], jitterSeed: number) => {
  const base = ring.map(toCoordinate);
  const open = coordinatesEqual(base[0], base[base.length - 1]) ? base.slice(0, -1) : base;
  if (open.length < 3) {
    return null;
  }

  const simplified = simplifyLine(open, SIMPLIFY_TOLERANCE_DEGREES);
  const transformed: [number, number][] = [];

  simplified.forEach((point, index) => {
    const hardened = applyNoiseAndQuantize(point, index, jitterSeed);
    if (transformed.length === 0 || !coordinatesEqual(transformed[transformed.length - 1], hardened)) {
      transformed.push(hardened);
    }
  });

  const fallbackQuantized = open.map((point, index) => applyNoiseAndQuantize(point, index, jitterSeed + 91));
  const openResult = transformed.length >= 3 ? transformed : fallbackQuantized;

  if (openResult.length < 3) {
    return null;
  }

  const closed = closeRing(openResult);
  if (countDistinctPoints(closed) < 3) {
    return null;
  }

  return closed;
};

const hardenPolygonCoordinates = (rings: Position[][], polygonSeed: number) => {
  if (rings.length === 0) {
    return null;
  }

  const exterior = hardenRing(rings[0], polygonSeed + 7);
  if (!exterior) {
    return null;
  }

  const holes = rings
    .slice(1)
    .map((ring, index) => hardenRing(ring, polygonSeed + index * 31 + 19))
    .filter((ring): ring is [number, number][] => ring !== null);

  return [exterior, ...holes];
};

const hardenGeometry = (
  geometry: Polygon | MultiPolygon,
  stations: BaseStationConfig[]
): Polygon | MultiPolygon => {
  const seed = stations.reduce((total, station) => total + station.lat * 11.3 + station.lng * 7.9, 0);

  if (geometry.type === 'Polygon') {
    const hardenedPolygon = hardenPolygonCoordinates(geometry.coordinates, seed);
    if (!hardenedPolygon) {
      throw new Error('Service area polygon hardening failed.');
    }

    return {
      type: 'Polygon',
      coordinates: hardenedPolygon
    };
  }

  const hardenedPolygons = geometry.coordinates
    .map((rings, index) => hardenPolygonCoordinates(rings, seed + index * 61))
    .filter((rings): rings is [number, number][][] => rings !== null);

  if (hardenedPolygons.length === 0) {
    throw new Error('Service area polygon hardening failed.');
  }

  if (hardenedPolygons.length === 1) {
    return {
      type: 'Polygon',
      coordinates: hardenedPolygons[0]
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: hardenedPolygons
  };
};

export const createServiceAreaPayload = (
  stations: BaseStationConfig[],
  servedRegions: string[],
  updatedAt: string
): ServiceAreaFeatureCollection => {
  const merged = mergeCoverageFeatures(stations);

  const features =
    merged === null
      ? []
      : [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: hardenGeometry(merged.geometry as Polygon | MultiPolygon, stations)
          }
        ];

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      updatedAt,
      approximate: true,
      coverageRadiusKm: COVERAGE_RADIUS_KM,
      disclaimer:
        'Displayed overlay is approximate coverage and intentionally obfuscated for station privacy.',
      servedRegions
    }
  };
};

const pointOnSegment = (point: [number, number], start: [number, number], end: [number, number]) => {
  const lengthSquared = squaredDistance(start, end);
  if (lengthSquared <= BOUNDARY_EPSILON) {
    return squaredDistance(point, start) <= BOUNDARY_EPSILON;
  }

  const cross =
    (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);

  if (Math.abs(cross) > BOUNDARY_EPSILON) {
    return false;
  }

  const dot =
    (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < 0) {
    return false;
  }

  return dot <= lengthSquared + BOUNDARY_EPSILON;
};

const pointInRing = (point: [number, number], ring: Position[]) => {
  const closed = closeRing(ring.map(toCoordinate));
  let inside = false;

  for (let i = 0, j = closed.length - 1; i < closed.length; j = i, i += 1) {
    const xi = closed[i][0];
    const yi = closed[i][1];
    const xj = closed[j][0];
    const yj = closed[j][1];

    if (pointOnSegment(point, closed[j], closed[i])) {
      return true;
    }

    const intersects = yi > point[1] !== yj > point[1];
    if (intersects) {
      const intersectLng = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < intersectLng) {
        inside = !inside;
      }
    }
  }

  return inside;
};

const pointInPolygon = (point: [number, number], polygonGeometry: Polygon) => {
  if (polygonGeometry.coordinates.length === 0) {
    return false;
  }

  const [exterior, ...holes] = polygonGeometry.coordinates;
  if (!pointInRing(point, exterior)) {
    return false;
  }

  for (const hole of holes) {
    if (pointInRing(point, hole)) {
      return false;
    }
  }

  return true;
};

export const pointInGeometry = (point: [number, number], geometry: Polygon | MultiPolygon) => {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry);
  }

  return geometry.coordinates.some((coordinates) =>
    pointInPolygon(point, {
      type: 'Polygon',
      coordinates
    })
  );
};
