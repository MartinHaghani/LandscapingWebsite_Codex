import type { AnyLayer, Map } from 'mapbox-gl';

const CONTEXT_SOURCE_ID = 'autoscape-streets-context';
const BUILDING_OUTLINE_LAYER_ID = 'autoscape-building-outlines';
const HOUSE_NUMBER_LAYER_ID = 'autoscape-house-number-labels';

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

  if (!map.getLayer(HOUSE_NUMBER_LAYER_ID)) {
    map.addLayer({
      id: HOUSE_NUMBER_LAYER_ID,
      type: 'symbol',
      source: CONTEXT_SOURCE_ID,
      'source-layer': 'housenum_label',
      minzoom: 16,
      layout: {
        'text-field': ['get', 'house_num'],
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 19, 14],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 1.5
      },
      paint: {
        'text-color': '#101713',
        'text-halo-color': 'rgba(255,255,255,0.94)',
        'text-halo-width': 1.4,
        'text-halo-blur': 0.25
      }
    } as AnyLayer);
  }
};
