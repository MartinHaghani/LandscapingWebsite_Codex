export type LngLat = [number, number];

export type PolygonKind = 'service' | 'obstacle';

export interface EditablePolygon {
  id: string;
  kind: PolygonKind;
  points: LngLat[];
}

export interface PolygonEditorState {
  polygons: EditablePolygon[];
  activePolygonId: string | null;
}

export type SelectionTarget =
  | { kind: 'none' }
  | { kind: 'polygon'; polygonId: string }
  | { kind: 'vertex'; polygonId: string; index: number };
