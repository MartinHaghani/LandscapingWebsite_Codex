import { useEffect, useMemo, useRef } from 'react';
import mapboxgl, { type GeoJSONSource, type LngLatBoundsLike, type Map } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { AdminRequestMapPoint } from '../lib/api';
import { addAdminMapContextLayers, ADMIN_MAP_STYLE } from '../lib/adminMapContextLayers';

interface RequestsMapProps {
  points: AdminRequestMapPoint[];
  showHeatmap: boolean;
  showClusters: boolean;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const emptyCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: 'FeatureCollection',
  features: []
};

export const RequestsMap = ({ points, showHeatmap, showClusters }: RequestsMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  const sourceData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: points.map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lng, point.lat]
        },
        properties: {
          id: point.id,
          addressText: point.addressText,
          source: point.source,
          status: point.status,
          createdAt: point.createdAt
        }
      }))
    }),
    [points]
  );
  const sourceDataRef = useRef(sourceData);

  useEffect(() => {
    sourceDataRef.current = sourceData;
  }, [sourceData]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: ADMIN_MAP_STYLE,
      center: [-79.51962, 43.844147],
      zoom: 9,
      maxZoom: 19,
      minZoom: 3,
      pitch: 0,
      bearing: 0,
      maxPitch: 0
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      addAdminMapContextLayers(map);

      map.addSource('requests', {
        type: 'geojson',
        data: sourceDataRef.current ?? emptyCollection,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 46
      });

      map.addLayer({
        id: 'requests-heat',
        type: 'heatmap',
        source: 'requests',
        maxzoom: 11,
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            0,
            0.25,
            25,
            0.75,
            100,
            1
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 11, 1.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(50,159,91,0)',
            0.25,
            'rgba(50,159,91,0.3)',
            0.5,
            'rgba(50,159,91,0.55)',
            0.75,
            'rgba(50,159,91,0.75)',
            1,
            'rgba(102,255,153,0.9)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 16, 11, 34],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 11, 0.35]
        }
      });

      map.addLayer({
        id: 'requests-clusters',
        type: 'circle',
        source: 'requests',
        filter: ['has', 'point_count'],
        minzoom: 6,
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#329F5B',
            20,
            '#29c864',
            60,
            '#8bffaf'
          ],
          'circle-radius': ['step', ['get', 'point_count'], 14, 20, 19, 60, 24],
          'circle-opacity': 0.86,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.6
        }
      });

      map.addLayer({
        id: 'requests-cluster-count',
        type: 'symbol',
        source: 'requests',
        filter: ['has', 'point_count'],
        minzoom: 6,
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#08110d'
        }
      });

      map.addLayer({
        id: 'requests-points',
        type: 'circle',
        source: 'requests',
        filter: ['!', ['has', 'point_count']],
        minzoom: 10,
        paint: {
          'circle-color': '#8bffaf',
          'circle-radius': 6,
          'circle-stroke-color': '#101713',
          'circle-stroke-width': 1.4,
          'circle-opacity': 0.95
        }
      });

      map.on('click', 'requests-clusters', (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ['requests-clusters'] });
        const feature = features[0];
        if (!feature) {
          return;
        }

        const clusterId = feature.properties?.cluster_id as number | undefined;
        const source = map.getSource('requests') as GeoJSONSource | undefined;
        if (clusterId === undefined || !source) {
          return;
        }

        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || typeof zoom !== 'number' || !feature.geometry || feature.geometry.type !== 'Point') {
            return;
          }

          map.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom
          });
        });
      });

      map.on('click', 'requests-points', (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') {
          return;
        }

        const props = feature.properties as {
          addressText?: string;
          source?: string;
          status?: string;
          createdAt?: string;
        };

        const html = `
          <div style="font-size:12px;color:#4d5f53;line-height:1.5;min-width:180px;">
            <strong style="color:#101713;display:block;margin-bottom:4px;">${props.addressText ?? 'Request'}</strong>
            <div>Source: ${props.source ?? 'n/a'}</div>
            <div>Status: ${props.status ?? 'n/a'}</div>
            <div>Created: ${props.createdAt ? new Date(props.createdAt).toLocaleString() : 'n/a'}</div>
          </div>
        `;

        new mapboxgl.Popup({ closeButton: false, closeOnMove: true })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseenter', 'requests-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'requests-clusters', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', 'requests-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'requests-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource('requests') as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source?.setData(sourceData);

    if (sourceData.features.length === 0) {
      return;
    }

    if (sourceData.features.length === 1) {
      const [lng, lat] = sourceData.features[0].geometry.coordinates;
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16.5) });
      return;
    }

    const bounds = sourceData.features.reduce(
      (accumulator, feature) => {
        accumulator.extend(feature.geometry.coordinates as [number, number]);
        return accumulator;
      },
      new mapboxgl.LngLatBounds(
        sourceData.features[0].geometry.coordinates as [number, number],
        sourceData.features[0].geometry.coordinates as [number, number]
      )
    );

    map.fitBounds(bounds as LngLatBoundsLike, { padding: 52, duration: 600, maxZoom: 16.5 });
  }, [sourceData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (map.getLayer('requests-heat')) {
      map.setLayoutProperty('requests-heat', 'visibility', showHeatmap ? 'visible' : 'none');
    }
    if (map.getLayer('requests-clusters')) {
      map.setLayoutProperty('requests-clusters', 'visibility', showClusters ? 'visible' : 'none');
    }
    if (map.getLayer('requests-cluster-count')) {
      map.setLayoutProperty('requests-cluster-count', 'visibility', showClusters ? 'visible' : 'none');
    }
    if (map.getLayer('requests-points')) {
      map.setLayoutProperty('requests-points', 'visibility', showClusters ? 'visible' : 'none');
    }
  }, [showClusters, showHeatmap]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="requests-map" aria-label="Service area request map">
        <div className="requests-map-fallback">
          Add VITE_MAPBOX_TOKEN to enable the satellite request map.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="requests-map" aria-label="Service area request map" />;
};
