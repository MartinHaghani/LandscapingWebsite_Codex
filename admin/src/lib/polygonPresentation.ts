import type { ExpressionSpecification } from 'mapbox-gl';
import type { PolygonKind } from './quoteEditorTypes';

export interface QuotePolygonStyleToken {
  fillColor: string;
  fillOpacity: number;
  outlineColor: string;
  outlineWidth: number;
}

const SERVICE_SELECTED_STYLE: QuotePolygonStyleToken = {
  fillColor: '#329F5B',
  fillOpacity: 0.54,
  outlineColor: '#FFFFFF',
  outlineWidth: 3.2
};

const SERVICE_UNSELECTED_STYLE: QuotePolygonStyleToken = {
  fillColor: '#329F5B',
  fillOpacity: 0.24,
  outlineColor: '#BFEBCF',
  outlineWidth: 2.1
};

const OBSTACLE_SELECTED_STYLE: QuotePolygonStyleToken = {
  fillColor: '#DC2626',
  fillOpacity: 0.42,
  outlineColor: '#FFE4E6',
  outlineWidth: 3.2
};

const OBSTACLE_UNSELECTED_STYLE: QuotePolygonStyleToken = {
  fillColor: '#DC2626',
  fillOpacity: 0.2,
  outlineColor: '#FDA4AF',
  outlineWidth: 2.1
};

export const getQuotePolygonStyleToken = (
  kind: PolygonKind,
  selected: boolean
): QuotePolygonStyleToken => {
  if (kind === 'obstacle') {
    return selected ? OBSTACLE_SELECTED_STYLE : OBSTACLE_UNSELECTED_STYLE;
  }

  return selected ? SERVICE_SELECTED_STYLE : SERVICE_UNSELECTED_STYLE;
};

export const quotePolygonFillColorExpression: ExpressionSpecification = [
  'case',
  ['==', ['get', 'polygonKind'], 'obstacle'],
  OBSTACLE_SELECTED_STYLE.fillColor,
  SERVICE_SELECTED_STYLE.fillColor
];

export const quotePolygonFillOpacityExpression: ExpressionSpecification = [
  'case',
  ['==', ['get', 'polygonKind'], 'obstacle'],
  [
    'case',
    ['==', ['get', 'selected'], true],
    OBSTACLE_SELECTED_STYLE.fillOpacity,
    OBSTACLE_UNSELECTED_STYLE.fillOpacity
  ],
  [
    'case',
    ['==', ['get', 'selected'], true],
    SERVICE_SELECTED_STYLE.fillOpacity,
    SERVICE_UNSELECTED_STYLE.fillOpacity
  ]
];

export const quotePolygonOutlineColorExpression: ExpressionSpecification = [
  'case',
  ['==', ['get', 'polygonKind'], 'obstacle'],
  [
    'case',
    ['==', ['get', 'selected'], true],
    OBSTACLE_SELECTED_STYLE.outlineColor,
    OBSTACLE_UNSELECTED_STYLE.outlineColor
  ],
  [
    'case',
    ['==', ['get', 'selected'], true],
    SERVICE_SELECTED_STYLE.outlineColor,
    SERVICE_UNSELECTED_STYLE.outlineColor
  ]
];

export const quotePolygonOutlineWidthExpression: ExpressionSpecification = [
  'case',
  ['==', ['get', 'selected'], true],
  SERVICE_SELECTED_STYLE.outlineWidth,
  SERVICE_UNSELECTED_STYLE.outlineWidth
];
