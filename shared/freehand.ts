export type FreehandLngLat = [number, number];

export interface FinalizedFreehandStroke {
  rawStrokePoints: FreehandLngLat[];
  ringPoints: FreehandLngLat[];
}

export interface FinalizeFreehandStrokeOptions {
  rawPointMinDistanceM?: number;
  ringPointMinDistanceM?: number;
  minPathLengthM?: number;
  minBoundsDiagonalM?: number;
  maxRingPoints?: number;
  closingPointDistanceM?: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const RESAMPLE_CORNER_THRESHOLD_DEG = 55;
const SIMPLIFICATION_EPSILON_M = 0.45;
const LOOP_CLOSURE_MIN_PATH_LENGTH_M = 6;
const LOOP_CLOSURE_TAIL_POINT_COUNT = 6;
const LOOP_CLOSURE_DISTANCE_M = 1.25;

const DEFAULT_OPTIONS: Required<FinalizeFreehandStrokeOptions> = {
  rawPointMinDistanceM: 0.2,
  ringPointMinDistanceM: 1.25,
  minPathLengthM: 3,
  minBoundsDiagonalM: 1.5,
  maxRingPoints: 120,
  closingPointDistanceM: 0.6
};

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

export const haversineDistanceM = (from: FreehandLngLat, to: FreehandLngLat) => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const hav =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(hav)));
};

const clonePoints = (points: FreehandLngLat[]) =>
  points.map(([lng, lat]) => [lng, lat] as FreehandLngLat);

const dedupeByDistance = (points: FreehandLngLat[], minDistanceM: number) => {
  const deduped: FreehandLngLat[] = [];

  points.forEach((point) => {
    const lastPoint = deduped[deduped.length - 1];
    if (!lastPoint || haversineDistanceM(lastPoint, point) >= minDistanceM) {
      deduped.push(point);
    }
  });

  return deduped;
};

const interpolatePoint = (
  from: FreehandLngLat,
  to: FreehandLngLat,
  ratio: number
): FreehandLngLat => [
  from[0] + (to[0] - from[0]) * ratio,
  from[1] + (to[1] - from[1]) * ratio
];

const resampleByDistance = (
  points: FreehandLngLat[],
  spacingM: number,
  anchorIndices: Set<number>
) => {
  if (points.length <= 2 || spacingM <= 0) {
    return clonePoints(points);
  }

  const resampledPoints: FreehandLngLat[] = [points[0]];
  let distanceSinceLastSampleM = 0;
  let segmentStart = points[0];

  for (let index = 1; index < points.length; index += 1) {
    const segmentEnd = points[index];
    let remainingSegmentLengthM = haversineDistanceM(segmentStart, segmentEnd);

    if (remainingSegmentLengthM === 0) {
      continue;
    }

    while (distanceSinceLastSampleM + remainingSegmentLengthM >= spacingM) {
      const distanceToNextSampleM = spacingM - distanceSinceLastSampleM;
      const ratio = distanceToNextSampleM / remainingSegmentLengthM;
      const sampledPoint = interpolatePoint(segmentStart, segmentEnd, ratio);

      if (!pointsEqual(resampledPoints[resampledPoints.length - 1], sampledPoint)) {
        resampledPoints.push(sampledPoint);
      }

      segmentStart = sampledPoint;
      remainingSegmentLengthM = haversineDistanceM(segmentStart, segmentEnd);
      distanceSinceLastSampleM = 0;
    }

    distanceSinceLastSampleM += remainingSegmentLengthM;

    if (anchorIndices.has(index) && !pointsEqual(resampledPoints[resampledPoints.length - 1], segmentEnd)) {
      resampledPoints.push(segmentEnd);
      distanceSinceLastSampleM = 0;
    }

    segmentStart = segmentEnd;
  }

  const lastPoint = points[points.length - 1];
  if (!pointsEqual(resampledPoints[resampledPoints.length - 1], lastPoint)) {
    resampledPoints.push(lastPoint);
  }

  return resampledPoints;
};

const pathLengthM = (points: FreehandLngLat[]) =>
  points.slice(1).reduce((total, point, index) => total + haversineDistanceM(points[index], point), 0);

const boundsDiagonalM = (points: FreehandLngLat[]) => {
  if (points.length === 0) {
    return 0;
  }

  let minLng = points[0][0];
  let maxLng = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];

  points.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  return haversineDistanceM([minLng, minLat], [maxLng, maxLat]);
};

const uniquePointCount = (points: FreehandLngLat[]) =>
  new Set(points.map((point) => point.join(','))).size;

const pointsEqual = (left: FreehandLngLat, right: FreehandLngLat) =>
  left[0] === right[0] && left[1] === right[1];

const ensureMinimumRingPoints = (points: FreehandLngLat[]) => {
  if (points.length >= 3 && uniquePointCount(points) >= 3) {
    return points;
  }

  if (points.length < 3) {
    return [];
  }

  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  const fallback = [first, middle, last].filter(
    (point, index, allPoints) =>
      allPoints.findIndex((candidate) => candidate[0] === point[0] && candidate[1] === point[1]) ===
      index
  );

  return fallback.length >= 3 ? fallback : [];
};

const normalizeAngleDeg = (value: number) => {
  let normalized = value % 360;

  if (normalized > 180) {
    normalized -= 360;
  }

  if (normalized < -180) {
    normalized += 360;
  }

  return normalized;
};

const toLocalMeters = (from: FreehandLngLat, to: FreehandLngLat) => {
  const fromLng = toRadians(from[0]);
  const fromLat = toRadians(from[1]);
  const toLng = toRadians(to[0]);
  const toLat = toRadians(to[1]);
  const averageLat = (fromLat + toLat) / 2;

  return {
    x: EARTH_RADIUS_M * (toLng - fromLng) * Math.cos(averageLat),
    y: EARTH_RADIUS_M * (toLat - fromLat)
  };
};

const getHeadingDeg = (from: FreehandLngLat, to: FreehandLngLat) => {
  const vector = toLocalMeters(from, to);
  return toDegrees(Math.atan2(vector.y, vector.x));
};

const getSignedTurnAngleDeg = (
  previousPoint: FreehandLngLat,
  currentPoint: FreehandLngLat,
  nextPoint: FreehandLngLat
) => normalizeAngleDeg(getHeadingDeg(currentPoint, nextPoint) - getHeadingDeg(previousPoint, currentPoint));

const getPerpendicularDeviationM = (
  lineStart: FreehandLngLat,
  lineEnd: FreehandLngLat,
  point: FreehandLngLat
) => {
  const lineVector = toLocalMeters(lineStart, lineEnd);
  const pointVector = toLocalMeters(lineStart, point);
  const lineLengthSquared = lineVector.x ** 2 + lineVector.y ** 2;

  if (lineLengthSquared === 0) {
    return Math.hypot(pointVector.x, pointVector.y);
  }

  const projectionRatio = Math.max(
    0,
    Math.min(1, (pointVector.x * lineVector.x + pointVector.y * lineVector.y) / lineLengthSquared)
  );
  const projectedX = lineVector.x * projectionRatio;
  const projectedY = lineVector.y * projectionRatio;

  return Math.hypot(pointVector.x - projectedX, pointVector.y - projectedY);
};

const getResampleAnchorIndices = (points: FreehandLngLat[]) => {
  const anchorIndices = new Set<number>([0, points.length - 1]);

  for (let index = 1; index < points.length - 1; index += 1) {
    const signedTurn = getSignedTurnAngleDeg(points[index - 1], points[index], points[index + 1]);

    if (Math.abs(signedTurn) >= RESAMPLE_CORNER_THRESHOLD_DEG) {
      anchorIndices.add(index);
    }
  }

  return anchorIndices;
};

const trimLoopClosureOverlap = (points: FreehandLngLat[]) => {
  if (
    points.length < 4 ||
    uniquePointCount(points) < 3 ||
    pathLengthM(points) < LOOP_CLOSURE_MIN_PATH_LENGTH_M
  ) {
    return points;
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (haversineDistanceM(firstPoint, lastPoint) > LOOP_CLOSURE_DISTANCE_M) {
    return points;
  }

  const tailStartIndex = Math.max(1, points.length - LOOP_CLOSURE_TAIL_POINT_COUNT);
  const firstTailOverlapIndex = points.findIndex(
    (point, index) =>
      index >= tailStartIndex && haversineDistanceM(firstPoint, point) <= LOOP_CLOSURE_DISTANCE_M
  );

  if (firstTailOverlapIndex === -1) {
    return points;
  }

  const trimmedPoints = points.slice(0, firstTailOverlapIndex);
  return trimmedPoints.length >= 3 ? trimmedPoints : points;
};

const simplifyByDeviation = (points: FreehandLngLat[], epsilonM: number) => {
  if (points.length <= 2) {
    return points;
  }

  const keptIndices = new Set<number>([0, points.length - 1]);

  const visitRange = (startIndex: number, endIndex: number) => {
    if (endIndex - startIndex <= 1) {
      return;
    }

    let furthestIndex = -1;
    let furthestDeviationM = 0;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const deviationM = getPerpendicularDeviationM(points[startIndex], points[endIndex], points[index]);
      if (deviationM > furthestDeviationM) {
        furthestDeviationM = deviationM;
        furthestIndex = index;
      }
    }

    if (furthestIndex === -1 || furthestDeviationM <= epsilonM) {
      return;
    }

    keptIndices.add(furthestIndex);
    visitRange(startIndex, furthestIndex);
    visitRange(furthestIndex, endIndex);
  };

  visitRange(0, points.length - 1);

  return [...keptIndices]
    .sort((left, right) => left - right)
    .map((index) => points[index]);
};

export const finalizeFreehandStroke = (
  strokePoints: FreehandLngLat[],
  options?: FinalizeFreehandStrokeOptions
): FinalizedFreehandStroke | null => {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const rawStrokePoints = dedupeByDistance(clonePoints(strokePoints), settings.rawPointMinDistanceM);
  if (rawStrokePoints.length < 3 || uniquePointCount(rawStrokePoints) < 3) {
    return null;
  }

  if (pathLengthM(rawStrokePoints) < settings.minPathLengthM) {
    return null;
  }

  if (boundsDiagonalM(rawStrokePoints) < settings.minBoundsDiagonalM) {
    return null;
  }

  const analysisStrokePoints = trimLoopClosureOverlap(rawStrokePoints);
  const analysisPoints = resampleByDistance(
    analysisStrokePoints,
    settings.ringPointMinDistanceM,
    getResampleAnchorIndices(analysisStrokePoints)
  );
  let ringPoints = simplifyByDeviation(analysisPoints, SIMPLIFICATION_EPSILON_M);

  if (
    ringPoints.length >= 4 &&
    haversineDistanceM(ringPoints[0], ringPoints[ringPoints.length - 1]) <=
      settings.closingPointDistanceM
  ) {
    ringPoints = ringPoints.slice(0, -1);
  }

  ringPoints = ensureMinimumRingPoints(ringPoints);

  if (ringPoints.length < 3 || uniquePointCount(ringPoints) < 3) {
    return null;
  }

  return {
    rawStrokePoints,
    ringPoints
  };
};
