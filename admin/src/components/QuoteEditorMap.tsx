import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { EditablePolygon, LngLat, PolygonKind, SelectionTarget } from '../lib/quoteEditorTypes';
import { buildPolygonFeature } from '../lib/quoteEditorGeometry';
import 'maplibre-gl/dist/maplibre-gl.css';

const styleSpec: StyleSpecification = {
  version: 8,
  sources: {
    satellite_tiles: {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'satellite_tiles',
      type: 'raster',
      source: 'satellite_tiles',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-saturation': -0.18,
        'raster-contrast': 0.14,
        'raster-brightness-max': 0.92,
        'raster-fade-duration': 0
      }
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

interface ProjectedOverlayPolygon {
  id: string;
  kind: PolygonKind;
  selected: boolean;
  active: boolean;
  points: Array<{ x: number; y: number }>;
}

const POLYGON_SOURCE_ID = 'quote-polygons-source';
const POLYGON_OUTLINE_SOURCE_ID = 'quote-polygons-outline-source';
const PATH_SOURCE_ID = 'quote-active-path-source';
const CENTER_SOURCE_ID = 'quote-center-source';
const POLYGON_FILL_LAYER_ID = 'quote-polygons-fill';
const POLYGON_SHEEN_LAYER_ID = 'quote-polygons-sheen';
const POLYGON_EDGE_FALLBACK_LAYER_ID = 'quote-polygons-edge-fallback';
const POLYGON_GLOW_LAYER_ID = 'quote-polygons-glow';
const POLYGON_CASING_LAYER_ID = 'quote-polygons-casing';
const POLYGON_OUTLINE_LAYER_ID = 'quote-polygons-outline';
const PATH_GLOW_LAYER_ID = 'quote-active-path-glow';
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

const closeLineRing = (points: LngLat[]) => {
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

const polygonFeatureCollection = (
  polygons: EditablePolygon[],
  selectedPolygonId: string | null
): FeatureCollection<Polygon> => ({
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

const polygonOutlineFeatureCollection = (
  polygons: EditablePolygon[],
  selectedPolygonId: string | null,
  activePolygonId: string | null
): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: polygons
    .map((polygonState) => {
      if (polygonState.points.length < 2) {
        return null;
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: closeLineRing(polygonState.points)
        },
        properties: {
          polygonId: polygonState.id,
          polygonKind: polygonState.kind,
          selected: polygonState.id === selectedPolygonId,
          active: polygonState.id === activePolygonId
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null)
});

const syncPolygonSources = (
  map: maplibregl.Map,
  polygons: EditablePolygon[],
  selectedPolygonId: string | null,
  activePolygonId: string | null
) => {
  const polygonSource = map.getSource(POLYGON_SOURCE_ID) as GeoJSONSource | undefined;
  if (polygonSource) {
    polygonSource.setData(polygonFeatureCollection(polygons, selectedPolygonId));
  }

  const outlineSource = map.getSource(POLYGON_OUTLINE_SOURCE_ID) as GeoJSONSource | undefined;
  if (outlineSource) {
    outlineSource.setData(polygonOutlineFeatureCollection(polygons, selectedPolygonId, activePolygonId));
  }

  const pathSource = map.getSource(PATH_SOURCE_ID) as GeoJSONSource | undefined;
  if (pathSource) {
    const activePolygon = polygons.find((polygonState) => polygonState.id === activePolygonId);
    pathSource.setData(activePathFeatureCollection(activePolygon));
  }
};

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

const projectOverlayPolygons = (
  map: maplibregl.Map,
  polygons: EditablePolygon[],
  selectedPolygonId: string | null,
  activePolygonId: string | null
): ProjectedOverlayPolygon[] =>
  polygons
    .map((polygonState) => {
      const points = polygonState.points
        .map(([lng, lat]) => map.project([lng, lat]))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({ x: point.x, y: point.y }));

      return {
        id: polygonState.id,
        kind: polygonState.kind,
        selected: polygonState.id === selectedPolygonId,
        active: polygonState.id === activePolygonId,
        points
      };
    })
    .filter((polygonState) => polygonState.points.length >= 3);

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
  const polygonsRef = useRef(polygons);
  const selectedPolygonIdRef = useRef<string | null>(selectedPolygonId);
  const ignoreNextMapClickRef = useRef(false);
  const isMarkerDraggingRef = useRef(false);
  const [overlayPolygons, setOverlayPolygons] = useState<ProjectedOverlayPolygon[]>([]);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const syncProjectedOverlayRef = useRef<() => void>(() => {});

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
    polygonsRef.current = polygons;
  }, [polygons]);

  useEffect(() => {
    selectedPolygonIdRef.current = selectedPolygonId;
  }, [selectedPolygonId]);

  useEffect(() => {
    syncProjectedOverlayRef.current = () => {
      const map = mapRef.current;
      if (!map) {
        return;
      }

      const container = map.getContainer();
      const width = container.clientWidth;
      const height = container.clientHeight;

      setOverlaySize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
      setOverlayPolygons(
        projectOverlayPolygons(
          map,
          polygonsRef.current,
          selectedPolygonIdRef.current,
          activePolygonIdRef.current
        )
      );
    };
  });

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
      maxPitch: 0,
      maxZoom: 19
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

    const ensureSourcesAndLayers = () => {
      if (!map.isStyleLoaded()) {
        return;
      }

      if (!map.getSource(POLYGON_SOURCE_ID)) {
        map.addSource(POLYGON_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          } as FeatureCollection<Polygon>
        });
      }

      if (!map.getSource(PATH_SOURCE_ID)) {
        map.addSource(PATH_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          } as FeatureCollection<LineString>
        });
      }

      if (!map.getSource(POLYGON_OUTLINE_SOURCE_ID)) {
        map.addSource(POLYGON_OUTLINE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          } as FeatureCollection<LineString>
        });
      }

      if (!map.getSource(CENTER_SOURCE_ID)) {
        map.addSource(CENTER_SOURCE_ID, {
          type: 'geojson',
          data: {
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
          } as FeatureCollection<Point>
        });
      }

      if (!map.getLayer(POLYGON_FILL_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_FILL_LAYER_ID,
          source: POLYGON_SOURCE_ID,
          type: 'fill',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#B91C1C',
              '#059669'
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              ['case', ['==', ['get', 'selected'], true], 0.38, 0.22],
              ['case', ['==', ['get', 'selected'], true], 0.42, 0.26]
            ]
          }
        });
      }

      if (!map.getLayer(POLYGON_SHEEN_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_SHEEN_LAYER_ID,
          source: POLYGON_SOURCE_ID,
          type: 'fill',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#FFE4E6',
              '#F3FFF7'
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'selected'], true],
              0.08,
              0.035
            ]
          }
        });
      }

      if (!map.getLayer(POLYGON_EDGE_FALLBACK_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_EDGE_FALLBACK_LAYER_ID,
          source: POLYGON_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              ['case', ['==', ['get', 'selected'], true], '#FFF3F5', '#FF7A90'],
              ['case', ['==', ['get', 'selected'], true], '#F8FFFC', '#4EF0A5']
            ],
            'line-width': [
              'case',
              ['==', ['get', 'selected'], true],
              6.2,
              4.4
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'selected'], true],
              0.98,
              0.9
            ]
          }
        });
      }

      if (!map.getLayer(POLYGON_GLOW_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_GLOW_LAYER_ID,
          source: POLYGON_OUTLINE_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#FF6B7A',
              '#33D17A'
            ],
            'line-width': [
              'case',
              ['==', ['get', 'selected'], true],
              14,
              ['==', ['get', 'active'], true],
              10.5,
              7.4
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'selected'], true],
              0.5,
              ['==', ['get', 'active'], true],
              0.34,
              0.2
            ],
            'line-blur': [
              'case',
              ['==', ['get', 'selected'], true],
              4.2,
              ['==', ['get', 'active'], true],
              3,
              2.1
            ]
          }
        });
      }

      if (!map.getLayer(POLYGON_CASING_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_CASING_LAYER_ID,
          source: POLYGON_OUTLINE_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#23070A',
              '#031A0B'
            ],
            'line-width': [
              'case',
              ['==', ['get', 'selected'], true],
              7.4,
              ['==', ['get', 'active'], true],
              6.1,
              4.9
            ],
            'line-opacity': 0.82
          }
        });
      }

      if (!map.getLayer(POLYGON_OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: POLYGON_OUTLINE_LAYER_ID,
          source: POLYGON_OUTLINE_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              ['case', ['==', ['get', 'selected'], true], '#FFF1F3', '#FFB4BE'],
              ['case', ['==', ['get', 'selected'], true], '#FFFFFF', '#C6F7D8']
            ],
            'line-width': [
              'case',
              ['==', ['get', 'selected'], true],
              3.9,
              ['==', ['get', 'active'], true],
              3.3,
              2.7
            ]
          }
        });
      }

      if (!map.getLayer(PATH_GLOW_LAYER_ID)) {
        map.addLayer({
          id: PATH_GLOW_LAYER_ID,
          source: PATH_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#FF6B7A',
              '#33D17A'
            ],
            'line-width': 8,
            'line-opacity': 0.42,
            'line-blur': 2.6
          }
        });
      }

      if (!map.getLayer(PATH_LAYER_ID)) {
        map.addLayer({
          id: PATH_LAYER_ID,
          source: PATH_SOURCE_ID,
          type: 'line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'polygonKind'], 'obstacle'],
              '#FFF8F9',
              '#F5FFFA'
            ],
            'line-width': 3.6,
            'line-dasharray': [1.4, 1.1]
          }
        });
      }

      if (!map.getLayer(CENTER_LAYER_ID)) {
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
      }

      syncPolygonSources(
        map,
        polygonsRef.current,
        selectedPolygonIdRef.current,
        activePolygonIdRef.current
      );
    };

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
      }
    };

    map.on('click', handleMapClick);

    map.on('load', ensureSourcesAndLayers);
    map.on('styledata', ensureSourcesAndLayers);
    map.on('move', () => syncProjectedOverlayRef.current());
    map.on('zoom', () => syncProjectedOverlayRef.current());
    map.on('resize', () => syncProjectedOverlayRef.current());

    mapRef.current = map;
    syncProjectedOverlayRef.current();

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
    syncProjectedOverlayRef.current();
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || polygons.length === 0) {
      return;
    }

    const points = polygons.flatMap((polygonState) => polygonState.points);
    if (points.length === 0) {
      return;
    }

    const bounds = points.slice(1).reduce(
      (currentBounds, point) => currentBounds.extend(point),
      new maplibregl.LngLatBounds(points[0], points[0])
    );

    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: 18.5,
      duration: 0,
      essential: true
    });
  }, [polygons]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    syncPolygonSources(map, polygons, selectedPolygonId, activePolygonId);
    syncProjectedOverlayRef.current();
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
      element.style.borderRadius = '999px';
      element.style.borderWidth = '2px';
      element.style.borderStyle = 'solid';
      element.style.padding = '0';
      element.style.outline = 'none';

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
        border: '1px solid rgba(255,255,255,0.14)',
        background:
          'radial-gradient(circle at top left, rgba(50,159,91,0.14), transparent 34%), radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent 28%), rgba(4,6,5,0.92)',
        boxShadow: '0 28px 60px rgba(0,0,0,0.34)'
      }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {overlaySize.width > 0 && overlaySize.height > 0 ? (
        <svg
          width={overlaySize.width}
          height={overlaySize.height}
          viewBox={`0 0 ${overlaySize.width} ${overlaySize.height}`}
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            zIndex: 1
          }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="overlay-service-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5CF0B6" />
              <stop offset="100%" stopColor="#14B87A" />
            </linearGradient>
            <linearGradient id="overlay-service-fill-selected" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A8FFD9" />
              <stop offset="100%" stopColor="#2ED08E" />
            </linearGradient>
            <linearGradient id="overlay-obstacle-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9FB0" />
              <stop offset="100%" stopColor="#E34863" />
            </linearGradient>
            <linearGradient id="overlay-obstacle-fill-selected" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD2DB" />
              <stop offset="100%" stopColor="#F06179" />
            </linearGradient>
            <pattern
              id="overlay-obstacle-hatch"
              patternUnits="userSpaceOnUse"
              width="12"
              height="12"
              patternTransform="rotate(38)"
            >
              <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(255,255,255,0.65)" strokeWidth="2.4" />
            </pattern>
            <filter id="overlay-edge-glow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.7" result="blurred" />
              <feMerge>
                <feMergeNode in="blurred" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {overlayPolygons.map((polygonState) => {
            const points = polygonState.points.map((point) => `${point.x},${point.y}`).join(' ');
            const fillColor =
              polygonState.kind === 'obstacle'
                ? polygonState.selected
                  ? 'url(#overlay-obstacle-fill-selected)'
                  : 'url(#overlay-obstacle-fill)'
                : polygonState.selected
                  ? 'url(#overlay-service-fill-selected)'
                  : 'url(#overlay-service-fill)';
            const fillOpacity = polygonState.selected ? 0.48 : polygonState.active ? 0.35 : 0.28;
            const casingColor = polygonState.kind === 'obstacle' ? '#2F090E' : '#032417';
            const lineColor = polygonState.kind === 'obstacle' ? '#FFEAF0' : '#E9FFF4';
            const glowColor = polygonState.kind === 'obstacle' ? '#FF6E89' : '#49E6A6';
            const glowWidth = polygonState.selected ? 12.5 : polygonState.active ? 10 : 7.5;
            const glowOpacity = polygonState.selected ? 0.74 : polygonState.active ? 0.6 : 0.42;

            return (
              <g key={polygonState.id}>
                <polygon points={points} fill={fillColor} fillOpacity={fillOpacity} />
                {polygonState.kind === 'obstacle' ? (
                  <polygon
                    points={points}
                    fill="url(#overlay-obstacle-hatch)"
                    fillOpacity={polygonState.selected ? 0.26 : 0.16}
                  />
                ) : null}
                <polygon
                  points={points}
                  fill="none"
                  stroke={glowColor}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth={glowWidth}
                  strokeOpacity={glowOpacity}
                  filter="url(#overlay-edge-glow)"
                />
                <polygon
                  points={points}
                  fill="none"
                  stroke={casingColor}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth={polygonState.selected ? 7.2 : polygonState.active ? 6.2 : 5.2}
                />
                <polygon
                  points={points}
                  fill="none"
                  stroke={lineColor}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth={polygonState.selected ? 4.3 : polygonState.active ? 3.7 : 3.1}
                />
                {polygonState.selected ? (
                  <polygon
                    points={points}
                    fill="none"
                    stroke="rgba(255,255,255,0.78)"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeWidth={1.7}
                    strokeDasharray="10 8"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-36"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </polygon>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}

      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
        background:
          'linear-gradient(180deg, rgba(6,10,8,0.26) 0%, rgba(6,10,8,0) 20%, rgba(6,10,8,0) 78%, rgba(6,10,8,0.22) 100%)'
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          display: 'flex',
          gap: '0.55rem',
          flexWrap: 'wrap',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(174,255,220,0.42)',
            background: 'rgba(7,22,15,0.7)',
            padding: '0.42rem 0.74rem',
            fontSize: '0.72rem',
            color: 'rgba(244,255,248,0.95)',
            backdropFilter: 'blur(9px)',
            boxShadow: '0 14px 26px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.06)'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '0.55rem',
              height: '0.55rem',
              marginRight: '0.45rem',
              borderRadius: '999px',
              background: '#33D17A',
              boxShadow: '0 0 16px rgba(51,209,122,0.78)'
            }}
          />
          Service area
        </div>
        <div
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255,176,191,0.48)',
            background: 'rgba(28,9,13,0.72)',
            padding: '0.42rem 0.74rem',
            fontSize: '0.72rem',
            color: 'rgba(255,246,248,0.95)',
            backdropFilter: 'blur(9px)',
            boxShadow: '0 14px 26px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.06)'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '0.55rem',
              height: '0.55rem',
              marginRight: '0.45rem',
              borderRadius: '999px',
              background: '#FF6B7A',
              boxShadow: '0 0 16px rgba(255,107,122,0.82)'
            }}
          />
          Obstacle
        </div>
      </div>

      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          borderRadius: '999px',
          border: '1px solid rgba(169,255,216,0.36)',
          background: 'rgba(4,15,10,0.78)',
          padding: '0.4rem 0.78rem',
          fontSize: '0.69rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#E9FFF4',
          backdropFilter: 'blur(9px)',
          boxShadow: '0 14px 30px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.05)'
        }}
      >
        Editor Visuals V4
      </div>

      {selectedPolygonPointCount > 2 ? (
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: '1rem',
            bottom: '1rem',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.26)',
            background: 'rgba(6,12,9,0.78)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: 'rgba(242,255,247,0.86)',
            backdropFilter: 'blur(8px)'
          }}
        >
          Polygon closes automatically for geodesic calculations.
        </div>
      ) : null}
    </div>
  );
};
