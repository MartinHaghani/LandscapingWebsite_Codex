import area from '@turf/area';
import booleanClockwise from '@turf/boolean-clockwise';
import { featureCollection, lineString, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Coordinates, QuoteGeometry } from '../types.js';

export interface GeometryValidationResult {
  normalizedGeometry: QuoteGeometry;
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

const closeRing = (ring: Coordinates[]): Coordinates[] => {
  if (ring.length === 0) {
    return [];
  }

  return hasSamePoint(ring[0], ring[ring.length - 1]) ? [...ring] : [...ring, ring[0]];
};

const normalizeHoleRing = (ring: Coordinates[]) => closeRing(ring);

export const normalizeRing = (ring: Coordinates[]): Coordinates[] => {
  if (ring.length < 3) {
    return ring;
  }

  const closed = closeRing(ring);

  if (closed.length >= MIN_CLOSED_RING_POINTS && booleanClockwise(lineString(closed))) {
    return [...closed].reverse();
  }

  return closed;
};

const hasThreeDistinctPoints = (ring: Coordinates[]) => {
  const distinct = new Set(ring.slice(0, -1).map((point) => point.join(',')));
  return distinct.size >= 3;
};

const geometryToPolygonRings = (geometry: QuoteGeometry): Coordinates[][][] =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

const toQuoteGeometry = (geometry: Polygon | MultiPolygon): QuoteGeometry =>
  geometry.type === 'Polygon'
    ? {
        type: 'Polygon',
        coordinates: geometry.coordinates as Coordinates[][]
      }
    : {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates as Coordinates[][][]
      };

const normalizePolygonRings = (rings: Coordinates[][]) => {
  if (rings.length === 0) {
    throw new Error('Polygon must include at least one linear ring.');
  }

  const normalizedExterior = normalizeRing(rings[0]);
  if (normalizedExterior.length < MIN_CLOSED_RING_POINTS || !hasThreeDistinctPoints(normalizedExterior)) {
    throw new Error('Polygon must include at least 3 distinct points.');
  }

  const normalizedHoles = rings.slice(1).map((ring) => {
    const normalizedHole = normalizeHoleRing(ring);
    if (normalizedHole.length < MIN_CLOSED_RING_POINTS || !hasThreeDistinctPoints(normalizedHole)) {
      throw new Error('Polygon hole must include at least 3 distinct points.');
    }

    return normalizedHole;
  });

  const normalizedRings = [normalizedExterior, ...normalizedHoles];
  const polygonFeature = polygon(normalizedRings);
  const selfIntersecting = kinks(polygonFeature).features.length > 0;

  return {
    rings: normalizedRings,
    selfIntersecting
  };
};

const geometryPerimeterM = (geometry: Polygon | MultiPolygon) => {
  const sumPolygonPerimeter = (rings: Coordinates[][]) =>
    rings.reduce((total, ring) => total + computePerimeterM(ring), 0);

  if (geometry.type === 'Polygon') {
    return sumPolygonPerimeter(geometry.coordinates as Coordinates[][]);
  }

  return geometry.coordinates.reduce(
    (total, polygonCoordinates) => total + sumPolygonPerimeter(polygonCoordinates as Coordinates[][]),
    0
  );
};

const mergePolygons = (polygons: Coordinates[][][]) => {
  const features = polygons.map((rings) => polygon(rings));

  let merged: Feature<Polygon | MultiPolygon> = features[0];

  for (let index = 1; index < features.length; index += 1) {
    const next = union(featureCollection([merged, features[index]]));
    if (!next) {
      throw new Error('Geometry union failed.');
    }

    merged = next;
  }

  return merged;
};

export const validateAndMeasureGeometry = (geometry: QuoteGeometry): GeometryValidationResult => {
  const sourcePolygons = geometryToPolygonRings(geometry);

  if (sourcePolygons.length === 0) {
    throw new Error('At least one polygon is required.');
  }

  const normalizedPolygons: Coordinates[][][] = [];
  let selfIntersecting = false;

  for (const polygonRings of sourcePolygons) {
    const normalized = normalizePolygonRings(polygonRings);
    normalizedPolygons.push(normalized.rings);

    if (normalized.selfIntersecting) {
      selfIntersecting = true;
    }
  }

  const merged = mergePolygons(normalizedPolygons);
  const areaM2 = area(merged);

  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    throw new Error('Polygon area is invalid.');
  }

  const perimeterM = geometryPerimeterM(merged.geometry as Polygon | MultiPolygon);

  return {
    normalizedGeometry: toQuoteGeometry(merged.geometry as Polygon | MultiPolygon),
    areaM2,
    perimeterM,
    selfIntersecting
  };
};
