import {
  HOME_HERO_MOWER_FADE_IN_DURATION_MS,
  HOME_HERO_MOWER_REVEAL_LAG_MS,
  HOME_HERO_MOWER_TRACK_SEGMENTS,
  HOME_HERO_MOWER_TRAVEL_DURATION_MS,
  type HeroMowerTrackArcSegment,
  type HeroPoint
} from './homeHeroLawn';

export type HeroAnimationPhase = 'learning' | 'generatingPath' | 'mowing' | 'reset';
export type HeroCoverageTurnSide = 'left' | 'right';

export interface HeroCoverageScanline {
  index: number;
  y: number;
  left: HeroPoint;
  right: HeroPoint;
  direction: 'leftToRight' | 'rightToLeft';
  start: HeroPoint;
  end: HeroPoint;
  length: number;
}

export interface HeroCoveragePathSegment {
  index: number;
  kind: 'scanline' | 'turn';
  pathType: 'line' | 'cubic';
  start: HeroPoint;
  end: HeroPoint;
  length: number;
  scanlineIndex?: number;
  turnSide?: HeroCoverageTurnSide;
  control1?: HeroPoint;
  control2?: HeroPoint;
}

export interface HeroCoveragePathProgressSegment {
  index: number;
  kind: HeroCoveragePathSegment['kind'];
  length: number;
  startLength: number;
  endLength: number;
  startProgress: number;
  endProgress: number;
}

export interface HeroCoverageArrowAnchor {
  index: number;
  variant: 'scanline' | 'turn';
  point: HeroPoint;
  tangentDegrees: number;
  distance: number;
  progress: number;
  scale: number;
  segmentIndex: number;
}

export interface HeroCoveragePathState {
  point: HeroPoint;
  tangentDegrees: number;
  segmentIndex: number;
  overallProgress: number;
}

export interface HeroAnimationPhaseTiming {
  phase: HeroAnimationPhase;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface HeroAnimationPhaseState {
  phase: HeroAnimationPhase;
  elapsedMs: number;
  phaseElapsedMs: number;
  phaseProgress: number;
}

interface HeroCoverageSample {
  t: number;
  length: number;
}

interface HeroCoverageSamplingSegment extends HeroCoveragePathSegment {
  sampleTable?: readonly HeroCoverageSample[];
}

const EPSILON = 0.001;
const CUBIC_SAMPLE_STEPS = 48;
const COVERAGE_EDGE_OFFSET = 14;
const COVERAGE_HANDLE_OFFSET = 6.5;

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lineLength = (start: HeroPoint, end: HeroPoint) =>
  Math.hypot(end.x - start.x, end.y - start.y);

const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;
const lerpPoint = (start: HeroPoint, end: HeroPoint, progress: number): HeroPoint => ({
  x: lerp(start.x, end.x, progress),
  y: lerp(start.y, end.y, progress)
});

const normalizeAngle = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const isAngleWithinArc = (angle: number, segment: HeroMowerTrackArcSegment) => {
  const normalizedAngle = normalizeAngle(angle);
  const rawMin = Math.min(segment.startAngle, segment.endAngle);
  const rawMax = Math.max(segment.startAngle, segment.endAngle);

  return [normalizedAngle, normalizedAngle + 360].some(
    (candidate) => candidate >= rawMin - EPSILON && candidate <= rawMax + EPSILON
  );
};

const getTrackHorizontalIntersections = (y: number) => {
  const intersections: number[] = [];

  HOME_HERO_MOWER_TRACK_SEGMENTS.forEach((segment) => {
    if (segment.type === 'line') {
      if (Math.abs(segment.start.y - segment.end.y) < EPSILON) {
        return;
      }

      const minY = Math.min(segment.start.y, segment.end.y);
      const maxY = Math.max(segment.start.y, segment.end.y);

      if (y < minY - EPSILON || y > maxY + EPSILON) {
        return;
      }

      const ratio = (y - segment.start.y) / (segment.end.y - segment.start.y);
      const x = segment.start.x + (segment.end.x - segment.start.x) * ratio;
      intersections.push(round(x));
      return;
    }

    const dy = y - segment.center.y;

    if (Math.abs(dy) > segment.radius + EPSILON) {
      return;
    }

    const deltaX = Math.sqrt(Math.max(0, segment.radius * segment.radius - dy * dy));

    [segment.center.x - deltaX, segment.center.x + deltaX].forEach((candidateX) => {
      const angle = (Math.atan2(y - segment.center.y, candidateX - segment.center.x) * 180) / Math.PI;

      if (isAngleWithinArc(angle, segment)) {
        intersections.push(round(candidateX));
      }
    });
  });

  return intersections
    .sort((first, second) => first - second)
    .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 0.08);
};

const cubicBezierPoint = (
  start: HeroPoint,
  control1: HeroPoint,
  control2: HeroPoint,
  end: HeroPoint,
  t: number
): HeroPoint => {
  const inverse = 1 - t;

  return {
    x:
      inverse * inverse * inverse * start.x +
      3 * inverse * inverse * t * control1.x +
      3 * inverse * t * t * control2.x +
      t * t * t * end.x,
    y:
      inverse * inverse * inverse * start.y +
      3 * inverse * inverse * t * control1.y +
      3 * inverse * t * t * control2.y +
      t * t * t * end.y
  };
};

const cubicBezierDerivative = (
  start: HeroPoint,
  control1: HeroPoint,
  control2: HeroPoint,
  end: HeroPoint,
  t: number
) => {
  const inverse = 1 - t;

  return {
    x:
      3 * inverse * inverse * (control1.x - start.x) +
      6 * inverse * t * (control2.x - control1.x) +
      3 * t * t * (end.x - control2.x),
    y:
      3 * inverse * inverse * (control1.y - start.y) +
      6 * inverse * t * (control2.y - control1.y) +
      3 * t * t * (end.y - control2.y)
  };
};

const getTangentDegreesFromVector = (x: number, y: number) =>
  round((Math.atan2(y, x) * 180) / Math.PI);

const buildCubicSampleTable = (
  start: HeroPoint,
  control1: HeroPoint,
  control2: HeroPoint,
  end: HeroPoint
) => {
  const samples: HeroCoverageSample[] = [{ t: 0, length: 0 }];
  let previousPoint = start;
  let totalLength = 0;

  for (let step = 1; step <= CUBIC_SAMPLE_STEPS; step += 1) {
    const t = step / CUBIC_SAMPLE_STEPS;
    const point = cubicBezierPoint(start, control1, control2, end, t);
    totalLength += lineLength(previousPoint, point);
    samples.push({
      t,
      length: round(totalLength, 3)
    });
    previousPoint = point;
  }

  return samples;
};

const getCubicTAtDistance = (sampleTable: readonly HeroCoverageSample[], distance: number) => {
  if (distance <= 0) {
    return 0;
  }

  const lastSample = sampleTable[sampleTable.length - 1];

  if (distance >= lastSample.length) {
    return 1;
  }

  const foundIndex = sampleTable.findIndex((sample) => sample.length >= distance - EPSILON);
  const upperIndex = foundIndex >= 0 ? foundIndex : sampleTable.length - 1;
  const upperSample = sampleTable[upperIndex];
  const lowerSample = sampleTable[Math.max(upperIndex - 1, 0)];
  const span = upperSample.length - lowerSample.length;

  if (span <= EPSILON) {
    return upperSample.t;
  }

  return clamp(
    lowerSample.t + ((distance - lowerSample.length) / span) * (upperSample.t - lowerSample.t),
    0,
    1
  );
};

const getLineStateAtProgress = (segment: HeroCoveragePathSegment, progress: number) => {
  const point = lerpPoint(segment.start, segment.end, progress);
  const tangentDegrees = getTangentDegreesFromVector(
    segment.end.x - segment.start.x,
    segment.end.y - segment.start.y
  );

  return {
    point: {
      x: round(point.x),
      y: round(point.y)
    },
    tangentDegrees
  };
};

const getCubicControls = (segment: HeroCoverageSamplingSegment) => {
  if (!segment.control1 || !segment.control2) {
    throw new Error(`Missing cubic controls for coverage segment ${segment.index}.`);
  }

  return {
    control1: segment.control1,
    control2: segment.control2
  };
};

const getCubicStateAtProgress = (
  segment: HeroCoverageSamplingSegment,
  progress: number,
  explicitT?: number
) => {
  const { control1, control2 } = getCubicControls(segment);
  const t = explicitT ?? progress;
  const point = cubicBezierPoint(segment.start, control1, control2, segment.end, t);
  const derivative = cubicBezierDerivative(segment.start, control1, control2, segment.end, t);

  return {
    point: {
      x: round(point.x),
      y: round(point.y)
    },
    tangentDegrees: getTangentDegreesFromVector(derivative.x, derivative.y)
  };
};

const getSegmentStateAtDistance = (
  segment: HeroCoverageSamplingSegment,
  localDistance: number
) => {
  if (segment.pathType === 'line') {
    const progress = segment.length <= EPSILON ? 0 : clamp(localDistance / segment.length, 0, 1);
    return getLineStateAtProgress(segment, progress);
  }

  if (!segment.sampleTable) {
    throw new Error(`Missing cubic sample table for coverage segment ${segment.index}.`);
  }

  const sampleTable = segment.sampleTable;
  const boundedDistance = clamp(localDistance, 0, segment.length);
  const t = getCubicTAtDistance(sampleTable, boundedDistance);

  return getCubicStateAtProgress(segment, t, t);
};

const formatCoordinate = (value: number) =>
  Number.isInteger(value) ? value.toString() : Number(value.toFixed(2)).toString();

const toInsidePoint = (side: HeroCoverageTurnSide, boundaryX: number, y: number, offset: number) => ({
  x: round(boundaryX + (side === 'left' ? offset : -offset)),
  y
});

export const HOME_HERO_COVERAGE_PASS_COUNT = 11;
export const HOME_HERO_COVERAGE_ROW_SPACING = 18.55;
export const HOME_HERO_COVERAGE_SCANLINE_BOTTOM_Y = 342.75;
export const HOME_HERO_COVERAGE_SCANLINE_TOP_Y = 157.25;
export const HOME_HERO_COVERAGE_ARROW_TARGET_SPACING = 78;
export const HOME_HERO_COVERAGE_ARROW_EDGE_PADDING = 18;
export const HOME_HERO_GENERATING_PATH_DURATION_MS = 2000;
export const HOME_HERO_MOWING_DURATION_MS = 12000;
export const HOME_HERO_RESET_DURATION_MS = 1200;
export const HOME_HERO_LEARNING_DURATION_MS =
  HOME_HERO_MOWER_FADE_IN_DURATION_MS +
  HOME_HERO_MOWER_TRAVEL_DURATION_MS +
  HOME_HERO_MOWER_REVEAL_LAG_MS;

export const HOME_HERO_COVERAGE_SCANLINES: readonly HeroCoverageScanline[] = Array.from(
  { length: HOME_HERO_COVERAGE_PASS_COUNT },
  (_, index) => round(HOME_HERO_COVERAGE_SCANLINE_BOTTOM_Y - index * HOME_HERO_COVERAGE_ROW_SPACING)
).map((y, index) => {
  const intersections = getTrackHorizontalIntersections(y);

  if (intersections.length < 2) {
    throw new Error(`Expected two mower-track intersections for coverage scanline y=${y}.`);
  }

  const leftBoundary = { x: intersections[0], y };
  const rightBoundary = { x: intersections[intersections.length - 1], y };
  const direction = index % 2 === 0 ? 'rightToLeft' : 'leftToRight';
  const left = toInsidePoint('left', leftBoundary.x, y, COVERAGE_EDGE_OFFSET);
  const right = toInsidePoint('right', rightBoundary.x, y, COVERAGE_EDGE_OFFSET);
  const start = direction === 'rightToLeft' ? right : left;
  const end = direction === 'rightToLeft' ? left : right;

  return {
    index,
    y,
    left,
    right,
    direction,
    start,
    end,
    length: round(lineLength(start, end), 3)
  };
});

const coverageSegments: HeroCoverageSamplingSegment[] = [];

const pushLineSegment = (
  kind: HeroCoveragePathSegment['kind'],
  start: HeroPoint,
  end: HeroPoint,
  extras: Omit<HeroCoveragePathSegment, 'index' | 'kind' | 'pathType' | 'start' | 'end' | 'length'> = {}
) => {
  const length = round(lineLength(start, end), 3);

  if (length <= EPSILON) {
    return;
  }

  coverageSegments.push({
    index: coverageSegments.length,
    kind,
    pathType: 'line',
    start,
    end,
    length,
    ...extras
  });
};

const pushCubicSegment = (
  kind: HeroCoveragePathSegment['kind'],
  start: HeroPoint,
  control1: HeroPoint,
  control2: HeroPoint,
  end: HeroPoint,
  extras: Omit<
    HeroCoveragePathSegment,
    'index' | 'kind' | 'pathType' | 'start' | 'end' | 'length' | 'control1' | 'control2'
  > = {}
) => {
  const sampleTable = buildCubicSampleTable(start, control1, control2, end);
  const length = sampleTable[sampleTable.length - 1]?.length ?? 0;

  if (length <= EPSILON) {
    return;
  }

  coverageSegments.push({
    index: coverageSegments.length,
    kind,
    pathType: 'cubic',
    start,
    end,
    control1,
    control2,
    length,
    sampleTable,
    ...extras
  });
};

HOME_HERO_COVERAGE_SCANLINES.forEach((scanline, index) => {
  pushLineSegment('scanline', scanline.start, scanline.end, {
    scanlineIndex: scanline.index
  });

  const nextScanline = HOME_HERO_COVERAGE_SCANLINES[index + 1];

  if (!nextScanline) {
    return;
  }

  const turnSide: HeroCoverageTurnSide =
    scanline.direction === 'rightToLeft' ? 'left' : 'right';
  const currentBoundary =
    turnSide === 'left' ? scanline.left.x - COVERAGE_EDGE_OFFSET : scanline.right.x + COVERAGE_EDGE_OFFSET;
  const nextBoundary =
    turnSide === 'left'
      ? nextScanline.left.x - COVERAGE_EDGE_OFFSET
      : nextScanline.right.x + COVERAGE_EDGE_OFFSET;
  const control1 = toInsidePoint(turnSide, currentBoundary, scanline.y, COVERAGE_HANDLE_OFFSET);
  const control2 = toInsidePoint(turnSide, nextBoundary, nextScanline.y, COVERAGE_HANDLE_OFFSET);

  pushCubicSegment('turn', scanline.end, control1, control2, nextScanline.start, {
    scanlineIndex: scanline.index,
    turnSide
  });
});

const exportedCoverageSegments = coverageSegments.map<HeroCoveragePathSegment>((segment) => ({
  index: segment.index,
  kind: segment.kind,
  pathType: segment.pathType,
  start: segment.start,
  end: segment.end,
  length: segment.length,
  scanlineIndex: segment.scanlineIndex,
  turnSide: segment.turnSide,
  control1: segment.control1,
  control2: segment.control2
}));

export const HOME_HERO_COVERAGE_PATH_SEGMENTS = exportedCoverageSegments as readonly HeroCoveragePathSegment[];

export const HOME_HERO_COVERAGE_PATH_POINTS = [
  coverageSegments[0]?.start ?? HOME_HERO_COVERAGE_SCANLINES[0].start,
  ...coverageSegments.map((segment) => segment.end)
] as readonly HeroPoint[];

export const HOME_HERO_COVERAGE_PATH_D = coverageSegments.reduce((path, segment, index) => {
  const prefix =
    index === 0
      ? `M ${formatCoordinate(segment.start.x)} ${formatCoordinate(segment.start.y)}`
      : path;

  if (segment.pathType === 'line') {
    return `${prefix} L ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
  }

  const { control1, control2 } = getCubicControls(segment);

  return `${prefix} C ${formatCoordinate(control1.x)} ${formatCoordinate(control1.y)} ${formatCoordinate(control2.x)} ${formatCoordinate(control2.y)} ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
}, '');

const coveragePathTotalLength = coverageSegments.reduce((total, segment) => total + segment.length, 0);
export const HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH = round(coveragePathTotalLength, 3);

export const HOME_HERO_COVERAGE_PATH_PROGRESS: readonly HeroCoveragePathProgressSegment[] =
  coverageSegments.map((segment, index) => {
    const startLength = coverageSegments
      .slice(0, index)
      .reduce((total, item) => total + item.length, 0);
    const endLength = startLength + segment.length;

    return {
      index,
      kind: segment.kind,
      length: round(segment.length, 3),
      startLength: round(startLength, 3),
      endLength: round(endLength, 3),
      startProgress: round(startLength / coveragePathTotalLength, 6),
      endProgress: round(endLength / coveragePathTotalLength, 6)
    };
  });

export const getHeroCoveragePathStateAtDistance = (distance: number): HeroCoveragePathState => {
  const boundedDistance = clamp(distance, 0, HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH);
  const progressSegment =
    HOME_HERO_COVERAGE_PATH_PROGRESS.find((segment) => boundedDistance <= segment.endLength + EPSILON) ??
    HOME_HERO_COVERAGE_PATH_PROGRESS[HOME_HERO_COVERAGE_PATH_PROGRESS.length - 1];
  const pathSegment = coverageSegments[progressSegment.index];
  const localDistance = boundedDistance - progressSegment.startLength;
  const state = getSegmentStateAtDistance(pathSegment, localDistance);

  return {
    point: state.point,
    tangentDegrees: state.tangentDegrees,
    segmentIndex: progressSegment.index,
    overallProgress: round(boundedDistance / HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH, 6)
  };
};

export const HOME_HERO_COVERAGE_INITIAL_STATE = getHeroCoveragePathStateAtDistance(0);

const createHeroCoverageArrowAnchor = ({
  segment,
  localDistance,
  variant,
  scale
}: {
  segment: HeroCoverageSamplingSegment;
  localDistance: number;
  variant: HeroCoverageArrowAnchor['variant'];
  scale: number;
}): Omit<HeroCoverageArrowAnchor, 'index'> => {
  const progressSegment = HOME_HERO_COVERAGE_PATH_PROGRESS[segment.index];
  const state = getSegmentStateAtDistance(segment, localDistance);
  const absoluteDistance = progressSegment.startLength + localDistance;

  return {
    variant,
    point: state.point,
    tangentDegrees: state.tangentDegrees,
    distance: round(absoluteDistance, 3),
    progress: round(absoluteDistance / HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH, 6),
    scale,
    segmentIndex: segment.index
  };
};

const scanlineArrowAnchors = coverageSegments.flatMap((segment) => {
  if (segment.kind !== 'scanline') {
    return [];
  }

  const usableLength = Math.max(segment.length - HOME_HERO_COVERAGE_ARROW_EDGE_PADDING * 2, 0);
  const arrowCount = usableLength <= EPSILON
    ? 1
    : Math.max(1, Math.floor(usableLength / HOME_HERO_COVERAGE_ARROW_TARGET_SPACING));
  const arrowGap = usableLength <= EPSILON ? 0 : usableLength / (arrowCount + 1);

  return Array.from({ length: arrowCount }, (_, arrowIndex) => {
    const localDistance =
      usableLength <= EPSILON
        ? segment.length / 2
        : HOME_HERO_COVERAGE_ARROW_EDGE_PADDING + arrowGap * (arrowIndex + 1);

    return createHeroCoverageArrowAnchor({
      segment,
      localDistance,
      variant: 'scanline',
      scale: 1.2
    });
  });
});

const turnArrowAnchors = coverageSegments.flatMap((segment) => {
  if (segment.kind !== 'turn') {
    return [];
  }

  return [
    createHeroCoverageArrowAnchor({
      segment,
      localDistance: segment.length / 2,
      variant: 'turn',
      scale: 0.94
    })
  ];
});

export const HOME_HERO_COVERAGE_ARROW_ANCHORS: readonly HeroCoverageArrowAnchor[] = [
  ...scanlineArrowAnchors,
  ...turnArrowAnchors
]
  .sort((first, second) => first.distance - second.distance)
  .map((anchor, index) => ({
    index,
    ...anchor
  }));

export const HOME_HERO_PHASE_TIMINGS: readonly HeroAnimationPhaseTiming[] = [
  {
    phase: 'learning',
    startMs: 0,
    endMs: HOME_HERO_LEARNING_DURATION_MS,
    durationMs: HOME_HERO_LEARNING_DURATION_MS
  },
  {
    phase: 'generatingPath',
    startMs: HOME_HERO_LEARNING_DURATION_MS,
    endMs: HOME_HERO_LEARNING_DURATION_MS + HOME_HERO_GENERATING_PATH_DURATION_MS,
    durationMs: HOME_HERO_GENERATING_PATH_DURATION_MS
  },
  {
    phase: 'mowing',
    startMs: HOME_HERO_LEARNING_DURATION_MS + HOME_HERO_GENERATING_PATH_DURATION_MS,
    endMs:
      HOME_HERO_LEARNING_DURATION_MS +
      HOME_HERO_GENERATING_PATH_DURATION_MS +
      HOME_HERO_MOWING_DURATION_MS,
    durationMs: HOME_HERO_MOWING_DURATION_MS
  },
  {
    phase: 'reset',
    startMs:
      HOME_HERO_LEARNING_DURATION_MS +
      HOME_HERO_GENERATING_PATH_DURATION_MS +
      HOME_HERO_MOWING_DURATION_MS,
    endMs:
      HOME_HERO_LEARNING_DURATION_MS +
      HOME_HERO_GENERATING_PATH_DURATION_MS +
      HOME_HERO_MOWING_DURATION_MS +
      HOME_HERO_RESET_DURATION_MS,
    durationMs: HOME_HERO_RESET_DURATION_MS
  }
] as const;

export const HOME_HERO_TOTAL_CYCLE_DURATION_MS =
  HOME_HERO_LEARNING_DURATION_MS +
  HOME_HERO_GENERATING_PATH_DURATION_MS +
  HOME_HERO_MOWING_DURATION_MS +
  HOME_HERO_RESET_DURATION_MS;

export const HOME_HERO_PHASE_ORDER = [
  'learning',
  'generatingPath',
  'mowing',
  'reset',
  'learning'
] as const satisfies readonly HeroAnimationPhase[];

export const getHeroAnimationPhaseAtElapsedMs = (elapsedMs: number): HeroAnimationPhaseState => {
  const loopElapsed = ((elapsedMs % HOME_HERO_TOTAL_CYCLE_DURATION_MS) + HOME_HERO_TOTAL_CYCLE_DURATION_MS) %
    HOME_HERO_TOTAL_CYCLE_DURATION_MS;
  const timing =
    HOME_HERO_PHASE_TIMINGS.find((item) => loopElapsed < item.endMs - EPSILON) ??
    HOME_HERO_PHASE_TIMINGS[HOME_HERO_PHASE_TIMINGS.length - 1];
  const phaseElapsedMs = loopElapsed - timing.startMs;

  return {
    phase: timing.phase,
    elapsedMs: round(loopElapsed, 3),
    phaseElapsedMs: round(phaseElapsedMs, 3),
    phaseProgress: round(clamp(phaseElapsedMs / timing.durationMs, 0, 1), 6)
  };
};
