import { finalizeFreehandStroke } from './freehand';
import type { LngLat } from '../types';

export interface QuoteGuideDemoPoint {
  x: number;
  y: number;
}

export interface QuoteGuideDemoCameraState {
  scale: number;
  focusPoint: QuoteGuideDemoPoint;
}

export type QuoteGuideDemoPhase =
  | 'idle'
  | 'cursor-to-button'
  | 'activate-draw'
  | 'cursor-to-lawn'
  | 'drawing'
  | 'polygon-finalized'
  | 'cursor-to-vertex'
  | 'dragging-vertex'
  | 'front-zone-finalized'
  | 'cursor-to-button-back'
  | 'activate-back-draw'
  | 'cursor-to-back-zone'
  | 'drawing-back-zone'
  | 'finalized';

export interface QuoteGuideDemoPolygonState {
  id: 'front-left' | 'back-left';
  ringLocalPoints: QuoteGuideDemoPoint[];
  selected: boolean;
  showVertices: boolean;
  selectedVertexIndex: number | null;
}

export interface QuoteGuideDemoAnimationState {
  phase: QuoteGuideDemoPhase;
  buttonLabel: 'Draw lawn' | 'Stop drawing';
  drawButtonActive: boolean;
  doneEnabled: boolean;
  deleteEnabled: boolean;
  clearAllEnabled: boolean;
  undoEnabled: boolean;
  redoEnabled: boolean;
  rawStrokeProgress: number;
  rawStrokePath: string | null;
  showVertices: boolean;
  showCursor: boolean;
  cursorPoint: QuoteGuideDemoPoint;
  camera: QuoteGuideDemoCameraState;
  polygons: QuoteGuideDemoPolygonState[];
  polygonRingLocalPoints: QuoteGuideDemoPoint[] | null;
  selectedVertexIndex: number | null;
}

export type QuoteGuideDemoInstructionState = 'draw' | 'edit';

const SYNTHETIC_ORIGIN: LngLat = [-79.51962, 43.844147];
const SYNTHETIC_METERS_PER_LOCAL_UNIT = 0.25;
const METERS_PER_DEGREE_LAT = 111_132;
const METERS_PER_DEGREE_LNG = 111_320 * Math.cos((SYNTHETIC_ORIGIN[1] * Math.PI) / 180);

const BACKGROUND_VIEWBOX_WIDTH = 220;
const BACKGROUND_VIEWBOX_HEIGHT = 120;
const TOOLBAR_ROW_HEIGHT = 58;
const BACKGROUND_SCALE = 640 / BACKGROUND_VIEWBOX_WIDTH;

export const QUOTE_GUIDE_DEMO_CAMERA_TRANSITION_DURATION_MS = 1_600;
export const QUOTE_GUIDE_DEMO_STAGE_FADE_DURATION_MS = 920;

const INITIAL_IDLE_DURATION_MS = 620;
const CURSOR_TO_BUTTON_DURATION_MS = 760;
const ACTIVATE_DRAW_DURATION_MS = 260;
const CURSOR_TO_ZONE_DURATION_MS = 700;
const DRAWING_DURATION_MS = 1_820;
const INITIAL_FINALIZED_HOLD_DURATION_MS = 760;
const CURSOR_TO_VERTEX_DURATION_MS = 280;
const DRAG_VERTEX_DURATION_MS = 420;
const FRONT_CLEANED_HOLD_DURATION_MS = 520;
const FINAL_HOLD_DURATION_MS = 1_420;

const CURSOR_REST_POINT: QuoteGuideDemoPoint = { x: 562, y: 316 };
const DRAW_BUTTON_POINT: QuoteGuideDemoPoint = { x: 235, y: 29 };
const CURSOR_RELEASE_OFFSET: QuoteGuideDemoPoint = { x: 14, y: 10 };

export const QUOTE_GUIDE_DEMO_MAP_WIDTH = 640;
export const QUOTE_GUIDE_DEMO_BACKGROUND_TOP = TOOLBAR_ROW_HEIGHT;
export const QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT =
  (QUOTE_GUIDE_DEMO_MAP_WIDTH * BACKGROUND_VIEWBOX_HEIGHT) / BACKGROUND_VIEWBOX_WIDTH;
export const QUOTE_GUIDE_DEMO_MAP_HEIGHT =
  QUOTE_GUIDE_DEMO_BACKGROUND_TOP + QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT;
export const QUOTE_GUIDE_DEMO_STAGE_CENTER_LOCAL_POINT: QuoteGuideDemoPoint = {
  x: QUOTE_GUIDE_DEMO_MAP_WIDTH / 2,
  y: QUOTE_GUIDE_DEMO_BACKGROUND_TOP + QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT / 2
};

export const QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA: QuoteGuideDemoCameraState = {
  scale: 1,
  focusPoint: QUOTE_GUIDE_DEMO_STAGE_CENTER_LOCAL_POINT
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

export const getQuoteGuideDemoLoopFadeOpacity = (
  elapsedMs: number,
  loopDurationMs: number
) => {
  const fadeInProgress = clamp01(elapsedMs / QUOTE_GUIDE_DEMO_STAGE_FADE_DURATION_MS);
  const fadeOutProgress = clamp01(
    (loopDurationMs - elapsedMs) / QUOTE_GUIDE_DEMO_STAGE_FADE_DURATION_MS
  );

  return easeInOutCubic(Math.min(fadeInProgress, fadeOutProgress));
};

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

const getLocalSegmentLength = (from: QuoteGuideDemoPoint, to: QuoteGuideDemoPoint) =>
  Math.hypot(to.x - from.x, to.y - from.y);

const getPolylineLength = (points: QuoteGuideDemoPoint[]) =>
  points
    .slice(1)
    .reduce((total, point, index) => total + getLocalSegmentLength(points[index], point), 0);

export const buildQuoteGuideSvgPath = (points: QuoteGuideDemoPoint[], closePath = false) => {
  if (points.length === 0) {
    return '';
  }

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return closePath ? `${path} Z` : path;
};

export const buildQuoteGuideSmoothSvgPath = (points: QuoteGuideDemoPoint[]) => {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  const commands: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let index = 0; index < points.length - 2; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpoint = {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2
    };

    commands.push(
      `Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${midpoint.x.toFixed(2)} ${midpoint.y.toFixed(2)}`
    );
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  commands.push(
    `Q ${penultimate.x.toFixed(2)} ${penultimate.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
  );

  return commands.join(' ');
};

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

export const localPointToSyntheticLngLat = (point: QuoteGuideDemoPoint): LngLat => [
  SYNTHETIC_ORIGIN[0] + (point.x * SYNTHETIC_METERS_PER_LOCAL_UNIT) / METERS_PER_DEGREE_LNG,
  SYNTHETIC_ORIGIN[1] - (point.y * SYNTHETIC_METERS_PER_LOCAL_UNIT) / METERS_PER_DEGREE_LAT
];

export const syntheticLngLatToLocalPoint = ([lng, lat]: LngLat): QuoteGuideDemoPoint => ({
  x: ((lng - SYNTHETIC_ORIGIN[0]) * METERS_PER_DEGREE_LNG) / SYNTHETIC_METERS_PER_LOCAL_UNIT,
  y: ((SYNTHETIC_ORIGIN[1] - lat) * METERS_PER_DEGREE_LAT) / SYNTHETIC_METERS_PER_LOCAL_UNIT
});

const assetPointToLocalPoint = (point: QuoteGuideDemoPoint): QuoteGuideDemoPoint => ({
  x: point.x * BACKGROUND_SCALE,
  y: point.y * BACKGROUND_SCALE + TOOLBAR_ROW_HEIGHT
});

const FRONT_DOWN_ZONE_TARGET_RING_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 6, y: 58 },
  { x: 37, y: 58 },
  { x: 45, y: 74 },
  { x: 67, y: 74 },
  { x: 74, y: 74 },
  { x: 74, y: 103 },
  { x: 114, y: 103 },
  { x: 114, y: 114 },
  { x: 6, y: 114 },
  { x: 6, y: 95 }
];

const FRONT_DOWN_ZONE_RAW_STROKE_ASSET_POINTS: QuoteGuideDemoPoint[] = [
  { x: 10, y: 59 },
  { x: 24, y: 57 },
  { x: 36, y: 58 },
  { x: 45, y: 73 },
  { x: 73, y: 74 },
  { x: 74, y: 103 },
  { x: 114, y: 103 },
  { x: 112, y: 114 },
  { x: 8, y: 114 },
  { x: 7, y: 88 },
  { x: 10, y: 59 }
];

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

export const QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS =
  FRONT_DOWN_ZONE_TARGET_RING_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS =
  FRONT_DOWN_ZONE_RAW_STROKE_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_PATH = buildQuoteGuideSmoothSvgPath(
  QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS
);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS =
  BACK_ZONE_TARGET_RING_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS =
  BACK_ZONE_RAW_STROKE_ASSET_POINTS.map(assetPointToLocalPoint);

export const QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_PATH = buildQuoteGuideSmoothSvgPath(
  QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS
);

const finalizedFrontZoneStroke = finalizeFreehandStroke(
  QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS.map(localPointToSyntheticLngLat)
);

if (!finalizedFrontZoneStroke) {
  throw new Error('Quote guide demo stroke failed to finalize for the front-down lawn zone.');
}

export const QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS =
  finalizedFrontZoneStroke.ringPoints.map(syntheticLngLatToLocalPoint);

if (
  QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS.length !==
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length
) {
  throw new Error(
    'Quote guide demo initial polygon does not match the target vertex count for the front-down lawn zone.'
  );
}

const getReleasePoint = (rawStrokePoints: QuoteGuideDemoPoint[]): QuoteGuideDemoPoint => {
  const lastPoint = rawStrokePoints[rawStrokePoints.length - 1] ?? DRAW_BUTTON_POINT;

  return {
    x: lastPoint.x + CURSOR_RELEASE_OFFSET.x,
    y: lastPoint.y + CURSOR_RELEASE_OFFSET.y
  };
};

const createEditedPolygonRing = (
  completedVertexCount: number,
  activeVertexIndex: number | null = null,
  activeVertexProgress = 0
) => {
  const initialRing = QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS;
  const targetRing = QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS;

  return initialRing.map((point, index) => {
    if (index < completedVertexCount) {
      return clonePoint(targetRing[index]);
    }

    if (activeVertexIndex !== null && index === activeVertexIndex) {
      return interpolatePoint(point, targetRing[index], activeVertexProgress);
    }

    return clonePoint(point);
  });
};

const createPolygonState = (
  id: QuoteGuideDemoPolygonState['id'],
  ringLocalPoints: QuoteGuideDemoPoint[],
  selected: boolean,
  showVertices = false,
  selectedVertexIndex: number | null = null
): QuoteGuideDemoPolygonState => ({
  id,
  ringLocalPoints: clonePoints(ringLocalPoints),
  selected,
  showVertices,
  selectedVertexIndex
});

const clonePolygon = (polygon: QuoteGuideDemoPolygonState): QuoteGuideDemoPolygonState => ({
  ...polygon,
  ringLocalPoints: clonePoints(polygon.ringLocalPoints)
});

const createCorrectedFrontPolygon = (
  selected = true,
  showVertices = selected,
  selectedVertexIndex: number | null = null
) =>
  createPolygonState(
    'front-left',
    QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
    selected,
    showVertices,
    selectedVertexIndex
  );

const createCorrectedLeftSidePolygons = (
  selectedPolygonId: QuoteGuideDemoPolygonState['id'] = 'back-left'
) => [
  createCorrectedFrontPolygon(selectedPolygonId === 'front-left', false),
  createPolygonState(
    'back-left',
    QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS,
    selectedPolygonId === 'back-left',
    selectedPolygonId === 'back-left'
  )
];

const createQuoteGuideDemoAnimationState = ({
  phase,
  cursorPoint,
  polygonRingLocalPoints = null,
  polygons,
  rawStrokePath = null,
  rawStrokeProgress = 0,
  drawButtonActive = false,
  showVertices = false,
  showCursor = true,
  selectedVertexIndex = null,
  camera = QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
}: {
  phase: QuoteGuideDemoPhase;
  cursorPoint: QuoteGuideDemoPoint;
  polygonRingLocalPoints?: QuoteGuideDemoPoint[] | null;
  polygons?: QuoteGuideDemoPolygonState[];
  rawStrokePath?: string | null;
  rawStrokeProgress?: number;
  drawButtonActive?: boolean;
  showVertices?: boolean;
  showCursor?: boolean;
  selectedVertexIndex?: number | null;
  camera?: QuoteGuideDemoCameraState;
}): QuoteGuideDemoAnimationState => {
  const effectivePolygons =
    polygons ??
    (polygonRingLocalPoints
      ? [createPolygonState('front-left', polygonRingLocalPoints, true, showVertices, selectedVertexIndex)]
      : []);
  const polygonVisible = effectivePolygons.length > 0;
  const selectedPolygon = effectivePolygons.find((polygon) => polygon.selected) ?? effectivePolygons[0];

  return {
    phase,
    buttonLabel: drawButtonActive ? 'Stop drawing' : 'Draw lawn',
    drawButtonActive,
    doneEnabled: polygonVisible,
    deleteEnabled: polygonVisible,
    clearAllEnabled: polygonVisible,
    undoEnabled: polygonVisible,
    redoEnabled: false,
    rawStrokePath,
    rawStrokeProgress,
    showVertices,
    showCursor,
    cursorPoint,
    camera: cloneCamera(camera),
    polygons: effectivePolygons.map(clonePolygon),
    polygonRingLocalPoints: selectedPolygon ? clonePoints(selectedPolygon.ringLocalPoints) : null,
    selectedVertexIndex: selectedPolygon?.selectedVertexIndex ?? selectedVertexIndex
  };
};

const getVertexEditCursorStartPoint = (vertexIndex: number) =>
  vertexIndex === 0
    ? getReleasePoint(QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS)
    : clonePoint(QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[vertexIndex - 1]);

const getVertexCameraStartPoint = (
  vertexIndex: number,
  currentVertexPoint: QuoteGuideDemoPoint
) =>
  vertexIndex === 0
    ? clonePoint(currentVertexPoint)
    : clonePoint(QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[vertexIndex - 1]);

const createZoomCamera = (
  focusPoint: QuoteGuideDemoPoint,
  scale: number
): QuoteGuideDemoCameraState => ({
  scale,
  focusPoint: clonePoint(focusPoint)
});

const getCompletedEditDurationMs = () =>
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length *
  (CURSOR_TO_VERTEX_DURATION_MS + DRAG_VERTEX_DURATION_MS);

export const QUOTE_GUIDE_DEMO_LOOP_DURATION_MS =
  INITIAL_IDLE_DURATION_MS +
  CURSOR_TO_BUTTON_DURATION_MS +
  ACTIVATE_DRAW_DURATION_MS +
  CURSOR_TO_ZONE_DURATION_MS +
  DRAWING_DURATION_MS +
  INITIAL_FINALIZED_HOLD_DURATION_MS +
  getCompletedEditDurationMs() +
  FRONT_CLEANED_HOLD_DURATION_MS +
  CURSOR_TO_BUTTON_DURATION_MS +
  ACTIVATE_DRAW_DURATION_MS +
  CURSOR_TO_ZONE_DURATION_MS +
  DRAWING_DURATION_MS +
  FINAL_HOLD_DURATION_MS;

export const getReducedMotionQuoteGuideDemoAnimationState = (): QuoteGuideDemoAnimationState =>
  createQuoteGuideDemoAnimationState({
    phase: 'finalized',
    cursorPoint:
      QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS[
        QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS.length - 1
      ] ?? CURSOR_REST_POINT,
    polygons: createCorrectedLeftSidePolygons('back-left'),
    showVertices: true,
    showCursor: false
  });

export const getQuoteGuideDemoInstructionStateForPhase = (
  phase: QuoteGuideDemoPhase
): QuoteGuideDemoInstructionState =>
  phase === 'cursor-to-vertex' ||
  phase === 'dragging-vertex' ||
  phase === 'front-zone-finalized' ||
  phase === 'finalized'
    ? 'edit'
    : 'draw';

export const getQuoteGuideDemoAnimationStateAtElapsedMs = (
  elapsedMs: number
): QuoteGuideDemoAnimationState => {
  const loopedElapsedMs =
    ((elapsedMs % QUOTE_GUIDE_DEMO_LOOP_DURATION_MS) + QUOTE_GUIDE_DEMO_LOOP_DURATION_MS) %
    QUOTE_GUIDE_DEMO_LOOP_DURATION_MS;

  if (loopedElapsedMs < INITIAL_IDLE_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'idle',
      cursorPoint: CURSOR_REST_POINT
    });
  }

  let remainingElapsedMs = loopedElapsedMs - INITIAL_IDLE_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_BUTTON_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'cursor-to-button',
      cursorPoint: interpolatePoint(
        CURSOR_REST_POINT,
        DRAW_BUTTON_POINT,
        easeInOutCubic(remainingElapsedMs / CURSOR_TO_BUTTON_DURATION_MS)
      )
    });
  }
  remainingElapsedMs -= CURSOR_TO_BUTTON_DURATION_MS;

  if (remainingElapsedMs < ACTIVATE_DRAW_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'activate-draw',
      cursorPoint: DRAW_BUTTON_POINT,
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= ACTIVATE_DRAW_DURATION_MS;

  const strokeStartPoint =
    QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS[0] ?? DRAW_BUTTON_POINT;
  if (remainingElapsedMs < CURSOR_TO_ZONE_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'cursor-to-lawn',
      cursorPoint: interpolatePoint(
        DRAW_BUTTON_POINT,
        strokeStartPoint,
        easeInOutCubic(remainingElapsedMs / CURSOR_TO_ZONE_DURATION_MS)
      ),
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= CURSOR_TO_ZONE_DURATION_MS;

  if (remainingElapsedMs < DRAWING_DURATION_MS) {
    const progress = clamp01(remainingElapsedMs / DRAWING_DURATION_MS);

    return createQuoteGuideDemoAnimationState({
      phase: 'drawing',
      cursorPoint: getPointAlongPolyline(QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS, progress),
      rawStrokePath: QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_PATH,
      rawStrokeProgress: progress,
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= DRAWING_DURATION_MS;

  if (remainingElapsedMs < INITIAL_FINALIZED_HOLD_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'polygon-finalized',
      cursorPoint: getReleasePoint(QUOTE_GUIDE_DEMO_FRONT_ZONE_RAW_STROKE_LOCAL_POINTS),
      polygonRingLocalPoints: QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS,
      showVertices: true
    });
  }
  remainingElapsedMs -= INITIAL_FINALIZED_HOLD_DURATION_MS;

  for (
    let vertexIndex = 0;
    vertexIndex < QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length;
    vertexIndex += 1
  ) {
    const currentRing = createEditedPolygonRing(vertexIndex);
    const currentVertexPoint = currentRing[vertexIndex];

    if (remainingElapsedMs < CURSOR_TO_VERTEX_DURATION_MS) {
      const phaseProgress = remainingElapsedMs / CURSOR_TO_VERTEX_DURATION_MS;
      const progress = easeInOutCubic(phaseProgress);
      const focusPoint = interpolatePoint(
        getVertexCameraStartPoint(vertexIndex, currentVertexPoint),
        currentVertexPoint,
        progress
      );
      const zoomCamera = createZoomCamera(focusPoint, 1.72);

      return createQuoteGuideDemoAnimationState({
        phase: 'cursor-to-vertex',
        cursorPoint: interpolatePoint(
          getVertexEditCursorStartPoint(vertexIndex),
          currentVertexPoint,
          progress
        ),
        polygonRingLocalPoints: currentRing,
        showVertices: true,
        selectedVertexIndex: vertexIndex,
        camera: zoomCamera
      });
    }
    remainingElapsedMs -= CURSOR_TO_VERTEX_DURATION_MS;

    if (remainingElapsedMs < DRAG_VERTEX_DURATION_MS) {
      const progress = clamp01(remainingElapsedMs / DRAG_VERTEX_DURATION_MS);

      return createQuoteGuideDemoAnimationState({
        phase: 'dragging-vertex',
        cursorPoint: interpolatePoint(
          currentVertexPoint,
          QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[vertexIndex],
          easeInOutCubic(progress)
        ),
        polygonRingLocalPoints: createEditedPolygonRing(vertexIndex, vertexIndex, easeInOutCubic(progress)),
        showVertices: true,
        selectedVertexIndex: vertexIndex,
        camera: createZoomCamera(
          interpolatePoint(
            currentVertexPoint,
            QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[vertexIndex],
            easeInOutCubic(progress)
          ),
          1.72
        )
      });
    }
    remainingElapsedMs -= DRAG_VERTEX_DURATION_MS;
  }

  if (remainingElapsedMs < FRONT_CLEANED_HOLD_DURATION_MS) {
    const finalEditedVertexPoint =
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[
        QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length - 1
      ] ?? CURSOR_REST_POINT;

    return createQuoteGuideDemoAnimationState({
      phase: 'front-zone-finalized',
      cursorPoint: finalEditedVertexPoint,
      polygons: [createCorrectedFrontPolygon(true, true)],
      showVertices: true,
      camera: QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
    });
  }
  remainingElapsedMs -= FRONT_CLEANED_HOLD_DURATION_MS;

  if (remainingElapsedMs < CURSOR_TO_BUTTON_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'cursor-to-button-back',
      cursorPoint: interpolatePoint(
        QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS[
          QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length - 1
        ] ?? CURSOR_REST_POINT,
        DRAW_BUTTON_POINT,
        easeInOutCubic(remainingElapsedMs / CURSOR_TO_BUTTON_DURATION_MS)
      ),
      polygons: [createCorrectedFrontPolygon(false, false)]
    });
  }
  remainingElapsedMs -= CURSOR_TO_BUTTON_DURATION_MS;

  if (remainingElapsedMs < ACTIVATE_DRAW_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'activate-back-draw',
      cursorPoint: DRAW_BUTTON_POINT,
      polygons: [createCorrectedFrontPolygon(false, false)],
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= ACTIVATE_DRAW_DURATION_MS;

  const backStrokeStartPoint =
    QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS[0] ?? DRAW_BUTTON_POINT;
  if (remainingElapsedMs < CURSOR_TO_ZONE_DURATION_MS) {
    return createQuoteGuideDemoAnimationState({
      phase: 'cursor-to-back-zone',
      cursorPoint: interpolatePoint(
        DRAW_BUTTON_POINT,
        backStrokeStartPoint,
        easeInOutCubic(remainingElapsedMs / CURSOR_TO_ZONE_DURATION_MS)
      ),
      polygons: [createCorrectedFrontPolygon(false, false)],
      drawButtonActive: true
    });
  }
  remainingElapsedMs -= CURSOR_TO_ZONE_DURATION_MS;

  if (remainingElapsedMs < DRAWING_DURATION_MS) {
    const progress = clamp01(remainingElapsedMs / DRAWING_DURATION_MS);

    return createQuoteGuideDemoAnimationState({
      phase: 'drawing-back-zone',
      cursorPoint: getPointAlongPolyline(QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS, progress),
      polygons: [createCorrectedFrontPolygon(false, false)],
      rawStrokePath: QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_PATH,
      rawStrokeProgress: progress,
      drawButtonActive: true
    });
  }

  return createQuoteGuideDemoAnimationState({
    phase: 'finalized',
    cursorPoint: getReleasePoint(QUOTE_GUIDE_DEMO_BACK_ZONE_RAW_STROKE_LOCAL_POINTS),
    polygons: createCorrectedLeftSidePolygons('back-left'),
    showVertices: true
  });
};
