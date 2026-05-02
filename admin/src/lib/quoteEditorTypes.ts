export type LngLat = [number, number];

export type PolygonKind = 'service' | 'obstacle';

export interface EditablePolygon {
  id: string;
  kind: PolygonKind;
  ringPoints: LngLat[];
  rawStrokePoints: LngLat[] | null;
}

export interface PolygonEditorState {
  polygons: EditablePolygon[];
  activePolygonId: string | null;
}

export type QuoteGeometry =
  | {
      type: 'Polygon';
      coordinates: LngLat[][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: LngLat[][][];
    };

export type SelectionTarget =
  | { kind: 'none' }
  | { kind: 'polygon'; polygonId: string }
  | { kind: 'vertex'; polygonId: string; index: number };
