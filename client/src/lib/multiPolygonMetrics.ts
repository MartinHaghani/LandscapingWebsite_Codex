import area from '@turf/area';
import difference from '@turf/difference';
import { featureCollection, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { EditablePolygon, LngLat, QuoteGeometry } from '../types';
import { closeRing } from './geometry';

const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceM = (from: LngLat, to: LngLat) => {
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

const computeRingPerimeterM = (ring: LngLat[]) => {
  let total = 0;

  for (let index = 1; index < ring.length; index += 1) {
    total += haversineDistanceM(ring[index - 1], ring[index]);
  }

  return total;
};

const polygonPerimeterM = (coordinates: LngLat[][]) =>
  coordinates.reduce((sum, ring) => sum + computeRingPerimeterM(ring), 0);

const geometryPerimeterM = (geometry: Polygon | MultiPolygon) => {
  if (geometry.type === 'Polygon') {
    return polygonPerimeterM(geometry.coordinates as LngLat[][]);
  }

  return geometry.coordinates.reduce(
    (sum, polygonCoordinates) => sum + polygonPerimeterM(polygonCoordinates as LngLat[][]),
    0
  );
};

const hasThreeDistinctPoints = (points: LngLat[]) => new Set(points.map((point) => point.join(','))).size >= 3;

const toQuoteGeometry = (geometry: Polygon | MultiPolygon): QuoteGeometry => {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates as LngLat[][]
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates as LngLat[][][]
  };
};

const mergePolygons = (features: Feature<Polygon>[]): Feature<Polygon | MultiPolygon> | null => {
  if (features.length === 0) {
    return null;
  }

  let merged: Feature<Polygon | MultiPolygon> = features[0];

  for (let index = 1; index < features.length; index += 1) {
    const next = union(featureCollection([merged, features[index]]));
    if (!next) {
      return null;
    }

    merged = next;
  }

  return merged;
};

export interface MultiPolygonMetrics {
  areaM2: number;
  perimeterM: number;
  vertexCount: number;
  servicePolygonCount: number;
  obstaclePolygonCount: number;
  validServicePolygonCount: number;
  validObstaclePolygonCount: number;
  validPolygonCount: number;
  selfIntersecting: boolean;
  effectiveGeometryEmpty: boolean;
  geometry: QuoteGeometry | null;
}

export const computeMultiPolygonMetrics = (polygons: EditablePolygon[]): MultiPolygonMetrics => {
  const serviceFeatures: Feature<Polygon>[] = [];
  const obstacleFeatures: Feature<Polygon>[] = [];
  let vertexCount = 0;
  let servicePolygonCount = 0;
  let obstaclePolygonCount = 0;
  let validServicePolygonCount = 0;
  let validObstaclePolygonCount = 0;
  let selfIntersecting = false;

  for (const polygonState of polygons) {
    const points = polygonState.points;
    vertexCount += points.length;
    if (polygonState.kind === 'service') {
      servicePolygonCount += 1;
    } else {
      obstaclePolygonCount += 1;
    }

    if (points.length < 3 || !hasThreeDistinctPoints(points)) {
      continue;
    }

    const feature = polygon([closeRing(points)]);

    if (kinks(feature).features.length > 0) {
      selfIntersecting = true;
      continue;
    }

    if (polygonState.kind === 'service') {
      validServicePolygonCount += 1;
      serviceFeatures.push(feature);
      continue;
    }

    validObstaclePolygonCount += 1;
    obstacleFeatures.push(feature);
  }

  const serviceUnion = mergePolygons(serviceFeatures);
  if (!serviceUnion) {
    return {
      areaM2: 0,
      perimeterM: 0,
      vertexCount,
      servicePolygonCount,
      obstaclePolygonCount,
      validServicePolygonCount,
      validObstaclePolygonCount,
      validPolygonCount: validServicePolygonCount + validObstaclePolygonCount,
      selfIntersecting,
      effectiveGeometryEmpty: false,
      geometry: null
    };
  }

  const obstacleUnion = mergePolygons(obstacleFeatures);
  const effectiveFeature = obstacleUnion
    ? difference(featureCollection([serviceUnion, obstacleUnion]))
    : serviceUnion;

  if (!effectiveFeature) {
    return {
      areaM2: 0,
      perimeterM: 0,
      vertexCount,
      servicePolygonCount,
      obstaclePolygonCount,
      validServicePolygonCount,
      validObstaclePolygonCount,
      validPolygonCount: validServicePolygonCount + validObstaclePolygonCount,
      selfIntersecting,
      effectiveGeometryEmpty: true,
      geometry: null
    };
  }

  const geometry = effectiveFeature.geometry;

  return {
    areaM2: area(effectiveFeature),
    perimeterM: geometryPerimeterM(geometry as Polygon | MultiPolygon),
    vertexCount,
    servicePolygonCount,
    obstaclePolygonCount,
    validServicePolygonCount,
    validObstaclePolygonCount,
    validPolygonCount: validServicePolygonCount + validObstaclePolygonCount,
    selfIntersecting,
    effectiveGeometryEmpty: false,
    geometry: toQuoteGeometry(geometry as Polygon | MultiPolygon)
  };
};
