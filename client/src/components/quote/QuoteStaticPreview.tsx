import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, LngLatBoundsLike, Map, Marker } from 'mapbox-gl';
import { cn } from '../../lib/cn';
import { buildQuotePreviewFeatureCollection, getQuotePreviewBounds } from '../../lib/quoteStaticPreview';
import type { EditablePolygon, LngLat } from '../../types';

interface QuoteStaticPreviewProps {
  token?: string;
  center: LngLat;
  polygons: EditablePolygon[];
  address: string;
  className?: string;
}

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-v9';
const PREVIEW_SOURCE_ID = 'quote-preview-source';
const PREVIEW_FILL_LAYER_ID = 'quote-preview-fill';
const PREVIEW_OUTLINE_LAYER_ID = 'quote-preview-outline';

const createHomeMarkerElement = () => {
  const element = document.createElement('div');
  element.style.width = '34px';
  element.style.height = '34px';
  element.style.borderRadius = '999px';
  element.style.display = 'grid';
  element.style.placeItems = 'center';
  element.style.background = '#FFFFFF';
  element.style.border = '2px solid rgba(50,159,91,0.16)';
  element.style.boxShadow = '0 12px 22px rgba(15,23,42,0.18)';
  element.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.75L12 4l8 6.75v8.25a1 1 0 0 1-1 1h-4.75v-5.5h-4.5V20H5a1 1 0 0 1-1-1v-8.25Z" fill="#329F5B"/><path d="M9.75 20v-5.5h4.5V20" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return element;
};

export const QuoteStaticPreview = ({
  token,
  center,
  polygons,
  address,
  className
}: QuoteStaticPreviewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

  const featureCollection = useMemo(
    () => buildQuotePreviewFeatureCollection(polygons),
    [polygons]
  );
  const previewBounds = useMemo(
    () => getQuotePreviewBounds(center, polygons),
    [center, polygons]
  );

  const applyPreviewViewport = (map: Map, bounds: LngLatBoundsLike | null, nextCenter: LngLat) => {
    if (bounds) {
      map.fitBounds(bounds, {
        padding: 18,
        duration: 0,
        maxZoom: 19.2
      });
      return;
    }

    map.jumpTo({ center: nextCenter, zoom: 18.4 });
  };

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || typeof window === 'undefined') {
      if (!token) {
        setPreviewUnavailable(true);
      }
      return;
    }

    let cancelled = false;
    let previewMap: Map | null = null;
    let previewMarker: Marker | null = null;

    const initializePreview = async () => {
      try {
        const { default: mapboxgl } = await import('mapbox-gl');

        if (cancelled || !containerRef.current) {
          return;
        }

        setPreviewUnavailable(false);
        mapboxgl.accessToken = token;
        previewMap = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center,
          zoom: 17,
          pitch: 0,
          bearing: 0,
          maxPitch: 0,
          antialias: true,
          interactive: false,
          attributionControl: false
        });

        previewMap.on('error', () => {
          setPreviewUnavailable(true);
        });

        previewMap.on('load', () => {
          if (!previewMap || cancelled) {
            return;
          }

          previewMap.addSource(PREVIEW_SOURCE_ID, {
            type: 'geojson',
            data: featureCollection
          });

          previewMap.addLayer({
            id: PREVIEW_FILL_LAYER_ID,
            type: 'fill',
            source: PREVIEW_SOURCE_ID,
            paint: {
              'fill-color': [
                'match',
                ['get', 'polygonKind'],
                'obstacle',
                '#DC2626',
                '#329F5B'
              ],
              'fill-opacity': ['match', ['get', 'polygonKind'], 'obstacle', 0.34, 0.3]
            }
          });

          previewMap.addLayer({
            id: PREVIEW_OUTLINE_LAYER_ID,
            type: 'line',
            source: PREVIEW_SOURCE_ID,
            paint: {
              'line-color': ['match', ['get', 'polygonKind'], 'obstacle', '#FFE4E6', '#FFFFFF'],
              'line-width': ['match', ['get', 'polygonKind'], 'obstacle', 2.4, 2.8],
              'line-opacity': 0.95
            }
          });

          previewMarker = new mapboxgl.Marker({
            element: createHomeMarkerElement(),
            anchor: 'center'
          })
            .setLngLat(center)
            .addTo(previewMap);

          markerRef.current = previewMarker;
          mapRef.current = previewMap;
          previewMap.resize();
          applyPreviewViewport(previewMap, previewBounds as LngLatBoundsLike | null, center);
        });
      } catch {
        setPreviewUnavailable(true);
      }
    };

    void initializePreview();

    return () => {
      cancelled = true;
      previewMarker?.remove();
      markerRef.current = null;
      previewMap?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection);
    markerRef.current?.setLngLat(center);

    if (previewBounds) {
      applyPreviewViewport(map, previewBounds as LngLatBoundsLike, center);
    } else {
      applyPreviewViewport(map, null, center);
    }
  }, [center, featureCollection, previewBounds]);

  return (
    <div
      className={cn(
        'relative min-h-[250px] overflow-hidden rounded-[28px] border border-stroke bg-surface-raised shadow-soft sm:min-h-[280px]',
        className
      )}
      data-quote-preview="true"
    >
      <div
        ref={containerRef}
        className={cn(
          'absolute inset-0 transition-opacity duration-200',
          previewUnavailable ? 'opacity-0' : 'opacity-100'
        )}
        aria-label={`Property preview for ${address}`}
      />

      {previewUnavailable ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#eff6f1_0%,#f8faf8_54%,#ffffff_100%)] px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-ink">Property preview unavailable</p>
            <p className="mt-1 text-sm text-copy-muted">
              Refresh the page or continue with the written quote details.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
