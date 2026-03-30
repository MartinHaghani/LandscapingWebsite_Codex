import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { EditablePolygon, LngLat } from '../types';
import { buildPolygonFeature } from './geometry';
import { getLngLatBounds, mergeLngLatBounds, padLngLatBounds, type LngLatBounds } from './mapBounds';

const toPreviewFeature = (polygon: EditablePolygon): Feature<Polygon> | null => {
  const feature = buildPolygonFeature(polygon.ringPoints);
  if (!feature) {
    return null;
  }

  return {
    ...feature,
    properties: {
      polygonId: polygon.id,
      polygonKind: polygon.kind
    }
  };
};

export const buildQuotePreviewFeatureCollection = (
  polygons: EditablePolygon[]
): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: polygons
    .map((polygon) => toPreviewFeature(polygon))
    .filter((feature): feature is Feature<Polygon> => feature !== null)
});

export const getQuotePreviewBounds = (
  center: LngLat,
  polygons: EditablePolygon[]
): LngLatBounds | null => {
  const polygonBounds = polygons.map((polygon) => getLngLatBounds(polygon.ringPoints));
  const mergedBounds = mergeLngLatBounds(...polygonBounds, getLngLatBounds([center]));

  return mergedBounds
    ? padLngLatBounds(mergedBounds, {
        paddingRatio: 0.08,
        minPadding: 0.00018
      })
    : null;
};
