import type { FeatureCollection, Geometry, GeometryCollection, Position } from 'geojson';
import type { LngLat } from '../types';

export type LngLatBounds = [LngLat, LngLat];

const extractCoordinates = (
  coordinates: Position[] | Position[][] | Position[][][]
): LngLat[] => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return [];
  }

  const first = coordinates[0];
  if (typeof first[0] === 'number') {
    return (coordinates as Position[]).map((coordinate) => [coordinate[0], coordinate[1]]);
  }

  return (coordinates as Array<Position[] | Position[][]>).flatMap((nested) =>
    extractCoordinates(nested as Position[] | Position[][] | Position[][][])
  );
};

const extractGeometryCoordinates = (geometry: Geometry): LngLat[] => {
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap((nestedGeometry) => extractGeometryCoordinates(nestedGeometry));
  }

  if (geometry.type === 'Point') {
    return [[geometry.coordinates[0], geometry.coordinates[1]]];
  }

  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    return extractCoordinates(geometry.coordinates as Position[]);
  }

  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return extractCoordinates(geometry.coordinates as Position[][]);
  }

  return extractCoordinates(geometry.coordinates as Position[][][]);
};

export const getLngLatBounds = (points: LngLat[]): LngLatBounds | null => {
  if (points.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
};

export const mergeLngLatBounds = (
  ...boundsCollection: Array<LngLatBounds | null | undefined>
): LngLatBounds | null => {
  const validBounds = boundsCollection.filter(
    (bounds): bounds is LngLatBounds => bounds !== null && bounds !== undefined
  );

  if (validBounds.length === 0) {
    return null;
  }

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  validBounds.forEach((bounds) => {
    minLng = Math.min(minLng, bounds[0][0]);
    minLat = Math.min(minLat, bounds[0][1]);
    maxLng = Math.max(maxLng, bounds[1][0]);
    maxLat = Math.max(maxLat, bounds[1][1]);
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
};

export const padLngLatBounds = (
  bounds: LngLatBounds,
  { paddingRatio = 0.18, minPadding = 0.0007 }: { paddingRatio?: number; minPadding?: number } = {}
): LngLatBounds => {
  const lngSpan = bounds[1][0] - bounds[0][0];
  const latSpan = bounds[1][1] - bounds[0][1];
  const lngPadding = Math.max(lngSpan * paddingRatio, minPadding);
  const latPadding = Math.max(latSpan * paddingRatio, minPadding);

  return [
    [bounds[0][0] - lngPadding, bounds[0][1] - latPadding],
    [bounds[1][0] + lngPadding, bounds[1][1] + latPadding]
  ];
};

export const getFeatureCollectionBounds = (
  featureCollection: FeatureCollection,
  highlightedLocation?: LngLat
): LngLatBounds | null => {
  const points = featureCollection.features.flatMap((feature) =>
    extractGeometryCoordinates(feature.geometry as Geometry | GeometryCollection)
  );

  if (highlightedLocation) {
    points.push(highlightedLocation);
  }

  return getLngLatBounds(points);
};

export const boundsToBboxString = (bounds: LngLatBounds) =>
  `${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`;
