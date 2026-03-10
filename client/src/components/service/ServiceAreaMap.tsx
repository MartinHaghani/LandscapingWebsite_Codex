import { useEffect, useMemo, useRef } from 'react';
import mapboxgl, { type GeoJSONSource } from 'mapbox-gl';
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import type { LngLat, ServiceAreaResponse } from '../../types';

interface ServiceAreaMapProps {
  token: string;
  serviceArea: ServiceAreaResponse | null;
  showOverlay: boolean;
  highlightedLocation?: LngLat;
  highlightedLabel?: string;
}

const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const SOURCE_ID = 'service-area-source';
const FILL_LAYER_ID = 'service-area-fill-layer';
const LINE_LAYER_ID = 'service-area-line-layer';
const DEFAULT_CENTER: [number, number] = [-96.797, 32.7767];
const MAX_ZOOM = 15;

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Polygon | MultiPolygon> = {
  type: 'FeatureCollection',
  features: []
};

const extractCoordinates = (coordinates: Position[] | Position[][] | Position[][][]): [number, number][] => {
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

const getBounds = (
  featureCollection: FeatureCollection<Polygon | MultiPolygon>,
  highlightedLocation?: LngLat
) => {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  featureCollection.features.forEach((feature) => {
    const coordinates = extractCoordinates(feature.geometry.coordinates as Position[] | Position[][] | Position[][][]);

    coordinates.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  if (highlightedLocation) {
    minLng = Math.min(minLng, highlightedLocation[0]);
    minLat = Math.min(minLat, highlightedLocation[1]);
    maxLng = Math.max(maxLng, highlightedLocation[0]);
    maxLat = Math.max(maxLat, highlightedLocation[1]);
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ] as [[number, number], [number, number]];
};

export const ServiceAreaMap = ({
  token,
  serviceArea,
  showOverlay,
  highlightedLocation,
  highlightedLabel
}: ServiceAreaMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  const showOverlayRef = useRef(showOverlay);
  const featureCollectionRef = useRef<FeatureCollection<Polygon | MultiPolygon>>(EMPTY_FEATURE_COLLECTION);
  const highlightedLocationRef = useRef<LngLat | undefined>(highlightedLocation);

  const featureCollection = useMemo<FeatureCollection<Polygon | MultiPolygon>>(
    () =>
      serviceArea
        ? {
            type: 'FeatureCollection',
            features: serviceArea.features.map((feature) => ({
              type: 'Feature',
              properties: {},
              geometry: feature.geometry
            }))
          }
        : EMPTY_FEATURE_COLLECTION,
    [serviceArea]
  );

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    featureCollectionRef.current = featureCollection;
  }, [featureCollection]);

  useEffect(() => {
    highlightedLocationRef.current = highlightedLocation;
  }, [highlightedLocation]);

  const applySourceDataAndFit = (
    map: mapboxgl.Map,
    collection: FeatureCollection<Polygon | MultiPolygon>,
    markerLocation?: LngLat,
    force = false
  ) => {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData(collection);

    const bounds = getBounds(collection, markerLocation);
    const fitKey = bounds
      ? `${bounds[0][0]}:${bounds[0][1]}:${bounds[1][0]}:${bounds[1][1]}:${markerLocation?.join(',') ?? 'none'}`
      : `none:${markerLocation?.join(',') ?? 'none'}`;

    if (!force && lastFitKeyRef.current === fitKey) {
      return;
    }

    if (bounds) {
      map.fitBounds(bounds, {
        padding: 28,
        duration: 650,
        maxZoom: markerLocation ? 13 : 11
      });
    } else if (markerLocation) {
      map.flyTo({ center: markerLocation, zoom: 12, duration: 650 });
    }

    lastFitKeyRef.current = fitKey;
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: 8,
      minZoom: 4,
      maxZoom: MAX_ZOOM,
      attributionControl: true
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      'top-right'
    );

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const setOverlayVisibility = (visible: boolean) => {
      const visibility = visible ? 'visible' : 'none';

      if (map.getLayer(FILL_LAYER_ID)) {
        map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
      }

      if (map.getLayer(LINE_LAYER_ID)) {
        map.setLayoutProperty(LINE_LAYER_ID, 'visibility', visibility);
      }
    };

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION
      });

      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#329F5B',
          'fill-opacity': 0.28
        }
      });

      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#329F5B',
          'line-width': 2.4,
          'line-opacity': 0.82
        }
      });

      setOverlayVisibility(showOverlayRef.current);
      applySourceDataAndFit(map, featureCollectionRef.current, highlightedLocationRef.current, true);
    });

    map.on('click', (event) => {
      if (!showOverlayRef.current) {
        popupRef.current?.remove();
        popupRef.current = null;
        return;
      }

      if (!map.getLayer(FILL_LAYER_ID)) {
        return;
      }

      const coverageFeatures = map.queryRenderedFeatures(event.point, {
        layers: [FILL_LAYER_ID]
      });

      if (coverageFeatures.length === 0) {
        popupRef.current?.remove();
        popupRef.current = null;
        return;
      }

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnMove: true,
        maxWidth: '240px',
        offset: 12
      })
        .setLngLat([event.lngLat.lng, event.lngLat.lat])
        .setHTML('<p style="margin:0;font-size:12px;">Within approximate service area</p>')
        .addTo(map);
    });

    map.getCanvas().addEventListener('contextmenu', handleContextMenu);

    mapRef.current = map;

    return () => {
      map.getCanvas().removeEventListener('contextmenu', handleContextMenu);
      markerRef.current?.remove();
      markerRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    applySourceDataAndFit(map, featureCollection, highlightedLocation);
  }, [featureCollection, highlightedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const visibility = showOverlay ? 'visible' : 'none';
    if (map.getLayer(FILL_LAYER_ID)) {
      map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
    }

    if (map.getLayer(LINE_LAYER_ID)) {
      map.setLayoutProperty(LINE_LAYER_ID, 'visibility', visibility);
    }
  }, [showOverlay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markerRef.current?.remove();
    markerRef.current = null;

    if (!highlightedLocation) {
      return;
    }

    const markerElement = document.createElement('div');
    markerElement.className =
      'h-5 w-5 rounded-full border-2 border-white bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.2)]';

    const marker = new mapboxgl.Marker({ element: markerElement })
      .setLngLat(highlightedLocation)
      .setPopup(new mapboxgl.Popup({ offset: 14 }).setText(highlightedLabel ?? 'Entered address'))
      .addTo(map);

    markerRef.current = marker;
  }, [highlightedLocation, highlightedLabel]);

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-white/15 shadow-soft md:h-[360px]">
      <div
        ref={containerRef}
        className="h-full w-full"
        tabIndex={0}
        aria-label="Approximate service coverage map"
      />
      {!showOverlay ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/80 px-3 py-1 text-xs text-white/70">
          Service area overlay hidden
        </div>
      ) : null}
    </div>
  );
};
