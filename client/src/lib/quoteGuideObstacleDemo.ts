import {
  buildQuoteGuideSmoothSvgPath,
  buildQuoteGuideSvgPath,
  QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT,
  QUOTE_GUIDE_DEMO_BACKGROUND_TOP,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA,
  QUOTE_GUIDE_DEMO_MAP_HEIGHT,
  QUOTE_GUIDE_DEMO_MAP_WIDTH,
  type QuoteGuideDemoCameraState,
  type QuoteGuideDemoPoint
} from './quoteGuideDemo';
import {
  QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_OBSTACLE_ZONE_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
} from './quoteGuideMultiZoneDemo';
import type { PolygonKind } from '../types';

export interface QuoteGuideObstacleDemoPolygonState {
  id: string;
  kind: PolygonKind;
  ringLocalPoints: QuoteGuideDemoPoint[];
  selected: boolean;
  showVertices: boolean;
  selectedVertexIndex: number | null;
}

export type QuoteGuideObstacleDemoPhase =
  | 'idle'
  | 'cursor-to-obstacle-button'
  | 'activate-obstacle-draw'
  | 'cursor-to-front-tree'
  | 'drawing-obstacle'
  | 'obstacle-finalized'
  | 'finalized';

export interface QuoteGuideObstacleDemoAnimationState {
  phase: QuoteGuideObstacleDemoPhase;
  drawButtonLabel: 'Draw lawn';
  drawButtonActive: false;
  obstacleButtonActive: boolean;
  doneEnabled: boolean;
  deleteEnabled: boolean;
  clearAllEnabled: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  showCursor: boolean;
  cursorPoint: QuoteGuideDemoPoint;
  camera: QuoteGuideDemoCameraState;
  polygons: QuoteGuideObstacleDemoPolygonState[];
  rawStrokePath: string | null;
  rawStrokeProgress: number;
}

const BACKGROUND_VIEWBOX_WIDTH = 220;
const BACKGROUND_SCALE = QUOTE_GUIDE_DEMO_MAP_WIDTH / BACKGROUND_VIEWBOX_WIDTH;

const INITIAL_IDLE_DURATION_MS = 640;
const CURSOR_TO_BUTTON_DURATION_MS = 620;
const ACTIVATE_OBSTACLE_DRAW_DURATION_MS = 260;
const CURSOR_TO_TREE_DURATION_MS = 760;
const DRAWING_DURATION_MS = 1_280;
const OBSTACLE_FINALIZED_HOLD_DURATION_MS = 540;
const FINAL_HOLD_DURATION_MS = 2_000;

const CURSOR_REST_POINT: QuoteGuideDemoPoint = { x: 564, y: 316 };
const OBSTACLE_BUTTON_POINT: QuoteGuideDemoPoint = { x: 320, y: 29 };
const CURSOR_RELEASE_OFFSET: QuoteGuideDemoPoint = { x: 14, y: 10 };

const FRONT_LEFT_POLYGON_ID = 'guide-front-left-zone';
const BACK_POLYGON_ID = 'guide-back-zone';
const RIGHT_POLYGON_ID = 'guide-right-zone';
const FRONT_TREE_OBSTACLE_POLYGON_ID = 'guide-front-tree-obstacle-zone';

const FRONT_TREE_OBSTACLE_RAW_STROKE_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 49.2, y: 85.2 },
  { x: 46.9, y: 93.8 },
  { x: 38.9, y: 96.2 },
  { x: 31.1, y: 92.8 },
  { x: 28.8, y: 84.7 },
  { x: 33.3, y: 78.1 },
  { x: 40.5, y: 76.5 },
  { x: 47.7, y: 79.5 },
  { x: 49.5, y: 85.6 }
];

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
  polygon: QuoteGuideObstacleDemoPolygonState
): QuoteGuideObstacleDemoPolygonState => ({
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

const createPolygonState = (
  id: string,
  kind: PolygonKind,
  ringLocalPoints: QuoteGuideDemoPoint[],
  selected: boolean,
  showVertices = false,
  selectedVertexIndex: number | null = null
): QuoteGuideObstacleDemoPolygonState => ({
  id,
  kind,
  ringLocalPoints: clonePoints(ringLocalPoints),
  selected,
  showVertices,
  selectedVertexIndex
});

const createBasePolygons = (): QuoteGuideObstacleDemoPolygonState[] => [
  createPolygonState(
    FRONT_LEFT_POLYGON_ID,
    'service',
    QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
    false
  ),
  createPolygonState(
    BACK_POLYGON_ID,
    'service',
    QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS,
    false
  ),
  createPolygonState(
    RIGHT_POLYGON_ID,
    'service',
    QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS,
    false
  )
];

const createFinalPolygons = (): QuoteGuideObstacleDemoPolygonState[] => [
  ...createBasePolygons(),
  createPolygonState(
    FRONT_TREE_OBSTACLE_POLYGON_ID,
    'obstacle',
    QUOTE_GUIDE_DEMO_OBSTACLE_ZONE_LOCAL_POINTS,
    true,
    true
  )
];

export const QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS =
  QUOTE_GUIDE_DEMO_OBSTACLE_ZONE_LOCAL_POINTS;

export const QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_LOCAL_POINTS =
  FRONT_TREE_OBSTACLE_RAW_STROKE_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_PATH =
  buildQuoteGuideSmoothSvgPath(QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_LOCAL_POINTS);

const getReleasePoint = (rawStrokePoints: QuoteGuideDemoPoint[]) => {
  const lastPoint = rawStrokePoints[rawStrokePoints.length - 1] ?? OBSTACLE_BUTTON_POINT;

  return {
    x: lastPoint.x + CURSOR_RELEASE_OFFSET.x,
    y: lastPoint.y + CURSOR_RELEASE_OFFSET.y
  };
};

const FRONT_TREE_STROKE_START =
  QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_LOCAL_POINTS[0] ?? OBSTACLE_BUTTON_POINT;
const FRONT_TREE_RELEASE_POINT = getReleasePoint(
  QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_LOCAL_POINTS
);

export const QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS =
  INITIAL_IDLE_DURATION_MS +
  CURSOR_TO_BUTTON_DURATION_MS +
  ACTIVATE_OBSTACLE_DRAW_DURATION_MS +
  CURSOR_TO_TREE_DURATION_MS +
  DRAWING_DURATION_MS +
  OBSTACLE_FINALIZED_HOLD_DURATION_MS +
  FINAL_HOLD_DURATION_MS;

const createAnimationState = ({
  phase,
  cursorPoint,
  polygons,
  obstacleButtonActive = false,
  showCursor = true,
  rawStrokePath = null,
  rawStrokeProgress = 0,
  camera = QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
}: {
  phase: QuoteGuideObstacleDemoPhase;
  cursorPoint: QuoteGuideDemoPoint;
  polygons: QuoteGuideObstacleDemoPolygonState[];
  obstacleButtonActive?: boolean;
  showCursor?: boolean;
  rawStrokePath?: string | null;
  rawStrokeProgress?: number;
  camera?: QuoteGuideDemoCameraState;
}): QuoteGuideObstacleDemoAnimationState => ({
  phase,
  drawButtonLabel: 'Draw lawn',
  drawButtonActive: false,
  obstacleButtonActive,
  doneEnabled: true,
  deleteEnabled: false,
  clearAllEnabled: true,
  undoEnabled: true,
  redoEnabled: false,
  showCursor,
  cursorPoint,
  camera: cloneCamera(camera),
  polygons: polygons.map(clonePolygon),
  rawStrokePath,
  rawStrokeProgress
});

export const getReducedMotionQuoteGuideObstacleDemoAnimationState =
  (): QuoteGuideObstacleDemoAnimationState =>
    createAnimationState({
      phase: 'finalized',
      cursorPoint: FRONT_TREE_RELEASE_POINT,
      polygons: createFinalPolygons(),
      showCursor: false
    });

export const getQuoteGuideObstacleDemoAnimationStateAtElapsedMs = (
  elapsedMs: number
): QuoteGuideObstacleDemoAnimationState => {
  let currentElapsedMs =
    ((elapsedMs % QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS) +
      QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS) %
    QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS;

  if (currentElapsedMs < INITIAL_IDLE_DURATION_MS) {
    return createAnimationState({
      phase: 'idle',
      cursorPoint: CURSOR_REST_POINT,
      polygons: createBasePolygons()
    });
  }
  currentElapsedMs -= INITIAL_IDLE_DURATION_MS;

  if (currentElapsedMs < CURSOR_TO_BUTTON_DURATION_MS) {
    return createAnimationState({
      phase: 'cursor-to-obstacle-button',
      cursorPoint: interpolatePoint(
        CURSOR_REST_POINT,
        OBSTACLE_BUTTON_POINT,
        easeInOutCubic(currentElapsedMs / CURSOR_TO_BUTTON_DURATION_MS)
      ),
      polygons: createBasePolygons()
    });
  }
  currentElapsedMs -= CURSOR_TO_BUTTON_DURATION_MS;

  if (currentElapsedMs < ACTIVATE_OBSTACLE_DRAW_DURATION_MS) {
    return createAnimationState({
      phase: 'activate-obstacle-draw',
      cursorPoint: OBSTACLE_BUTTON_POINT,
      polygons: createBasePolygons(),
      obstacleButtonActive: true
    });
  }
  currentElapsedMs -= ACTIVATE_OBSTACLE_DRAW_DURATION_MS;

  if (currentElapsedMs < CURSOR_TO_TREE_DURATION_MS) {
    return createAnimationState({
      phase: 'cursor-to-front-tree',
      cursorPoint: interpolatePoint(
        OBSTACLE_BUTTON_POINT,
        FRONT_TREE_STROKE_START,
        easeInOutCubic(currentElapsedMs / CURSOR_TO_TREE_DURATION_MS)
      ),
      polygons: createBasePolygons(),
      obstacleButtonActive: true
    });
  }
  currentElapsedMs -= CURSOR_TO_TREE_DURATION_MS;

  if (currentElapsedMs < DRAWING_DURATION_MS) {
    const progress = clamp01(currentElapsedMs / DRAWING_DURATION_MS);

    return createAnimationState({
      phase: 'drawing-obstacle',
      cursorPoint: getPointAlongPolyline(
        QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_LOCAL_POINTS,
        progress
      ),
      polygons: createBasePolygons(),
      obstacleButtonActive: true,
      rawStrokePath: QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_RAW_STROKE_PATH,
      rawStrokeProgress: progress
    });
  }
  currentElapsedMs -= DRAWING_DURATION_MS;

  if (currentElapsedMs < OBSTACLE_FINALIZED_HOLD_DURATION_MS) {
    return createAnimationState({
      phase: 'obstacle-finalized',
      cursorPoint: FRONT_TREE_RELEASE_POINT,
      polygons: createFinalPolygons()
    });
  }
  currentElapsedMs -= OBSTACLE_FINALIZED_HOLD_DURATION_MS;

  return createAnimationState({
    phase: 'finalized',
    cursorPoint: FRONT_TREE_RELEASE_POINT,
    polygons: createFinalPolygons(),
    showCursor: false
  });
};

export const buildQuoteGuideObstaclePolygonPath = (points: QuoteGuideDemoPoint[]) =>
  buildQuoteGuideSvgPath(points, true);

if (QUOTE_GUIDE_DEMO_MAP_HEIGHT <= QUOTE_GUIDE_DEMO_BACKGROUND_TOP) {
  throw new Error('Quote guide step 3 geometry constants are misconfigured.');
}

if (QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT <= 0) {
  throw new Error('Quote guide step 3 background height must be positive.');
}
