import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { EditablePolygon, LngLat, PolygonKind, SelectionTarget } from '../lib/quoteEditorTypes';
import { buildPolygonFeature } from '../lib/quoteEditorGeometry';
import 'maplibre-gl/dist/maplibre-gl.css';

const styleSpec: StyleSpecification = {
  version: 8,
  sources: {
    dark_tiles: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'dark_tiles',
      type: 'raster',
      source: 'dark_tiles',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

interface QuoteEditorMapProps {
  center: LngLat;
  drawing: boolean;
  selection: SelectionTarget;
  polygons: EditablePolygon[];
  activePolygonId: string | null;
  onPointAdd: (polygonId: string, point: LngLat) => void;
  onPolygonPointsChange: (polygonId: string, points: LngLat[]) => void;
  onSelectionChange: (selection: SelectionTarget) => void;
}

const POLYGON_SOURCE_ID = 'quote-polygons-source';
const PATH_SOURCE_ID = 'quote-active-path-source';
const CENTER_SOURCE_ID = 'quote-center-source';
const POLYGON_FILL_LAYER_ID = 'quote-polygons-fill';
const POLYGON_OUTLINE_LAYER_ID = 'quote-polygons-outline';
const PATH_LAYER_ID = 'quote-active-path-line';
const CENTER_LAYER_ID = 'quote-center-point';

const getSelectedPolygonId = (selection: SelectionTarget) => {
  if (selection.kind === 'none') {
    return null;
  }

  return selection.polygonId;
};

const activePathFeatureCollection = (activePolygon: EditablePolygon | undefined): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features:
    activePolygon && activePolygon.points.length >= 2
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: activePolygon.points
            },
            properties: {
              polygonId: activePolygon.id,
              polygonKind: activePolygon.kind
            }
          }
        ]
      : []
});

const markerStyleByKind = (kind: PolygonKind, selected: boolean) => {
  if (kind === 'obstacle') {
    return selected
      ? {
          width: '20px',
          height: '20px',
          borderColor: '#FFE4E6',
          backgroundColor: '#DC2626',
          boxShadow: '0 0 26px rgba(239,68,68,0.9), 0 0 0 2px rgba(255,255,255,0.75)'
        }
      : {
          width: '16px',
          height: '16px',
          borderColor: '#FFFFFF',
          backgroundColor: '#DC2626',
          boxShadow: '0 0 18px rgba(239,68,68,0.55)'
        };
  }

  return selected
    ? {
        width: '20px',
        height: '20px',
        borderColor: '#9FF0BD',
        backgroundColor: '#329F5B',
        boxShadow: '0 0 26px rgba(50,159,91,0.9), 0 0 0 2px rgba(255,255,255,0.7)'
      }
    : {
        width: '16px',
        height: '16px',
        borderColor: '#FFFFFF',
        backgroundColor: '#329F5B',
        boxShadow: '0 0 18px rgba(50,159,91,0.55)'
      };
};

export const QuoteEditorMap = ({
  center,
  drawing,
  selection,
  polygons,
  activePolygonId,
  onPointAdd,
  onPolygonPointsChange,
  onSelectionChange
}: QuoteEditorMapProps) => {
  const selectedPolygonId = useMemo(() => getSelectedPolygonId(selection), [selection]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const drawingRef = useRef(drawing);
  const activePolygonIdRef = useRef(activePolygonId);
  const onPointAddRef = useRef(onPointAdd);
  const onPolygonPointsChangeRef = useRef(onPolygonPointsChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const centerRef = useRef(center);
  const selectedPolygonIdRef = useRef<string | null>(selectedPolygonId);
  const ignoreNextMapClickRef = useRef(false);
  const isMarkerDraggingRef = useRef(false);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    activePolygonIdRef.current = activePolygonId;
  }, [activePolygonId]);

  useEffect(() => {
    onPointAddRef.current = onPointAdd;
  }, [onPointAdd]);

  useEffect(() => {
    onPolygonPointsChangeRef.current = onPolygonPointsChange;
  }, [onPolygonPointsChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    selectedPolygonIdRef.current = selectedPolygonId;
  }, [selectedPolygonId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleSpec,
      center,
      zoom: 16,
      pitch: 0,
      bearing: 0,
      maxPitch: 0
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      'top-right'
    );

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      if (isMarkerDraggingRef.current) {
        return;
      }

      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        return;
      }

      const currentTargetPolygonId = activePolygonIdRef.current ?? selectedPolygonIdRef.current;
      if (drawingRef.current) {
        if (!currentTargetPolygonId) {
          return;
        }

        onPointAddRef.current(currentTargetPolygonId, [event.lngLat.lng, event.lngLat.lat]);
        return;
      }

      const clickedFeatures = map.queryRenderedFeatures(event.point, {
        layers: [POLYGON_FILL_LAYER_ID, POLYGON_OUTLINE_LAYER_ID]
      });

      const clickedPolygonId = clickedFeatures
        .map((feature) => feature.properties?.polygonId)
        .find((value) => typeof value === 'string');

      if (clickedPolygonId) {
        onSelectionChangeRef.current({ kind: 'polygon', polygonId: clickedPolygonId });
        return;
      }

      onSelectionChangeRef.current({ kind: 'none' });
    };

    map.on('click', handleMapClick);

    map.on('load', () => {
      const polygonFeatureCollection: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: []
      };

      const pathFeatureCollection: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
      };

      const centerFeature: FeatureCollection<Point> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: centerRef.current
            },
            properties: {
              title: 'Property center'
            }
          }
        ]
      };

      map.addSource(POLYGON_SOURCE_ID, {
        type: 'geojson',
        data: polygonFeatureCollection
      });

      map.addSource(PATH_SOURCE_ID, {
        type: 'geojson',
        data: pathFeatureCollection
      });

      map.addSource(CENTER_SOURCE_ID, {
        type: 'geojson',
        data: centerFeature
      });

      map.addLayer({
        id: POLYGON_FILL_LAYER_ID,
        source: POLYGON_SOURCE_ID,
        type: 'fill',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'polygonKind'], 'obstacle'],
            '#DC2626',
            '#329F5B'
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'polygonKind'], 'obstacle'],
            ['case', ['==', ['get', 'selected'], true], 0.42, 0.2],
            ['case', ['==', ['get', 'selected'], true], 0.54, 0.24]
          ]
        }
      });

      map.addLayer({
        id: POLYGON_OUTLINE_LAYER_ID,
        source: POLYGON_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'polygonKind'], 'obstacle'],
            ['case', ['==', ['get', 'selected'], true], '#FFE4E6', '#FDA4AF'],
            ['case', ['==', ['get', 'selected'], true], '#FFFFFF', '#BFEBCF']
          ],
          'line-width': ['case', ['==', ['get', 'selected'], true], 3.2, 2.1]
        }
      });

      map.addLayer({
        id: PATH_LAYER_ID,
        source: PATH_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'polygonKind'], 'obstacle'],
            '#FDA4AF',
            '#7DE8A6'
          ],
          'line-width': 2,
          'line-dasharray': [2, 1]
        }
      });

      map.addLayer({
        id: CENTER_LAYER_ID,
        source: CENTER_SOURCE_ID,
        type: 'circle',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#329F5B'
        }
      });
    });

    mapRef.current = map;

    return () => {
      vertexMarkersRef.current.forEach((marker) => marker.remove());
      vertexMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.flyTo({
      center,
      zoom: 17,
      speed: 1,
      essential: true
    });

    const centerSource = map.getSource(CENTER_SOURCE_ID) as GeoJSONSource | undefined;
    if (!centerSource) {
      return;
    }

    centerSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: center
          },
          properties: {
            title: 'Property center'
          }
        }
      ]
    });
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const polygonSource = map.getSource(POLYGON_SOURCE_ID) as GeoJSONSource | undefined;
    if (polygonSource) {
      polygonSource.setData({
        type: 'FeatureCollection',
        features: polygons
          .map((polygonState) => {
            const feature = buildPolygonFeature(polygonState.points);
            if (!feature) {
              return null;
            }

            return {
              ...feature,
              properties: {
                polygonId: polygonState.id,
                polygonKind: polygonState.kind,
                selected: polygonState.id === selectedPolygonId
              }
            };
          })
          .filter((feature): feature is NonNullable<typeof feature> => feature !== null)
      });
    }

    const pathSource = map.getSource(PATH_SOURCE_ID) as GeoJSONSource | undefined;
    if (pathSource) {
      const activePolygon = polygons.find((polygonState) => polygonState.id === activePolygonId);
      pathSource.setData(activePathFeatureCollection(activePolygon));
    }
  }, [polygons, selectedPolygonId, activePolygonId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.getCanvas().style.cursor = drawing ? 'crosshair' : 'grab';
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    vertexMarkersRef.current.forEach((marker) => marker.remove());
    vertexMarkersRef.current = [];

    if (!selectedPolygonId) {
      return;
    }

    const selectedPolygon = polygons.find((polygonState) => polygonState.id === selectedPolygonId);
    if (!selectedPolygon || selectedPolygon.points.length === 0) {
      return;
    }

    const markers = selectedPolygon.points.map((point, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'rounded-full border-2';

      const isSelectedVertex =
        selection.kind === 'vertex' &&
        selection.polygonId === selectedPolygonId &&
        selection.index === index;

      const markerStyle = markerStyleByKind(selectedPolygon.kind, isSelectedVertex);
      element.style.width = markerStyle.width;
      element.style.height = markerStyle.height;
      element.style.borderColor = markerStyle.borderColor;
      element.style.backgroundColor = markerStyle.backgroundColor;
      element.style.boxShadow = markerStyle.boxShadow;
      element.style.cursor = 'grab';

      element.setAttribute('aria-label', `Vertex ${index + 1}`);

      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectionChangeRef.current({ kind: 'vertex', polygonId: selectedPolygonId, index });
      });

      const marker = new maplibregl.Marker({ element, draggable: true }).setLngLat(point).addTo(map);

      marker.on('dragstart', () => {
        isMarkerDraggingRef.current = true;
        element.style.cursor = 'grabbing';
      });

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const nextPoints = selectedPolygon.points.map((existingPoint) => [...existingPoint] as LngLat);
        nextPoints[index] = [lngLat.lng, lngLat.lat];
        onPolygonPointsChangeRef.current(selectedPolygonId, nextPoints);

        ignoreNextMapClickRef.current = true;
        isMarkerDraggingRef.current = false;
        element.style.cursor = 'grab';
      });

      return marker;
    });

    vertexMarkersRef.current = markers;

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [polygons, selection, selectedPolygonId]);

  const selectedPolygonPointCount =
    selectedPolygonId === null
      ? 0
      : polygons.find((polygonState) => polygonState.id === selectedPolygonId)?.points.length ?? 0;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '620px',
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid var(--border)'
      }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {selectedPolygonPointCount > 2 ? (
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: '1rem',
            bottom: '1rem',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(0,0,0,0.78)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.8)'
          }}
        >
          Polygon closes automatically for geodesic calculations.
        </div>
      ) : null}
    </div>
  );
};
