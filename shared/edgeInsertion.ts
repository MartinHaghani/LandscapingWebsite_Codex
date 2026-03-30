export type EdgeInsertionLngLat = [number, number];

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface EdgeInsertionProjector {
  project: (point: EdgeInsertionLngLat) => ScreenPoint;
  unproject: (point: ScreenPoint) => EdgeInsertionLngLat;
}

export interface EdgeInsertionHit {
  segmentIndex: number;
  insertIndex: number;
  projectedPoint: ScreenPoint;
  lngLat: EdgeInsertionLngLat;
  distancePx: number;
}

export const EDGE_INSERTION_HIT_TOLERANCE_PX = 12;

const ADD_VERTEX_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="8" fill="white" stroke="#DCFCE7" stroke-width="2"/><path d="M14 9V19M9 14H19" stroke="#329F5B" stroke-width="2.5" stroke-linecap="round"/></svg>`;

export const ADD_VERTEX_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  ADD_VERTEX_CURSOR_SVG
)}") 14 14, copy`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distancePx = (from: ScreenPoint, to: ScreenPoint) => Math.hypot(to.x - from.x, to.y - from.y);

const projectPointOntoSegment = (
  pointerPoint: ScreenPoint,
  segmentStart: ScreenPoint,
  segmentEnd: ScreenPoint
) => {
  const deltaX = segmentEnd.x - segmentStart.x;
  const deltaY = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = deltaX ** 2 + deltaY ** 2;

  if (segmentLengthSquared === 0) {
    return {
      projectedPoint: segmentStart,
      distancePx: distancePx(pointerPoint, segmentStart)
    };
  }

  const ratio = clamp(
    ((pointerPoint.x - segmentStart.x) * deltaX + (pointerPoint.y - segmentStart.y) * deltaY) /
      segmentLengthSquared,
    0,
    1
  );

  const projectedPoint = {
    x: segmentStart.x + deltaX * ratio,
    y: segmentStart.y + deltaY * ratio
  };

  return {
    projectedPoint,
    distancePx: distancePx(pointerPoint, projectedPoint)
  };
};

export const findEdgeInsertionHit = (
  ringPoints: EdgeInsertionLngLat[],
  pointerPoint: ScreenPoint,
  projector: EdgeInsertionProjector,
  tolerancePx = EDGE_INSERTION_HIT_TOLERANCE_PX
): EdgeInsertionHit | null => {
  if (ringPoints.length < 2) {
    return null;
  }

  let bestHit: EdgeInsertionHit | null = null;

  for (let index = 0; index < ringPoints.length; index += 1) {
    const nextIndex = (index + 1) % ringPoints.length;
    const startPoint = projector.project(ringPoints[index]);
    const endPoint = projector.project(ringPoints[nextIndex]);
    const segmentProjection = projectPointOntoSegment(pointerPoint, startPoint, endPoint);

    if (segmentProjection.distancePx > tolerancePx) {
      continue;
    }

    if (!bestHit || segmentProjection.distancePx < bestHit.distancePx) {
      bestHit = {
        segmentIndex: index,
        insertIndex: index + 1,
        projectedPoint: segmentProjection.projectedPoint,
        lngLat: projector.unproject(segmentProjection.projectedPoint),
        distancePx: segmentProjection.distancePx
      };
    }
  }

  return bestHit;
};

export const insertPointIntoRing = (
  ringPoints: EdgeInsertionLngLat[],
  insertIndex: number,
  point: EdgeInsertionLngLat
) => {
  const nextPoints = ringPoints.map(([lng, lat]) => [lng, lat] as EdgeInsertionLngLat);
  nextPoints.splice(insertIndex, 0, [point[0], point[1]]);
  return nextPoints;
};
