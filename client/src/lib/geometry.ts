import area from '@turf/area';
import { polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import type { Feature, Polygon } from 'geojson';
import type { LngLat, QuoteMetrics } from '../types';

const M2_TO_FT2 = 10.7639;
const M_TO_FT = 3.28084;
const EARTH_RADIUS_M = 6_371_008.8;

export const toFt2 = (m2: number) => m2 * M2_TO_FT2;
export const toFt = (m: number) => m * M_TO_FT;

export const closeRing = (points: LngLat[]) => {
  if (points.length < 3) {
    return [...points];
  }

  const [firstLng, firstLat] = points[0];
  const [lastLng, lastLat] = points[points.length - 1];

  if (firstLng === lastLng && firstLat === lastLat) {
    return [...points];
  }

  return [...points, points[0]];
};

export const buildPolygonFeature = (points: LngLat[]): Feature<Polygon> | null => {
  if (points.length < 3) {
    return null;
  }

  const ring = closeRing(points);
  return polygon([ring]);
};

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

const computePerimeterM = (ring: LngLat[]) => {
  let total = 0;

  for (let index = 1; index < ring.length; index += 1) {
    total += haversineDistanceM(ring[index - 1], ring[index]);
  }

  return total;
};

export const computeMetrics = (points: LngLat[]): QuoteMetrics => {
  if (points.length < 3) {
    return {
      areaM2: 0,
      perimeterM: 0,
      vertexCount: points.length,
      selfIntersecting: false
    };
  }

  const ring = closeRing(points);
  const polygonFeature = polygon([ring]);
  const perimeterM = computePerimeterM(ring);
  const areaM2 = area(polygonFeature);
  const selfIntersecting = kinks(polygonFeature).features.length > 0;

  return {
    areaM2,
    perimeterM,
    vertexCount: points.length,
    selfIntersecting
  };
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
