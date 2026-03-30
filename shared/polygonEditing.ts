export interface PolygonLike<TPoint = [number, number]> {
  id: string;
  ringPoints: TPoint[];
}

export interface PolygonEditorStateLike<TPolygon extends { id: string }> {
  polygons: TPolygon[];
  activePolygonId: string | null;
}

export const removePolygonFromEditorState = <
  TPolygon extends { id: string },
  TState extends PolygonEditorStateLike<TPolygon>
>(
  state: TState,
  polygonId: string
): TState => {
  const nextPolygons = state.polygons.filter((polygon) => polygon.id !== polygonId);
  const nextActivePolygonId = nextPolygons.some((polygon) => polygon.id === state.activePolygonId)
    ? state.activePolygonId
    : (nextPolygons[0]?.id ?? null);

  return {
    ...state,
    polygons: nextPolygons,
    activePolygonId: nextActivePolygonId
  };
};

export const deleteVertexOrPolygonFromEditorState = <
  TPolygon extends PolygonLike,
  TState extends PolygonEditorStateLike<TPolygon>
>(
  state: TState,
  polygonId: string,
  vertexIndex: number
): TState => {
  const targetPolygon = state.polygons.find((polygon) => polygon.id === polygonId);
  if (!targetPolygon) {
    return state;
  }

  if (targetPolygon.ringPoints.length <= 3) {
    return removePolygonFromEditorState(state, polygonId);
  }

  return {
    ...state,
    polygons: state.polygons.map((polygon) =>
      polygon.id === polygonId
        ? {
            ...polygon,
            ringPoints: polygon.ringPoints.filter((_, index) => index !== vertexIndex)
          }
        : polygon
    )
  };
};
