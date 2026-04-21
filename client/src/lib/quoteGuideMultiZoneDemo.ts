import {
  buildQuoteGuideSmoothSvgPath,
  buildQuoteGuideSvgPath,
  localPointToSyntheticLngLat,
  QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT,
  QUOTE_GUIDE_DEMO_BACKGROUND_TOP,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA,
  QUOTE_GUIDE_DEMO_MAP_HEIGHT,
  QUOTE_GUIDE_DEMO_MAP_WIDTH,
  type QuoteGuideDemoCameraState,
  type QuoteGuideDemoPoint
} from './quoteGuideDemo';

export interface QuoteGuideMultiZonePolygonState {
  id: string;
  ringLocalPoints: QuoteGuideDemoPoint[];
  selected: boolean;
  showVertices: boolean;
  selectedVertexIndex: number | null;
}

export type QuoteGuideMultiZoneDemoPhase =
  | 'idle'
  | 'cursor-to-button-right'
  | 'activate-right-draw'
  | 'cursor-to-right-zone'
  | 'drawing-right-zone'
  | 'right-zone-finalized'
  | 'cursor-to-edge'
  | 'insert-vertex'
  | 'drag-inserted-vertex'
  | 'vertex-added'
  | 'cursor-to-extra-vertex'
  | 'select-extra-vertex'
  | 'cursor-to-delete'
  | 'click-delete-button'
  | 'deleting-vertex'
  | 'finalized';

export type QuoteGuideMultiZoneInstructionState = 'draw' | 'add' | 'remove';

export interface QuoteGuideMultiZoneDemoAnimationState {
  phase: QuoteGuideMultiZoneDemoPhase;
  drawButtonLabel: 'Draw lawn' | 'Stop drawing';
  drawButtonActive: boolean;
  obstacleButtonActive: boolean;
  doneEnabled: boolean;
  deleteEnabled: boolean;
  clearAllEnabled: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  showCursor: boolean;
  cursorPoint: QuoteGuideDemoPoint;
  cursorVariant: 'default' | 'add-vertex';
  camera: QuoteGuideDemoCameraState;
  polygons: QuoteGuideMultiZonePolygonState[];
  rawStrokePath: string | null;
  rawStrokeProgress: number;
  deletedVertexPoint: QuoteGuideDemoPoint | null;
  deletedVertexProgress: number;
}

const BACKGROUND_VIEWBOX_WIDTH = 220;
const BACKGROUND_SCALE = QUOTE_GUIDE_DEMO_MAP_WIDTH / BACKGROUND_VIEWBOX_WIDTH;

const INITIAL_IDLE_DURATION_MS = 560;
const CURSOR_TO_BUTTON_DURATION_MS = 520;
const ACTIVATE_DRAW_DURATION_MS = 220;
const CURSOR_TO_ZONE_DURATION_MS = 560;
const DRAWING_DURATION_MS = 1_180;
const ZONE_FINALIZED_HOLD_DURATION_MS = 520;
const CURSOR_TO_EDGE_DURATION_MS = 720;
const INSERT_VERTEX_DURATION_MS = 420;
const DRAG_INSERTED_VERTEX_DURATION_MS = 900;
const ADDED_VERTEX_HOLD_DURATION_MS = 650;
const CURSOR_TO_VERTEX_DURATION_MS = 650;
const SELECT_VERTEX_DURATION_MS = 600;
const CURSOR_TO_DELETE_DURATION_MS = 850;
const CLICK_DELETE_BUTTON_DURATION_MS = 320;
const DELETE_VERTEX_DURATION_MS = 900;
const FINAL_HOLD_DURATION_MS = 1_600;

const CURSOR_REST_POINT: QuoteGuideDemoPoint = { x: 564, y: 316 };
const DRAW_BUTTON_POINT: QuoteGuideDemoPoint = { x: 235, y: 29 };
const DELETE_BUTTON_POINT: QuoteGuideDemoPoint = { x: 405, y: 29 };
const CURSOR_RELEASE_OFFSET: QuoteGuideDemoPoint = { x: 14, y: 10 };

const assetPointToLocalPoint = (point: QuoteGuideDemoPoint): QuoteGuideDemoPoint => ({
  x: point.x * BACKGROUND_SCALE,
  y: point.y * BACKGROUND_SCALE + QUOTE_GUIDE_DEMO_BACKGROUND_TOP
});

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

const interpolatePoint = (
  from: QuoteGuideDemoPoint,
  to: QuoteGuideDemoPoint,
  progress: number
): QuoteGuideDemoPoint => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress
});

const clonePoint = (point: QuoteGuideDemoPoint): QuoteGuideDemoPoint => ({
  x: point.x,
  y: point.y
});

const clonePoints = (points: QuoteGuideDemoPoint[]) => points.map(clonePoint);

const cloneCamera = (camera: QuoteGuideDemoCameraState): QuoteGuideDemoCameraState => ({
  scale: camera.scale,
  focusPoint: clonePoint(camera.focusPoint)
});

const clonePolygon = (
  polygon: QuoteGuideMultiZonePolygonState
): QuoteGuideMultiZonePolygonState => ({
  ...polygon,
  ringLocalPoints: clonePoints(polygon.ringLocalPoints)
});

const getLocalSegmentLength = (from: QuoteGuideDemoPoint, to: QuoteGuideDemoPoint) =>
  Math.hypot(to.x - from.x, to.y - from.y);

const getPolylineLength = (points: QuoteGuideDemoPoint[]) =>
  points
    .slice(1)
    .reduce((total, point, index) => total + getLocalSegmentLength(points[index], point), 0);

const getPointAlongPolyline = (points: QuoteGuideDemoPoint[], progress: number) => {
  if (points.length === 0) {
    return CURSOR_REST_POINT;
  }

  if (points.length === 1) {
    return points[0];
  }

  const clampedProgress = clamp01(progress);
  const totalLength = getPolylineLength(points);

  if (totalLength === 0) {
    return points[0];
  }

  let remainingLength = totalLength * clampedProgress;

  for (let index = 1; index < points.length; index += 1) {
    const segmentStart = points[index - 1];
    const segmentEnd = points[index];
    const segmentLength = getLocalSegmentLength(segmentStart, segmentEnd);

    if (remainingLength <= segmentLength) {
      return interpolatePoint(
        segmentStart,
        segmentEnd,
        segmentLength === 0 ? 0 : remainingLength / segmentLength
      );
    }

    remainingLength -= segmentLength;
  }

  return points[points.length - 1];
};

const interpolatePolylinePoint = (
  from: QuoteGuideDemoPoint,
  to: QuoteGuideDemoPoint,
  progress: number
) => interpolatePoint(from, to, easeInOutCubic(progress));

const createZoomCamera = (
  focusPoint: QuoteGuideDemoPoint,
  scale: number
): QuoteGuideDemoCameraState => ({
  scale,
  focusPoint: clonePoint(focusPoint)
});

const BACK_ZONE_TARGET_RING_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 6, y: 6 },
  { x: 114, y: 6 },
  { x: 114, y: 13 },
  { x: 60, y: 13 },
  { x: 52, y: 20 },
  { x: 6, y: 20 }
];

const BACK_ZONE_RAW_STROKE_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 10, y: 7 },
  { x: 34, y: 5 },
  { x: 66, y: 5 },
  { x: 97, y: 7 },
  { x: 112, y: 12 },
  { x: 78, y: 13 },
  { x: 54, y: 19 },
  { x: 17, y: 20 },
  { x: 8, y: 14 },
  { x: 10, y: 7 }
];

const RIGHT_ZONE_TARGET_RING_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 114, y: 6 },
  { x: 198, y: 6 },
  { x: 208, y: 18 },
  { x: 208, y: 92 },
  { x: 203, y: 92 },
  { x: 203, y: 114 },
  { x: 195, y: 114 },
  { x: 195, y: 103 },
  { x: 166, y: 103 },
  { x: 166, y: 114 },
  { x: 114, y: 114 },
  { x: 114, y: 103 },
  { x: 156, y: 103 },
  { x: 156, y: 92 },
  { x: 179, y: 92 },
  { x: 186, y: 83 },
  { x: 186, y: 31 },
  { x: 176, y: 21 },
  { x: 114, y: 21 }
];

const RIGHT_ZONE_INITIAL_RING_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 114, y: 6 },
  { x: 198, y: 6 },
  { x: 208, y: 18 },
  { x: 208, y: 92 },
  { x: 203, y: 92 },
  { x: 203, y: 114 },
  { x: 195, y: 114 },
  { x: 166, y: 103 },
  { x: 166, y: 114 },
  { x: 114, y: 114 },
  { x: 114, y: 103 },
  { x: 156, y: 103 },
  { x: 156, y: 92 },
  { x: 179, y: 92 },
  { x: 186, y: 83 },
  { x: 186, y: 31 },
  { x: 176, y: 21 },
  { x: 152, y: 21 },
  { x: 114, y: 21 }
];

const RIGHT_ZONE_RAW_STROKE_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 118, y: 9 },
  { x: 152, y: 4 },
  { x: 194, y: 8 },
  { x: 207, y: 20 },
  { x: 208, y: 60 },
  { x: 204, y: 92 },
  { x: 203, y: 113 },
  { x: 195, y: 111 },
  { x: 168, y: 102 },
  { x: 165, y: 114 },
  { x: 118, y: 114 },
  { x: 114, y: 102 },
  { x: 155, y: 103 },
  { x: 156, y: 93 },
  { x: 180, y: 92 },
  { x: 185, y: 83 },
  { x: 186, y: 32 },
  { x: 174, y: 21 },
  { x: 140, y: 22 },
  { x: 116, y: 21 },
  { x: 118, y: 9 }
];

const OBSTACLE_ZONE_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 49, y: 86 },
  { x: 46.2, y: 93.1 },
  { x: 39.3, y: 95.7 },
  { x: 32.4, y: 93.1 },
  { x: 29.6, y: 86 },
  { x: 32.4, y: 78.9 },
  { x: 39.3, y: 76.3 },
  { x: 46.2, y: 78.9 }
];

export const QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS =
  BACK_ZONE_TARGET_RING_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS =
  BACK_ZONE_RAW_STROKE_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_PATH = buildQuoteGuideSmoothSvgPath(
  QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS
);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS =
  QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS;

export const QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS =
  RIGHT_ZONE_TARGET_RING_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS =
  RIGHT_ZONE_INITIAL_RING_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_LOCAL_POINTS =
  RIGHT_ZONE_RAW_STROKE_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_PATH = buildQuoteGuideSmoothSvgPath(
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_LOCAL_POINTS
);

export const QUOTE_GUIDE_DEMO_OBSTACLE_ZONE_LOCAL_POINTS =
  OBSTACLE_ZONE_ASSET_POINTS.map(assetPointToLocalPoint);

const FRONT_LEFT_POLYGON_ID = 'guide-front-left-zone';
const BACK_POLYGON_ID = 'guide-back-zone';
const RIGHT_POLYGON_ID = 'guide-right-zone';

const createPolygonState = (
  id: string,
  ringLocalPoints: QuoteGuideDemoPoint[],
  selected: boolean,
  showVertices = false,
  selectedVertexIndex: number | null = null
): QuoteGuideMultiZonePolygonState => ({
  id,
  ringLocalPoints: clonePoints(ringLocalPoints),
  selected,
  showVertices,
  selectedVertexIndex
});

const createBasePolygons = () => [
  createPolygonState(
    FRONT_LEFT_POLYGON_ID,
    QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
    false
  ),
  createPolygonState(
    BACK_POLYGON_ID,
    QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS,
    false
  )
];

const createPolygonsWithInitialRightZone = (
  selectedVertexIndex: number | null = null
): QuoteGuideMultiZonePolygonState[] => [
  ...createBasePolygons(),
  createPolygonState(
    RIGHT_POLYGON_ID,
    QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS,
    true,
    true,
    selectedVertexIndex
  )
];

const getInsertedVertexEdgePoint = () => {
  const segmentStart = QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS[6];
  const segmentEnd = QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS[7];

  return interpolatePoint(segmentStart, segmentEnd, 0.45);
};

const RIGHT_ZONE_INSERTED_VERTEX_INDEX = 7;
const RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT = 18;

const createRightZoneRingWithInsertedVertex = (
  insertedPoint: QuoteGuideDemoPoint
): QuoteGuideDemoPoint[] => {
  const nextPoints = clonePoints(QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS);
  nextPoints.splice(RIGHT_ZONE_INSERTED_VERTEX_INDEX, 0, clonePoint(insertedPoint));
  return nextPoints;
};

const createPolygonsWithInsertedRightVertex = (
  insertedPoint: QuoteGuideDemoPoint,
  selectedVertexIndex: number | null
): QuoteGuideMultiZonePolygonState[] => [
  ...createBasePolygons(),
  createPolygonState(
    RIGHT_POLYGON_ID,
    createRightZoneRingWithInsertedVertex(insertedPoint),
    true,
    true,
    selectedVertexIndex
  )
];

const createFinalPolygons = (
  selectedVertexIndex: number | null = null
): QuoteGuideMultiZonePolygonState[] => [
  ...createBasePolygons(),
  createPolygonState(
    RIGHT_POLYGON_ID,
    QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS,
    true,
    true,
    selectedVertexIndex
  )
];

const createDeletingPolygons = (progress: number) =>
  progress < 0.48
    ? createPolygonsWithInsertedRightVertex(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT
      )
    : createFinalPolygons(null);

const createAnimationState = ({
  phase,
  cursorPoint,
  polygons,
  rawStrokePath = null,
  rawStrokeProgress = 0,
  drawButtonActive = false,
  deleteEnabled = false,
  showCursor = true,
  cursorVariant = 'default',
  camera = QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA,
  deletedVertexPoint = null,
  deletedVertexProgress = 0
}: {
  phase: QuoteGuideMultiZoneDemoPhase;
  cursorPoint: QuoteGuideDemoPoint;
  polygons: QuoteGuideMultiZonePolygonState[];
  rawStrokePath?: string | null;
  rawStrokeProgress?: number;
  drawButtonActive?: boolean;
  deleteEnabled?: boolean;
  showCursor?: boolean;
  cursorVariant?: 'default' | 'add-vertex';
  camera?: QuoteGuideDemoCameraState;
  deletedVertexPoint?: QuoteGuideDemoPoint | null;
  deletedVertexProgress?: number;
}): QuoteGuideMultiZoneDemoAnimationState => ({
  phase,
  drawButtonLabel: drawButtonActive ? 'Stop drawing' : 'Draw lawn',
  drawButtonActive,
  obstacleButtonActive: false,
  doneEnabled: polygons.length > 0,
  deleteEnabled,
  clearAllEnabled: polygons.length > 0,
  undoEnabled: polygons.length > 0,
  redoEnabled: false,
  showCursor,
  cursorPoint,
  cursorVariant,
  camera: cloneCamera(camera),
  polygons: polygons.map(clonePolygon),
  rawStrokePath,
  rawStrokeProgress,
  deletedVertexPoint: deletedVertexPoint ? clonePoint(deletedVertexPoint) : null,
  deletedVertexProgress
});

const getReleasePoint = (rawStrokePoints: QuoteGuideDemoPoint[]) => {
  const lastPoint = rawStrokePoints[rawStrokePoints.length - 1] ?? DRAW_BUTTON_POINT;

  return {
    x: lastPoint.x + CURSOR_RELEASE_OFFSET.x,
    y: lastPoint.y + CURSOR_RELEASE_OFFSET.y
  };
};

const RIGHT_ZONE_STROKE_START =
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_LOCAL_POINTS[0] ?? DRAW_BUTTON_POINT;
const RIGHT_ZONE_RELEASE_POINT = getReleasePoint(QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_LOCAL_POINTS);
const INSERTED_VERTEX_EDGE_POINT = getInsertedVertexEdgePoint();
const RIGHT_ZONE_TARGET_VERTEX_POINT =
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[RIGHT_ZONE_INSERTED_VERTEX_INDEX] ??
  INSERTED_VERTEX_EDGE_POINT;
const EXTRA_VERTEX_POINT =
  createRightZoneRingWithInsertedVertex(RIGHT_ZONE_TARGET_VERTEX_POINT)[
    RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT
  ] ?? CURSOR_REST_POINT;
const ADD_VERTEX_CAMERA = createZoomCamera(RIGHT_ZONE_TARGET_VERTEX_POINT, 2.05);
const DELETE_VERTEX_CAMERA = createZoomCamera(EXTRA_VERTEX_POINT, 2.05);

export const QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS =
  INITIAL_IDLE_DURATION_MS +
  CURSOR_TO_BUTTON_DURATION_MS +
  ACTIVATE_DRAW_DURATION_MS +
  CURSOR_TO_ZONE_DURATION_MS +
  DRAWING_DURATION_MS +
  ZONE_FINALIZED_HOLD_DURATION_MS +
  CURSOR_TO_EDGE_DURATION_MS +
  INSERT_VERTEX_DURATION_MS +
  DRAG_INSERTED_VERTEX_DURATION_MS +
  ADDED_VERTEX_HOLD_DURATION_MS +
  CURSOR_TO_VERTEX_DURATION_MS +
  SELECT_VERTEX_DURATION_MS +
  CURSOR_TO_DELETE_DURATION_MS +
  CLICK_DELETE_BUTTON_DURATION_MS +
  DELETE_VERTEX_DURATION_MS +
  FINAL_HOLD_DURATION_MS;

export const getReducedMotionQuoteGuideMultiZoneDemoAnimationState =
  (): QuoteGuideMultiZoneDemoAnimationState =>
    createAnimationState({
      phase: 'finalized',
      cursorPoint:
        QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[
          QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length - 1
        ] ?? CURSOR_REST_POINT,
      polygons: createFinalPolygons(),
      deleteEnabled: true,
      showCursor: false
    });

export const getQuoteGuideMultiZoneInstructionStateForPhase = (
  phase: QuoteGuideMultiZoneDemoPhase
): QuoteGuideMultiZoneInstructionState => {
  if (
    phase === 'cursor-to-edge' ||
    phase === 'insert-vertex' ||
    phase === 'drag-inserted-vertex' ||
    phase === 'vertex-added'
  ) {
    return 'add';
  }

  if (
    phase === 'cursor-to-extra-vertex' ||
    phase === 'select-extra-vertex' ||
    phase === 'cursor-to-delete' ||
    phase === 'click-delete-button' ||
    phase === 'deleting-vertex' ||
    phase === 'finalized'
  ) {
    return 'remove';
  }

  return 'draw';
};

export const getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs = (
  elapsedMs: number
): QuoteGuideMultiZoneDemoAnimationState => {
  const loopedElapsedMs =
    ((elapsedMs % QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS) +
      QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS) %
    QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS;

  if (loopedElapsedMs < INITIAL_IDLE_DURATION_MS) {
    return createAnimationState({
      phase: 'idle',
      cursorPoint: CURSOR_REST_POINT,
      polygons: createBasePolygons()
    });
  }

  let remainingElapsedMs = loopedElapsedMs - INITIAL_IDLE_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_BUTTON_DURATION_MS) {
    return createAnimationState({
      phase: 'cursor-to-button-right',
      cursorPoint: interpolatePolylinePoint(
        CURSOR_REST_POINT,
        DRAW_BUTTON_POINT,
        remainingElapsedMs / CURSOR_TO_BUTTON_DURATION_MS
      ),
      polygons: createBasePolygons()
    });
  }
  remainingElapsedMs -= CURSOR_TO_BUTTON_DURATION_MS;

  if (remainingElapsedMs < ACTIVATE_DRAW_DURATION_MS) {
    return createAnimationState({
      phase: 'activate-right-draw',
      cursorPoint: DRAW_BUTTON_POINT,
      polygons: createBasePolygons(),
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= ACTIVATE_DRAW_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_ZONE_DURATION_MS) {
    return createAnimationState({
      phase: 'cursor-to-right-zone',
      cursorPoint: interpolatePolylinePoint(
        DRAW_BUTTON_POINT,
        RIGHT_ZONE_STROKE_START,
        remainingElapsedMs / CURSOR_TO_ZONE_DURATION_MS
      ),
      polygons: createBasePolygons(),
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= CURSOR_TO_ZONE_DURATION_MS;

  if (remainingElapsedMs < DRAWING_DURATION_MS) {
    const progress = clamp01(remainingElapsedMs / DRAWING_DURATION_MS);

    return createAnimationState({
      phase: 'drawing-right-zone',
      cursorPoint: getPointAlongPolyline(QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_LOCAL_POINTS, progress),
      polygons: createBasePolygons(),
      rawStrokePath: QUOTE_GUIDE_DEMO_RIGHT_ZONE_RAW_STROKE_PATH,
      rawStrokeProgress: progress,
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= DRAWING_DURATION_MS;

  if (remainingElapsedMs < ZONE_FINALIZED_HOLD_DURATION_MS) {
    return createAnimationState({
      phase: 'right-zone-finalized',
      cursorPoint: RIGHT_ZONE_RELEASE_POINT,
      polygons: createPolygonsWithInitialRightZone()
    });
  }
  remainingElapsedMs -= ZONE_FINALIZED_HOLD_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_EDGE_DURATION_MS) {
    const progress = remainingElapsedMs / CURSOR_TO_EDGE_DURATION_MS;

    return createAnimationState({
      phase: 'cursor-to-edge',
      cursorPoint: interpolatePolylinePoint(
        RIGHT_ZONE_RELEASE_POINT,
        INSERTED_VERTEX_EDGE_POINT,
        progress
      ),
      polygons: createPolygonsWithInitialRightZone(),
      cursorVariant: 'add-vertex',
      camera: ADD_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= CURSOR_TO_EDGE_DURATION_MS;

  if (remainingElapsedMs < INSERT_VERTEX_DURATION_MS) {
    return createAnimationState({
      phase: 'insert-vertex',
      cursorPoint: INSERTED_VERTEX_EDGE_POINT,
      polygons: createPolygonsWithInsertedRightVertex(
        INSERTED_VERTEX_EDGE_POINT,
        RIGHT_ZONE_INSERTED_VERTEX_INDEX
      ),
      cursorVariant: 'add-vertex',
      camera: ADD_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= INSERT_VERTEX_DURATION_MS;

  if (remainingElapsedMs < DRAG_INSERTED_VERTEX_DURATION_MS) {
    const progress = easeInOutCubic(clamp01(remainingElapsedMs / DRAG_INSERTED_VERTEX_DURATION_MS));
    const insertedPoint = interpolatePoint(
      INSERTED_VERTEX_EDGE_POINT,
      RIGHT_ZONE_TARGET_VERTEX_POINT,
      progress
    );

    return createAnimationState({
      phase: 'drag-inserted-vertex',
      cursorPoint: insertedPoint,
      polygons: createPolygonsWithInsertedRightVertex(
        insertedPoint,
        RIGHT_ZONE_INSERTED_VERTEX_INDEX
      ),
      camera: ADD_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= DRAG_INSERTED_VERTEX_DURATION_MS;

  if (remainingElapsedMs < ADDED_VERTEX_HOLD_DURATION_MS) {
    return createAnimationState({
      phase: 'vertex-added',
      cursorPoint: RIGHT_ZONE_TARGET_VERTEX_POINT,
      polygons: createPolygonsWithInsertedRightVertex(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        RIGHT_ZONE_INSERTED_VERTEX_INDEX
      ),
      camera: ADD_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= ADDED_VERTEX_HOLD_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_VERTEX_DURATION_MS) {
    return createAnimationState({
      phase: 'cursor-to-extra-vertex',
      cursorPoint: interpolatePolylinePoint(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        EXTRA_VERTEX_POINT,
        remainingElapsedMs / CURSOR_TO_VERTEX_DURATION_MS
      ),
      polygons: createPolygonsWithInsertedRightVertex(RIGHT_ZONE_TARGET_VERTEX_POINT, null),
      camera: DELETE_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= CURSOR_TO_VERTEX_DURATION_MS;

  if (remainingElapsedMs < SELECT_VERTEX_DURATION_MS) {
    return createAnimationState({
      phase: 'select-extra-vertex',
      cursorPoint: EXTRA_VERTEX_POINT,
      polygons: createPolygonsWithInsertedRightVertex(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT
      ),
      deleteEnabled: true,
      camera: DELETE_VERTEX_CAMERA
    });
  }
  remainingElapsedMs -= SELECT_VERTEX_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_DELETE_DURATION_MS) {
    const progress = remainingElapsedMs / CURSOR_TO_DELETE_DURATION_MS;

    return createAnimationState({
      phase: 'cursor-to-delete',
      cursorPoint: interpolatePolylinePoint(
        QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA.focusPoint,
        DELETE_BUTTON_POINT,
        progress
      ),
      polygons: createPolygonsWithInsertedRightVertex(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT
      ),
      deleteEnabled: true,
      camera: QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
    });
  }
  remainingElapsedMs -= CURSOR_TO_DELETE_DURATION_MS;

  if (remainingElapsedMs < CLICK_DELETE_BUTTON_DURATION_MS) {
    return createAnimationState({
      phase: 'click-delete-button',
      cursorPoint: DELETE_BUTTON_POINT,
      polygons: createPolygonsWithInsertedRightVertex(
        RIGHT_ZONE_TARGET_VERTEX_POINT,
        RIGHT_ZONE_EXTRA_VERTEX_INDEX_AFTER_INSERT
      ),
      deleteEnabled: true
    });
  }
  remainingElapsedMs -= CLICK_DELETE_BUTTON_DURATION_MS;

  if (remainingElapsedMs < DELETE_VERTEX_DURATION_MS) {
    const progress = clamp01(remainingElapsedMs / DELETE_VERTEX_DURATION_MS);

    return createAnimationState({
      phase: 'deleting-vertex',
      cursorPoint: EXTRA_VERTEX_POINT,
      polygons: createDeletingPolygons(progress),
      deleteEnabled: true,
      showCursor: false,
      camera: DELETE_VERTEX_CAMERA,
      deletedVertexPoint: EXTRA_VERTEX_POINT,
      deletedVertexProgress: progress
    });
  }
  remainingElapsedMs -= DELETE_VERTEX_DURATION_MS;

  return createAnimationState({
    phase: 'finalized',
    cursorPoint:
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[
        QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length - 1
    ] ?? CURSOR_REST_POINT,
    polygons: createFinalPolygons(),
    deleteEnabled: true,
    camera: QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
  });
};

export const QUOTE_GUIDE_MULTI_ZONE_DEMO_STAGE_CENTER_LOCAL_POINT: QuoteGuideDemoPoint = {
  x: QUOTE_GUIDE_DEMO_MAP_WIDTH / 2,
  y: QUOTE_GUIDE_DEMO_BACKGROUND_TOP + QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT / 2
};

export const QUOTE_GUIDE_MULTI_ZONE_DEMO_STAGE_CENTER_LNG_LAT = localPointToSyntheticLngLat(
  QUOTE_GUIDE_MULTI_ZONE_DEMO_STAGE_CENTER_LOCAL_POINT
);

export const buildQuoteGuideMultiZonePolygonPath = (points: QuoteGuideDemoPoint[]) =>
  buildQuoteGuideSvgPath(points, true);

export const quoteGuideMultiZoneLocalPointsToLngLat = (points: QuoteGuideDemoPoint[]) =>
  points.map(localPointToSyntheticLngLat);

if (QUOTE_GUIDE_DEMO_MAP_HEIGHT <= QUOTE_GUIDE_DEMO_BACKGROUND_TOP) {
  throw new Error('Quote guide step 2 geometry constants are misconfigured.');
}
