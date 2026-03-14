import type { Feature, Polygon } from 'geojson';
import type { LngLat } from './quoteEditorTypes';

const M2_TO_FT2 = 10.7639;
const M_TO_FT = 3.28084;

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

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [closeRing(points)]
    },
    properties: {}
  };
};

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
