import area from '@turf/area';
import booleanClockwise from '@turf/boolean-clockwise';
import { lineString, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import type { Coordinates } from '../types.js';

export interface PolygonValidationResult {
  normalizedRing: Coordinates[];
  areaM2: number;
  perimeterM: number;
  selfIntersecting: boolean;
}

const MIN_CLOSED_RING_POINTS = 4;
const EARTH_RADIUS_M = 6_371_008.8;

const hasSamePoint = (a: Coordinates, b: Coordinates) => a[0] === b[0] && a[1] === b[1];
const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceM = (from: Coordinates, to: Coordinates) => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const hav =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(hav)));
};

const computePerimeterM = (ring: Coordinates[]) => {
  let total = 0;

  for (let index = 1; index < ring.length; index += 1) {
    total += haversineDistanceM(ring[index - 1], ring[index]);
  }

  return total;
};

export const normalizeRing = (ring: Coordinates[]): Coordinates[] => {
  if (ring.length < 3) {
    return ring;
  }

  const closed = hasSamePoint(ring[0], ring[ring.length - 1])
    ? [...ring]
    : [...ring, ring[0]];

  if (closed.length >= MIN_CLOSED_RING_POINTS && booleanClockwise(lineString(closed))) {
    return [...closed].reverse();
  }

  return closed;
};

export const validateAndMeasurePolygon = (ring: Coordinates[]): PolygonValidationResult => {
  const normalizedRing = normalizeRing(ring);

  if (normalizedRing.length < MIN_CLOSED_RING_POINTS) {
    throw new Error('Polygon must include at least 3 distinct points.');
  }

  const distinctPoints = new Set(normalizedRing.slice(0, -1).map((point) => point.join(',')));
  if (distinctPoints.size < 3) {
    throw new Error('Polygon must include at least 3 distinct points.');
  }

  const polygonFeature = polygon([normalizedRing]);
  const kinksResult = kinks(polygonFeature);
  const selfIntersecting = kinksResult.features.length > 0;

  const areaM2 = area(polygonFeature);
  const perimeterM = computePerimeterM(normalizedRing);

  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    throw new Error('Polygon area is invalid.');
  }

  return {
    normalizedRing,
    areaM2,
    perimeterM,
    selfIntersecting
  };
};
