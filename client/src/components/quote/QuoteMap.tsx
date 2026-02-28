import { useEffect, useMemo, useRef } from 'react';
import mapboxgl, { type GeoJSONSource } from 'mapbox-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { LngLat } from '../../types';
import { buildPolygonFeature } from '../../lib/geometry';

interface QuoteMapProps {
  token: string;
  center: LngLat;
  drawing: boolean;
  editMode: boolean;
  points: LngLat[];
  onPointAdd: (point: LngLat) => void;
  onPointsChange: (points: LngLat[]) => void;
}

const POLYGON_SOURCE_ID = 'quote-polygon-source';
const PATH_SOURCE_ID = 'quote-path-source';
const POINT_SOURCE_ID = 'quote-points-source';
const CENTER_SOURCE_ID = 'quote-center-source';
const MAP_STYLE = 'mapbox://styles/mapbox/satellite-v9';

export const QuoteMap = ({
  token,
  center,
  drawing,
  editMode,
  points,
  onPointAdd,
  onPointsChange
}: QuoteMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const vertexMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const drawingRef = useRef(drawing);
  const onPointAddRef = useRef(onPointAdd);
  const onPointsChangeRef = useRef(onPointsChange);
  const pointsRef = useRef(points);
  const centerRef = useRef(center);

  const polygonFeature = useMemo(() => buildPolygonFeature(points), [points]);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    onPointAddRef.current = onPointAdd;
  }, [onPointAdd]);

  useEffect(() => {
    onPointsChangeRef.current = onPointsChange;
  }, [onPointsChange]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
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
      'top-right'
    );

    map.on('load', () => {
      const polygonFeatureCollection: FeatureCollection<Polygon> = {
        type: 'FeatureCollection',
        features: []
      };

      const pathFeatureCollection: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: []
      };

      const pointFeatureCollection: FeatureCollection<Point> = {
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

      map.addSource(POINT_SOURCE_ID, {
        type: 'geojson',
        data: pointFeatureCollection
      });

      map.addSource(CENTER_SOURCE_ID, {
        type: 'geojson',
        data: centerFeature
      });

      map.addLayer({
        id: 'quote-polygon-fill',
        source: POLYGON_SOURCE_ID,
        type: 'fill',
        paint: {
          'fill-color': '#329F5B',
          'fill-opacity': 0.32
        }
      });

      map.addLayer({
        id: 'quote-polygon-outline',
        source: POLYGON_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': '#E6F4EC',
          'line-width': 2.2
        }
      });

      map.addLayer({
        id: 'quote-path-line',
        source: PATH_SOURCE_ID,
        type: 'line',
        paint: {
          'line-color': '#329F5B',
          'line-width': 2,
          'line-dasharray': [2, 1]
        }
      });

      map.addLayer({
        id: 'quote-points',
        source: POINT_SOURCE_ID,
        type: 'circle',
        paint: {
          'circle-radius': 4,
          'circle-color': '#329F5B',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2
        }
      });

      map.addLayer({
        id: 'quote-center-point',
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

    map.on('click', (event) => {
      if (!drawingRef.current) {
        return;
      }
      onPointAddRef.current([event.lngLat.lng, event.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      vertexMarkersRef.current.forEach((marker) => marker.remove());
      vertexMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
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
        features: polygonFeature ? [polygonFeature] : []
      });
    }

    const pathSource = map.getSource(PATH_SOURCE_ID) as GeoJSONSource | undefined;
    if (pathSource) {
      pathSource.setData({
        type: 'FeatureCollection',
        features:
          points.length >= 2
            ? [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: points
                  },
                  properties: {}
                }
              ]
            : []
      });
    }

    const pointSource = map.getSource(POINT_SOURCE_ID) as GeoJSONSource | undefined;
    if (pointSource) {
      pointSource.setData({
        type: 'FeatureCollection',
        features: points.map((point, index) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: point
          },
          properties: {
            index
          }
        }))
      });
    }
  }, [points, polygonFeature]);

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

    if (!editMode || points.length === 0) {
      return;
    }

    const markers = points.map((point, index) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className =
        'h-4 w-4 rounded-full border-2 border-white bg-[#329F5B] shadow-[0_0_20px_rgba(50,159,91,0.5)]';
      element.ariaLabel = `Vertex ${index + 1}`;

      const marker = new mapboxgl.Marker({ element, draggable: true })
        .setLngLat(point)
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const nextPoints = [...pointsRef.current];
        nextPoints[index] = [lngLat.lng, lngLat.lat];
        onPointsChangeRef.current(nextPoints);
      });

      return marker;
    });

    vertexMarkersRef.current = markers;

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [editMode, points]);

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-2xl border border-white/15 shadow-soft md:h-[580px]">
      <div ref={containerRef} className="h-full w-full" />

      {points.length > 2 ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs text-white/75">
          Polygon closes automatically for geodesic calculations.
        </div>
      ) : null}
    </div>
  );
};
