import type { AnyLayer, Map } from 'mapbox-gl';

const CONTEXT_SOURCE_ID = 'autoscape-streets-context';
const BUILDING_OUTLINE_LAYER_ID = 'autoscape-building-outlines';

export const ADMIN_MAP_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

export const addAdminMapContextLayers = (map: Map) => {
  if (!map.getSource(CONTEXT_SOURCE_ID)) {
    map.addSource(CONTEXT_SOURCE_ID, {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    });
  }

  if (!map.getLayer(BUILDING_OUTLINE_LAYER_ID)) {
    map.addLayer({
      id: BUILDING_OUTLINE_LAYER_ID,
      type: 'line',
      source: CONTEXT_SOURCE_ID,
      'source-layer': 'building',
      minzoom: 15,
      paint: {
        'line-color': 'rgba(255,255,255,0.88)',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.2, 17, 0.62, 19, 0.82],
        'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.55, 18, 1.25, 20, 1.8]
      }
    } as AnyLayer);
  }
};
