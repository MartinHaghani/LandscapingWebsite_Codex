import type { PolygonEditorState } from './quoteEditorTypes';

export interface PolygonHistoryState {
  past: PolygonEditorState[];
  present: PolygonEditorState;
  future: PolygonEditorState[];
}

const cloneState = (state: PolygonEditorState): PolygonEditorState => ({
  activePolygonId: state.activePolygonId,
  polygons: state.polygons.map((polygon) => ({
    id: polygon.id,
    kind: polygon.kind,
    points: polygon.points.map(([lng, lat]) => [lng, lat] as [number, number])
  }))
});

const pointsEqual = (left: [number, number][], right: [number, number][]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((point, index) => point[0] === right[index][0] && point[1] === right[index][1]);
};

const statesEqual = (left: PolygonEditorState, right: PolygonEditorState) => {
  if (left.activePolygonId !== right.activePolygonId || left.polygons.length !== right.polygons.length) {
    return false;
  }

  return left.polygons.every((polygon, index) => {
    const rightPolygon = right.polygons[index];
    return (
      polygon.id === rightPolygon.id &&
      polygon.kind === rightPolygon.kind &&
      pointsEqual(polygon.points, rightPolygon.points)
    );
  });
};

const cloneStack = (stack: PolygonEditorState[]) => stack.map(cloneState);

export const createPolygonHistory = (initial: PolygonEditorState): PolygonHistoryState => ({
  past: [],
  present: cloneState(initial),
  future: []
});

export const applyPolygonEdit = (
  history: PolygonHistoryState,
  nextState: PolygonEditorState
): PolygonHistoryState => {
  const nextPresent = cloneState(nextState);
  if (statesEqual(history.present, nextPresent)) {
    return history;
  }

  return {
    past: [...cloneStack(history.past), cloneState(history.present)],
    present: nextPresent,
    future: []
  };
};

export const undoPolygonEdit = (history: PolygonHistoryState): PolygonHistoryState => {
  if (history.past.length === 0) {
    return history;
  }

  const previous = history.past[history.past.length - 1];

  return {
    past: cloneStack(history.past.slice(0, -1)),
    present: cloneState(previous),
    future: [cloneState(history.present), ...cloneStack(history.future)]
  };
};

export const redoPolygonEdit = (history: PolygonHistoryState): PolygonHistoryState => {
  if (history.future.length === 0) {
    return history;
  }

  const next = history.future[0];

  return {
    past: [...cloneStack(history.past), cloneState(history.present)],
    present: cloneState(next),
    future: cloneStack(history.future.slice(1))
  };
};
