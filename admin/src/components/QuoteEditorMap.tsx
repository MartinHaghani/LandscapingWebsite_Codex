import { useEffect, useMemo, useRef } from 'react';
import mapboxgl, { type GeoJSONSource } from 'mapbox-gl';
import type { FeatureCollection, LineString, Polygon } from 'geojson';
import type { EditablePolygon, LngLat, PolygonKind, SelectionTarget } from '../lib/quoteEditorTypes';
import {
  ADD_VERTEX_CURSOR,
  EDGE_INSERTION_HIT_TOLERANCE_PX,
  findEdgeInsertionHit,
  insertPointIntoRing
} from '../lib/edgeInsertion';
import { finalizeFreehandStroke } from '../lib/freehand';
import { buildPolygonFeature } from '../lib/quoteEditorGeometry';
import {
  quotePolygonFillColorExpression,
  quotePolygonFillOpacityExpression,
  quotePolygonOutlineColorExpression,
  quotePolygonOutlineWidthExpression
} from '../lib/polygonPresentation';
import { addAdminMapContextLayers, ADMIN_MAP_STYLE } from '../lib/adminMapContextLayers';
import 'mapbox-gl/dist/mapbox-gl.css';

interface QuoteEditorMapProps {
  token: string;
  center: LngLat;
  drawMode: PolygonKind | null;
  selection: SelectionTarget;
  polygons: EditablePolygon[];
  activePolygonId: string | null;
  className?: string;
  onPolygonDrawn: (kind: PolygonKind, shape: { ringPoints: LngLat[]; rawStrokePoints: LngLat[] }) => void;
  onPolygonRingPointsChange: (polygonId: string, ringPoints: LngLat[]) => void;
  onSelectionChange: (selection: SelectionTarget) => void;
  onMapReady?: () => void;
}

const POLYGON_SOURCE_ID = 'quote-polygons-source';
const PATH_SOURCE_ID = 'quote-active-path-source';
const POLYGON_FILL_LAYER_ID = 'quote-polygons-fill';
const POLYGON_OUTLINE_LAYER_ID = 'quote-polygons-outline';
const PATH_LAYER_ID = 'quote-active-path-line';

const getSelectedPolygonId = (selection: SelectionTarget) => {
  if (selection.kind === 'none') {
    return null;
  }

  return selection.polygonId;
};

const activePathFeatureCollection = (
  activePolygon: EditablePolygon | undefined,
  strokePoints: LngLat[],
  strokeKind: PolygonKind | null
): FeatureCollection<LineString> => {
  if (strokeKind && strokePoints.length >= 2) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: strokePoints
          },
          properties: {
            polygonKind: strokeKind
          }
        }
      ]
    };
  }

  return {
    type: 'FeatureCollection',
    features:
      activePolygon && activePolygon.ringPoints.length >= 2
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: activePolygon.ringPoints
              },
              properties: {
                polygonId: activePolygon.id,
                polygonKind: activePolygon.kind
              }
            }
          ]
        : []
  };
};

const getVertexScaleForZoom = (zoom: number) => Math.min(1.2, Math.max(0.75, zoom / 18));

const markerStyleByKind = (kind: PolygonKind, selected: boolean, zoom: number) => {
  const scale = getVertexScaleForZoom(zoom);
  const selectedSize = `${Math.round(20 * scale)}px`;
  const defaultSize = `${Math.round(16 * scale)}px`;

  if (kind === 'obstacle') {
    return selected
      ? {
          width: selectedSize,
          height: selectedSize,
          borderColor: '#FFF7F7',
          backgroundColor: '#DC2626',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.85), 0 8px 16px rgba(220,38,38,0.45)'
        }
      : {
          width: defaultSize,
          height: defaultSize,
          borderColor: '#FFFFFF',
          backgroundColor: '#DC2626',
          boxShadow: '0 5px 12px rgba(220,38,38,0.45)'
        };
  }

  return selected
    ? {
        width: selectedSize,
        height: selectedSize,
        borderColor: '#D1FAE1',
        backgroundColor: '#329F5B',
        boxShadow: '0 0 0 2px rgba(255,255,255,0.85), 0 8px 16px rgba(50,159,91,0.45)'
      }
    : {
        width: defaultSize,
        height: defaultSize,
        borderColor: '#FFFFFF',
        backgroundColor: '#329F5B',
        boxShadow: '0 5px 12px rgba(50,159,91,0.45)'
      };
};

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

const applyMarkerStyle = (
  element: HTMLButtonElement,
  kind: PolygonKind,
  selected: boolean,
  zoom: number
) => {
  const markerStyle = markerStyleByKind(kind, selected, zoom);
  element.style.width = markerStyle.width;
  element.style.height = markerStyle.height;
  element.style.borderColor = markerStyle.borderColor;
  element.style.backgroundColor = markerStyle.backgroundColor;
  element.style.boxShadow = markerStyle.boxShadow;
};

export const QuoteEditorMap = ({
  token,
  center,
  drawMode,
  selection,
  polygons,
  activePolygonId,
  className,
  onPolygonDrawn,
  onPolygonRingPointsChange,
  onSelectionChange,
  onMapReady
}: QuoteEditorMapProps) => {
  const selectedPolygonId = useMemo(() => getSelectedPolygonId(selection), [selection]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const vertexMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const vertexMarkerElementsRef = useRef<
    Array<{ element: HTMLButtonElement; kind: PolygonKind; selected: boolean }>
  >([]);
  const drawModeRef = useRef<PolygonKind | null>(drawMode);
  const activePolygonIdRef = useRef(activePolygonId);
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onPolygonRingPointsChangeRef = useRef(onPolygonRingPointsChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onMapReadyRef = useRef(onMapReady);
  const centerRef = useRef(center);
  const polygonsRef = useRef(polygons);
  const selectedPolygonIdRef = useRef<string | null>(selectedPolygonId);
  const ignoreNextMapClickRef = useRef(false);
  const clearIgnoreNextMapClickTimeoutRef = useRef<number | null>(null);
  const isMarkerDraggingRef = useRef(false);
  const isStrokeDrawingRef = useRef(false);
  const strokePointsRef = useRef<LngLat[]>([]);
  const hoveredInsertHitRef = useRef<ReturnType<typeof findEdgeInsertionHit> | null>(null);
  const syncCanvasCursorRef = useRef<() => void>(() => {});

  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  useEffect(() => {
    activePolygonIdRef.current = activePolygonId;
  }, [activePolygonId]);

  useEffect(() => {
    onPolygonDrawnRef.current = onPolygonDrawn;
  }, [onPolygonDrawn]);

  useEffect(() => {
    onPolygonRingPointsChangeRef.current = onPolygonRingPointsChange;
  }, [onPolygonRingPointsChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  useEffect(() => {
    selectedPolygonIdRef.current = selectedPolygonId;
  }, [selectedPolygonId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: ADMIN_MAP_STYLE,
      center,
      zoom: 16,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      antialias: true
    });

    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      'bottom-right'
    );

    const syncActivePath = () => {
      const pathSource = map.getSource(PATH_SOURCE_ID) as GeoJSONSource | undefined;
      if (!pathSource) {
        return;
      }

      const activePolygon = polygonsRef.current.find((polygonState) => polygonState.id === activePolygonIdRef.current);
      pathSource.setData(
        activePathFeatureCollection(activePolygon, strokePointsRef.current, isStrokeDrawingRef.current ? drawModeRef.current : null)
      );
    };

    const syncPolygonSource = () => {
      const polygonSource = map.getSource(POLYGON_SOURCE_ID) as GeoJSONSource | undefined;
      if (!polygonSource) {
        return;
      }

      const selectedPolygonId = selectedPolygonIdRef.current;
      polygonSource.setData({
        type: 'FeatureCollection',
        features: polygonsRef.current
          .map((polygonState) => {
            const feature = buildPolygonFeature(polygonState.ringPoints);
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
    };

    const syncCanvasCursor = () => {
      if (drawModeRef.current) {
        map.getCanvas().style.cursor = 'crosshair';
        return;
      }

      map.getCanvas().style.cursor = hoveredInsertHitRef.current ? ADD_VERTEX_CURSOR : 'grab';
    };

    syncCanvasCursorRef.current = syncCanvasCursor;

    const getInsertHit = (point: { x: number; y: number }) => {
      const selectedPolygonId = selectedPolygonIdRef.current;
      if (!selectedPolygonId || isMarkerDraggingRef.current || drawModeRef.current) {
        return null;
      }

      const selectedPolygon = polygonsRef.current.find((polygonState) => polygonState.id === selectedPolygonId);
      if (!selectedPolygon || selectedPolygon.ringPoints.length < 2) {
        return null;
      }

      return findEdgeInsertionHit(
        selectedPolygon.ringPoints,
        point,
        {
          project: (lngLat) => {
            const projected = map.project(lngLat);
            return { x: projected.x, y: projected.y };
          },
          unproject: (screenPoint) => {
            const lngLat = map.unproject([screenPoint.x, screenPoint.y]);
            return [lngLat.lng, lngLat.lat] as LngLat;
          }
        },
        EDGE_INSERTION_HIT_TOLERANCE_PX
      );
    };

    const clearHoveredInsertHit = () => {
      hoveredInsertHitRef.current = null;
      syncCanvasCursor();
    };

    const syncVertexMarkerSizes = () => {
      const zoom = map.getZoom();
      vertexMarkerElementsRef.current.forEach(({ element, kind, selected }) => {
        applyMarkerStyle(element, kind, selected, zoom);
      });
    };

    const toLngLat = (clientX: number, clientY: number): LngLat => {
      const rect = map.getCanvas().getBoundingClientRect();
      const point = new mapboxgl.Point(clientX - rect.left, clientY - rect.top);
      const lngLat = map.unproject(point);
      return [lngLat.lng, lngLat.lat];
    };

    const finishStroke = () => {
      if (!isStrokeDrawingRef.current) {
        return;
      }

      isStrokeDrawingRef.current = false;
      map.dragPan.enable();

      const finalized = drawModeRef.current ? finalizeFreehandStroke(strokePointsRef.current) : null;

      strokePointsRef.current = [];
      syncActivePath();

      if (drawModeRef.current && finalized) {
        onPolygonDrawnRef.current(drawModeRef.current, finalized);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isStrokeDrawingRef.current || !drawModeRef.current) {
        return;
      }

      strokePointsRef.current = [...strokePointsRef.current, toLngLat(event.clientX, event.clientY)];
      syncActivePath();
    };

    const handlePointerUp = () => {
      finishStroke();
    };

    const handlePointerCancel = () => {
      finishStroke();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!drawModeRef.current || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      isStrokeDrawingRef.current = true;
      strokePointsRef.current = [toLngLat(event.clientX, event.clientY)];
      map.dragPan.disable();
      hoveredInsertHitRef.current = null;
      syncCanvasCursor();
      syncActivePath();
    };

    const canvas = map.getCanvas();
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    map.on('zoom', syncVertexMarkerSizes);

    const handleMapMouseMove = (event: mapboxgl.MapMouseEvent) => {
      hoveredInsertHitRef.current = getInsertHit({
        x: event.point.x,
        y: event.point.y
      });
      syncCanvasCursor();
    };

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      if (isMarkerDraggingRef.current || drawModeRef.current) {
        return;
      }

      if (ignoreNextMapClickRef.current) {
        ignoreNextMapClickRef.current = false;
        if (clearIgnoreNextMapClickTimeoutRef.current !== null) {
          window.clearTimeout(clearIgnoreNextMapClickTimeoutRef.current);
          clearIgnoreNextMapClickTimeoutRef.current = null;
        }
        return;
      }

      const insertHit = getInsertHit({
        x: event.point.x,
        y: event.point.y
      });
      const selectedPolygonId = selectedPolygonIdRef.current;

      if (insertHit && selectedPolygonId) {
        const selectedPolygon = polygonsRef.current.find((polygonState) => polygonState.id === selectedPolygonId);
        if (selectedPolygon) {
          const nextPoints = insertPointIntoRing(
            selectedPolygon.ringPoints,
            insertHit.insertIndex,
            insertHit.lngLat
          );
          onPolygonRingPointsChangeRef.current(selectedPolygon.id, nextPoints);
          onSelectionChangeRef.current({
            kind: 'vertex',
            polygonId: selectedPolygon.id,
            index: insertHit.insertIndex
          });
          hoveredInsertHitRef.current = null;
          syncCanvasCursor();
          return;
        }
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

    map.on('mousemove', handleMapMouseMove);
    map.on('click', handleMapClick);
    canvas.addEventListener('mouseleave', clearHoveredInsertHit);

    map.on('load', () => {
      addAdminMapContextLayers(map);

      const polygonFeatureCollection: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: []
      };

      const pathFeatureCollection: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
      };

      map.addSource(POLYGON_SOURCE_ID, {
        type: 'geojson',
        data: polygonFeatureCollection
      });

      map.addSource(PATH_SOURCE_ID, {
        type: 'geojson',
        data: pathFeatureCollection
      });

      map.addLayer({
        id: POLYGON_FILL_LAYER_ID,
        source: POLYGON_SOURCE_ID,
        type: 'fill',
        paint: {
          'fill-color': quotePolygonFillColorExpression,
          'fill-opacity': quotePolygonFillOpacityExpression
        }
      });

      map.addLayer({
        id: POLYGON_OUTLINE_LAYER_ID,
        source: POLYGON_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': quotePolygonOutlineColorExpression,
          'line-width': quotePolygonOutlineWidthExpression
        }
      });

      map.addLayer({
        id: PATH_LAYER_ID,
        source: PATH_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': ['case', ['==', ['get', 'polygonKind'], 'obstacle'], '#FDA4AF', '#7DE8A6'],
          'line-width': 2,
          'line-dasharray': [2, 1]
        }
      });

      syncPolygonSource();
      syncActivePath();
      onMapReadyRef.current?.();
    });

    centerMarkerRef.current = new mapboxgl.Marker({
      element: createHomeMarkerElement()
    })
      .setLngLat(centerRef.current)
      .addTo(map);

    mapRef.current = map;

    return () => {
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      vertexMarkersRef.current.forEach((marker) => marker.remove());
      vertexMarkersRef.current = [];
      vertexMarkerElementsRef.current = [];
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('mouseleave', clearHoveredInsertHit);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      if (clearIgnoreNextMapClickTimeoutRef.current !== null) {
        window.clearTimeout(clearIgnoreNextMapClickTimeoutRef.current);
        clearIgnoreNextMapClickTimeoutRef.current = null;
      }
      map.off('zoom', syncVertexMarkerSizes);
      map.off('mousemove', handleMapMouseMove);
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
      syncCanvasCursorRef.current = () => {};
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.flyTo({
      center,
      zoom: 18,
      speed: 1,
      essential: true
    });
    centerMarkerRef.current?.setLngLat(center);
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
            const feature = buildPolygonFeature(polygonState.ringPoints);
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
      pathSource.setData(activePathFeatureCollection(activePolygon, strokePointsRef.current, isStrokeDrawingRef.current ? drawMode : null));
    }
  }, [polygons, selectedPolygonId, activePolygonId, drawMode]);

  useEffect(() => {
    hoveredInsertHitRef.current = null;
    syncCanvasCursorRef.current();
  }, [drawMode, polygons, selection]);

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
    if (!selectedPolygon || selectedPolygon.ringPoints.length === 0) {
      return;
    }

    const markers = selectedPolygon.ringPoints.map((point, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.style.borderRadius = '999px';
      element.style.borderWidth = '2px';
      element.style.borderStyle = 'solid';
      element.style.padding = '0';

      const isSelectedVertex =
        selection.kind === 'vertex' &&
        selection.polygonId === selectedPolygonId &&
        selection.index === index;

      applyMarkerStyle(element, selectedPolygon.kind, isSelectedVertex, map.getZoom());
      element.style.cursor = 'grab';

      element.setAttribute('aria-label', `Vertex ${index + 1}`);

      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectionChangeRef.current({ kind: 'vertex', polygonId: selectedPolygonId, index });
      });

      const marker = new mapboxgl.Marker({ element, draggable: true }).setLngLat(point).addTo(map);

      marker.on('dragstart', () => {
        isMarkerDraggingRef.current = true;
        element.style.cursor = 'grabbing';
        hoveredInsertHitRef.current = null;
        syncCanvasCursorRef.current();
      });

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const nextPoints = selectedPolygon.ringPoints.map((existingPoint) => [...existingPoint] as LngLat);
        nextPoints[index] = [lngLat.lng, lngLat.lat];
        onPolygonRingPointsChangeRef.current(selectedPolygonId, nextPoints);

        ignoreNextMapClickRef.current = true;
        if (clearIgnoreNextMapClickTimeoutRef.current !== null) {
          window.clearTimeout(clearIgnoreNextMapClickTimeoutRef.current);
        }
        clearIgnoreNextMapClickTimeoutRef.current = window.setTimeout(() => {
          ignoreNextMapClickRef.current = false;
          clearIgnoreNextMapClickTimeoutRef.current = null;
        }, 0);
        isMarkerDraggingRef.current = false;
        element.style.cursor = 'grab';
        syncCanvasCursorRef.current();
      });

      return marker;
    });

    vertexMarkersRef.current = markers;
    vertexMarkerElementsRef.current = markers.map((marker, index) => ({
      element: marker.getElement() as HTMLButtonElement,
      kind: selectedPolygon.kind,
      selected:
        selection.kind === 'vertex' &&
        selection.polygonId === selectedPolygonId &&
        selection.index === index
    }));

    return () => {
      markers.forEach((marker) => marker.remove());
      vertexMarkerElementsRef.current = [];
    };
  }, [polygons, selection, selectedPolygonId]);

  return (
    <div className={['quote-editor-map-shell', className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className="quote-editor-map-canvas" />
    </div>
  );
};
