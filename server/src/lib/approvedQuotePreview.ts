import type { Feature, Polygon } from 'geojson';
import type { QuoteGeometry } from '../types.js';

interface ApprovedQuotePreviewInput {
  approvedGeometry: QuoteGeometry;
  addedGeometry?: QuoteGeometry | null;
  removedGeometry?: QuoteGeometry | null;
  width?: number;
  height?: number;
  mapboxAccessToken?: string | null;
}

type LngLat = [number, number];

const SATELLITE_STYLE = 'mapbox/satellite-v9';
const MAX_MAPBOX_STATIC_URL_LENGTH = 8192;

const QUOTE_TOOL_APPROVED_STYLE = {
  fill: '#329F5B',
  fillOpacity: 0.24,
  stroke: '#BFEBCF',
  strokeWidth: 2.1,
  strokeOpacity: 0.95
} as const;

const QUOTE_TOOL_ADDED_STYLE = {
  fill: '#BFEBCF',
  fillOpacity: 0.54,
  stroke: '#FFFFFF',
  strokeWidth: 3.2,
  strokeOpacity: 0.95
} as const;

const QUOTE_TOOL_REMOVED_STYLE = {
  fill: '#DC2626',
  fillOpacity: 0.42,
  stroke: '#FFE4E6',
  strokeWidth: 3.2,
  strokeOpacity: 0.95
} as const;

export const getApprovedQuotePreviewMapboxAccessToken = (configuredToken?: string | null) =>
  configuredToken?.trim() ||
  process.env.MAPBOX_STATIC_ACCESS_TOKEN?.trim() ||
  process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
  process.env.VITE_MAPBOX_TOKEN?.trim() ||
  '';

const geometryToFeatures = (
  geometry: QuoteGeometry,
  properties: Record<string, string | number>
): Feature<Polygon>[] => {
  if (geometry.type === 'Polygon') {
    return [
      {
        type: 'Feature',
        properties,
        geometry
      }
    ];
  }

  return geometry.coordinates.map((coordinates) => ({
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates
    }
  }));
};

const collectGeometryPoints = (geometry: QuoteGeometry): LngLat[] => {
  const points: LngLat[] = [];

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => {
      ring.forEach(([lng, lat]) => points.push([lng, lat]));
    });
  } else {
    geometry.coordinates.forEach((polygonCoordinates) => {
      polygonCoordinates.forEach((ring) => {
        ring.forEach(([lng, lat]) => points.push([lng, lat]));
      });
    });
  }

  return points;
};

const hasGeometryPoints = (geometry: QuoteGeometry | null | undefined) =>
  Boolean(geometry && collectGeometryPoints(geometry).length > 0);

const buildMapboxGeoJsonOverlay = (
  geometry: QuoteGeometry,
  style: {
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
  }
) =>
  `geojson(${encodeURIComponent(
    JSON.stringify({
      type: 'FeatureCollection',
      features: geometryToFeatures(geometry, {
        fill: style.fill,
        'fill-opacity': style.fillOpacity,
        stroke: style.stroke,
        'stroke-width': style.strokeWidth,
        'stroke-opacity': style.strokeOpacity
      })
    })
  )})`;

export const buildApprovedQuotePreviewMapboxUrl = ({
  approvedGeometry,
  addedGeometry = null,
  removedGeometry = null,
  width = 600,
  height = 380,
  mapboxAccessToken
}: ApprovedQuotePreviewInput) => {
  const token = getApprovedQuotePreviewMapboxAccessToken(mapboxAccessToken);
  if (!token || !hasGeometryPoints(approvedGeometry)) {
    return null;
  }

  const overlays = [
    buildMapboxGeoJsonOverlay(approvedGeometry, QUOTE_TOOL_APPROVED_STYLE),
    addedGeometry && hasGeometryPoints(addedGeometry)
      ? buildMapboxGeoJsonOverlay(addedGeometry, QUOTE_TOOL_ADDED_STYLE)
      : null,
    removedGeometry && hasGeometryPoints(removedGeometry)
      ? buildMapboxGeoJsonOverlay(removedGeometry, QUOTE_TOOL_REMOVED_STYLE)
      : null
  ].filter((overlay): overlay is string => overlay !== null);

  const url =
    `https://api.mapbox.com/styles/v1/${SATELLITE_STYLE}/static/` +
    `${overlays.join(',')}/auto/${width}x${height}` +
    `?padding=28&access_token=${encodeURIComponent(token)}`;

  return url.length <= MAX_MAPBOX_STATIC_URL_LENGTH ? url : null;
};
