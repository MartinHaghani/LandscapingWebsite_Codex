export interface HeroPoint {
  x: number;
  y: number;
}

type HeroLineSegmentId = 'topStraight' | 'rightStraight' | 'bottomStraight' | 'leftStraight';
type HeroArcSegmentId = 'upperRightArc' | 'lowerRightArc' | 'lowerLeftArc' | 'upperLeftArc';

interface HeroLineSegment {
  type: 'line';
  id: HeroLineSegmentId;
  start: HeroPoint;
  end: HeroPoint;
}

interface HeroArcSegment {
  type: 'arc';
  id: HeroArcSegmentId;
  center: HeroPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  start: HeroPoint;
  end: HeroPoint;
}

export type HeroPerimeterSegment = HeroLineSegment | HeroArcSegment;
export type HeroSegmentId = HeroPerimeterSegment['id'];

export interface HeroLinearAnnotation {
  type: 'linear';
  id: HeroLineSegment['id'];
  label: string;
  segment: HeroLineSegment;
  extensionLines: readonly [
    { start: HeroPoint; end: HeroPoint },
    { start: HeroPoint; end: HeroPoint }
  ];
  dimensionLine: {
    start: HeroPoint;
    end: HeroPoint;
  };
  labelPosition: HeroPoint;
  textAnchor: 'start' | 'middle' | 'end';
}

export interface HeroRadiusAnnotation {
  type: 'radius';
  id: HeroArcSegment['id'];
  label: string;
  segment: HeroArcSegment;
  leader: readonly [HeroPoint, HeroPoint];
  labelPosition: HeroPoint;
  textAnchor: 'start' | 'end';
}

export type HeroMeasurementAnnotation = HeroLinearAnnotation | HeroRadiusAnnotation;

export interface HeroLawnDefinition {
  id: 'curatedCadParcelLawn';
  name: 'Curated CAD Parcel';
  viewBox: '0 0 640 480';
  scaleMetersPerUnit: number;
  silhouettePath: string;
  segments: readonly HeroPerimeterSegment[];
  annotations: readonly HeroMeasurementAnnotation[];
}

export interface HeroMowerTrackLineSegment {
  type: 'line';
  id: HeroSegmentId;
  start: HeroPoint;
  end: HeroPoint;
  length: number;
}

export interface HeroMowerTrackArcSegment {
  type: 'arc';
  id: HeroSegmentId;
  center: HeroPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  start: HeroPoint;
  end: HeroPoint;
  length: number;
  sweepFlag: 0 | 1;
}

export type HeroMowerTrackSegment = HeroMowerTrackLineSegment | HeroMowerTrackArcSegment;

export interface HeroMowerTrackProgressSegment {
  id: HeroSegmentId;
  index: number;
  length: number;
  startLength: number;
  endLength: number;
  startProgress: number;
  endProgress: number;
}

export interface HeroMeasurementReveal {
  id: HeroSegmentId;
  segmentEndMs: number;
  revealAtMs: number;
  completionProgress: number;
}

export interface HeroMowerTrackState {
  point: HeroPoint;
  tangentDegrees: number;
  segmentId: HeroSegmentId;
  segmentProgress: number;
  overallProgress: number;
}

const VIEWBOX = '0 0 640 480' as const;
const SCALE_METERS_PER_UNIT = 0.03048;

export const HOME_HERO_MOWER_ASSET_PATH = '/images/home/hero-lawnmower.png';
export const HOME_HERO_MOWER_TRACK_INSET = 18;
export const HOME_HERO_MOWER_HEADING_OFFSET_DEGREES = -90;
export const HOME_HERO_MOWER_FADE_IN_DURATION_MS = 1400;
export const HOME_HERO_MOWER_TRAVEL_DURATION_MS = 12600;
export const HOME_HERO_MOWER_REVEAL_LAG_MS = 180;

const point = (x: number, y: number): HeroPoint => ({ x, y });

const formatCoordinate = (value: number) =>
  Number.isInteger(value) ? value.toString() : Number(value.toFixed(1)).toString();

const degreesToRadians = (value: number) => (value * Math.PI) / 180;
const radiansToDegrees = (value: number) => (value * 180) / Math.PI;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pointOnArc = (center: HeroPoint, radius: number, angle: number): HeroPoint => ({
  x: Number((center.x + radius * Math.cos(degreesToRadians(angle))).toFixed(1)),
  y: Number((center.y + radius * Math.sin(degreesToRadians(angle))).toFixed(1))
});

const lineLength = (start: HeroPoint, end: HeroPoint) => Math.hypot(end.x - start.x, end.y - start.y);

const lineLengthUnits = (segment: HeroLineSegment) => lineLength(segment.start, segment.end);

const arcLength = (radius: number, startAngle: number, endAngle: number) =>
  Math.abs(endAngle - startAngle) * (Math.PI / 180) * radius;

const toMetersLabel = (valueInUnits: number) =>
  `${(valueInUnits * SCALE_METERS_PER_UNIT).toFixed(2)} m`;

const toRadiusLabel = (valueInUnits: number) =>
  `R ${(valueInUnits * SCALE_METERS_PER_UNIT).toFixed(2)} m`;

const topStraight: HeroLineSegment = {
  type: 'line',
  id: 'topStraight',
  start: point(140, 130),
  end: point(420, 130)
};

const upperRightArc: HeroArcSegment = {
  type: 'arc',
  id: 'upperRightArc',
  center: point(420, 190),
  radius: 60,
  startAngle: 270,
  endAngle: 360,
  start: point(420, 130),
  end: point(480, 190)
};

const rightStraight: HeroLineSegment = {
  type: 'line',
  id: 'rightStraight',
  start: point(480, 190),
  end: point(480, 300)
};

const lowerRightArc: HeroArcSegment = {
  type: 'arc',
  id: 'lowerRightArc',
  center: point(410, 300),
  radius: 70,
  startAngle: 0,
  endAngle: 90,
  start: point(480, 300),
  end: point(410, 370)
};

const bottomStraight: HeroLineSegment = {
  type: 'line',
  id: 'bottomStraight',
  start: point(410, 370),
  end: point(200, 370)
};

const lowerLeftArc: HeroArcSegment = {
  type: 'arc',
  id: 'lowerLeftArc',
  center: point(200, 270),
  radius: 100,
  startAngle: 90,
  endAngle: 180,
  start: point(200, 370),
  end: point(100, 270)
};

const leftStraight: HeroLineSegment = {
  type: 'line',
  id: 'leftStraight',
  start: point(100, 270),
  end: point(100, 170)
};

const upperLeftArc: HeroArcSegment = {
  type: 'arc',
  id: 'upperLeftArc',
  center: point(140, 170),
  radius: 40,
  startAngle: 180,
  endAngle: 270,
  start: point(100, 170),
  end: point(140, 130)
};

const heroSegments = [
  topStraight,
  upperRightArc,
  rightStraight,
  lowerRightArc,
  bottomStraight,
  lowerLeftArc,
  leftStraight,
  upperLeftArc
] as const satisfies readonly HeroPerimeterSegment[];

const buildSilhouettePath = (segments: readonly HeroPerimeterSegment[]) => {
  const [firstSegment] = segments;

  let path = `M ${formatCoordinate(firstSegment.start.x)} ${formatCoordinate(firstSegment.start.y)}`;

  for (const segment of segments) {
    if (segment.type === 'line') {
      path += ` L ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
    } else {
      path += ` A ${formatCoordinate(segment.radius)} ${formatCoordinate(segment.radius)} 0 0 1 ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
    }
  }
  path += ' Z';

  return path;
};

const buildTrackPath = (segments: readonly HeroMowerTrackSegment[]) => {
  const [firstSegment] = segments;

  let path = `M ${formatCoordinate(firstSegment.start.x)} ${formatCoordinate(firstSegment.start.y)}`;

  for (const segment of segments) {
    if (segment.type === 'line') {
      path += ` L ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
    } else {
      path += ` A ${formatCoordinate(segment.radius)} ${formatCoordinate(segment.radius)} 0 0 ${segment.sweepFlag} ${formatCoordinate(segment.end.x)} ${formatCoordinate(segment.end.y)}`;
    }
  }

  return path;
};

const silhouettePath = [
  'M 140 130',
  'L 420 130',
  'A 60 60 0 0 1 480 190',
  'L 480 300',
  'A 70 70 0 0 1 410 370',
  'L 200 370',
  'A 100 100 0 0 1 100 270',
  'L 100 170',
  'A 40 40 0 0 1 140 130',
  'Z'
].join(' ');

const upperRightMidpoint = pointOnArc(upperRightArc.center, upperRightArc.radius, 315);
const lowerRightMidpoint = pointOnArc(lowerRightArc.center, lowerRightArc.radius, 45);
const lowerLeftMidpoint = pointOnArc(lowerLeftArc.center, lowerLeftArc.radius, 135);
const upperLeftMidpoint = pointOnArc(upperLeftArc.center, upperLeftArc.radius, 225);

const heroAnnotations: readonly HeroMeasurementAnnotation[] = [
  {
    type: 'linear',
    id: 'topStraight',
    label: toMetersLabel(lineLengthUnits(topStraight)),
    segment: topStraight,
    extensionLines: [
      { start: point(140, 130), end: point(140, 122) },
      { start: point(420, 130), end: point(420, 122) }
    ],
    dimensionLine: {
      start: point(140, 122),
      end: point(420, 122)
    },
    labelPosition: point(280, 112),
    textAnchor: 'middle'
  },
  {
    type: 'radius',
    id: 'upperRightArc',
    label: toRadiusLabel(upperRightArc.radius),
    segment: upperRightArc,
    leader: [upperRightMidpoint, point(491, 132)],
    labelPosition: point(499, 128),
    textAnchor: 'start'
  },
  {
    type: 'linear',
    id: 'rightStraight',
    label: toMetersLabel(lineLengthUnits(rightStraight)),
    segment: rightStraight,
    extensionLines: [
      { start: point(480, 190), end: point(488, 190) },
      { start: point(480, 300), end: point(488, 300) }
    ],
    dimensionLine: {
      start: point(488, 190),
      end: point(488, 300)
    },
    labelPosition: point(500, 245),
    textAnchor: 'start'
  },
  {
    type: 'radius',
    id: 'lowerRightArc',
    label: toRadiusLabel(lowerRightArc.radius),
    segment: lowerRightArc,
    leader: [lowerRightMidpoint, point(490, 364)],
    labelPosition: point(498, 368),
    textAnchor: 'start'
  },
  {
    type: 'linear',
    id: 'bottomStraight',
    label: toMetersLabel(lineLengthUnits(bottomStraight)),
    segment: bottomStraight,
    extensionLines: [
      { start: point(410, 370), end: point(410, 378) },
      { start: point(200, 370), end: point(200, 378) }
    ],
    dimensionLine: {
      start: point(200, 378),
      end: point(410, 378)
    },
    labelPosition: point(305, 388),
    textAnchor: 'middle'
  },
  {
    type: 'radius',
    id: 'lowerLeftArc',
    label: toRadiusLabel(lowerLeftArc.radius),
    segment: lowerLeftArc,
    leader: [lowerLeftMidpoint, point(105, 360)],
    labelPosition: point(97, 364),
    textAnchor: 'end'
  },
  {
    type: 'linear',
    id: 'leftStraight',
    label: toMetersLabel(lineLengthUnits(leftStraight)),
    segment: leftStraight,
    extensionLines: [
      { start: point(100, 270), end: point(92, 270) },
      { start: point(100, 170), end: point(92, 170) }
    ],
    dimensionLine: {
      start: point(92, 170),
      end: point(92, 270)
    },
    labelPosition: point(80, 220),
    textAnchor: 'end'
  },
  {
    type: 'radius',
    id: 'upperLeftArc',
    label: toRadiusLabel(upperLeftArc.radius),
    segment: upperLeftArc,
    leader: [upperLeftMidpoint, point(96, 126)],
    labelPosition: point(88, 122),
    textAnchor: 'end'
  }
] as const;

export const HOME_HERO_LAWN: HeroLawnDefinition = {
  id: 'curatedCadParcelLawn',
  name: 'Curated CAD Parcel',
  viewBox: VIEWBOX,
  scaleMetersPerUnit: SCALE_METERS_PER_UNIT,
  silhouettePath,
  segments: heroSegments,
  annotations: heroAnnotations
};

export const HOME_HERO_SILHOUETTE_PATH = buildSilhouettePath(heroSegments);

export const HOME_HERO_COUNTER_CLOCKWISE_SEGMENT_IDS = [
  'upperLeftArc',
  'leftStraight',
  'lowerLeftArc',
  'bottomStraight',
  'lowerRightArc',
  'rightStraight',
  'upperRightArc',
  'topStraight'
] as const satisfies readonly HeroSegmentId[];

const mowerTrackSegments: readonly HeroMowerTrackSegment[] = [
  {
    type: 'arc',
    id: 'upperLeftArc',
    center: upperLeftArc.center,
    radius: upperLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET,
    startAngle: 270,
    endAngle: 180,
    start: pointOnArc(upperLeftArc.center, upperLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 270),
    end: pointOnArc(upperLeftArc.center, upperLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 180),
    length: arcLength(upperLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 270, 180),
    sweepFlag: 0
  },
  {
    type: 'line',
    id: 'leftStraight',
    start: point(leftStraight.start.x + HOME_HERO_MOWER_TRACK_INSET, leftStraight.end.y),
    end: point(leftStraight.end.x + HOME_HERO_MOWER_TRACK_INSET, leftStraight.start.y),
    length: lineLength(
      point(leftStraight.start.x + HOME_HERO_MOWER_TRACK_INSET, leftStraight.end.y),
      point(leftStraight.end.x + HOME_HERO_MOWER_TRACK_INSET, leftStraight.start.y)
    )
  },
  {
    type: 'arc',
    id: 'lowerLeftArc',
    center: lowerLeftArc.center,
    radius: lowerLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET,
    startAngle: 180,
    endAngle: 90,
    start: pointOnArc(lowerLeftArc.center, lowerLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 180),
    end: pointOnArc(lowerLeftArc.center, lowerLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 90),
    length: arcLength(lowerLeftArc.radius - HOME_HERO_MOWER_TRACK_INSET, 180, 90),
    sweepFlag: 0
  },
  {
    type: 'line',
    id: 'bottomStraight',
    start: point(bottomStraight.end.x, bottomStraight.end.y - HOME_HERO_MOWER_TRACK_INSET),
    end: point(bottomStraight.start.x, bottomStraight.start.y - HOME_HERO_MOWER_TRACK_INSET),
    length: lineLength(
      point(bottomStraight.end.x, bottomStraight.end.y - HOME_HERO_MOWER_TRACK_INSET),
      point(bottomStraight.start.x, bottomStraight.start.y - HOME_HERO_MOWER_TRACK_INSET)
    )
  },
  {
    type: 'arc',
    id: 'lowerRightArc',
    center: lowerRightArc.center,
    radius: lowerRightArc.radius - HOME_HERO_MOWER_TRACK_INSET,
    startAngle: 90,
    endAngle: 0,
    start: pointOnArc(lowerRightArc.center, lowerRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 90),
    end: pointOnArc(lowerRightArc.center, lowerRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 0),
    length: arcLength(lowerRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 90, 0),
    sweepFlag: 0
  },
  {
    type: 'line',
    id: 'rightStraight',
    start: point(rightStraight.end.x - HOME_HERO_MOWER_TRACK_INSET, rightStraight.end.y),
    end: point(rightStraight.start.x - HOME_HERO_MOWER_TRACK_INSET, rightStraight.start.y),
    length: lineLength(
      point(rightStraight.end.x - HOME_HERO_MOWER_TRACK_INSET, rightStraight.end.y),
      point(rightStraight.start.x - HOME_HERO_MOWER_TRACK_INSET, rightStraight.start.y)
    )
  },
  {
    type: 'arc',
    id: 'upperRightArc',
    center: upperRightArc.center,
    radius: upperRightArc.radius - HOME_HERO_MOWER_TRACK_INSET,
    startAngle: 360,
    endAngle: 270,
    start: pointOnArc(upperRightArc.center, upperRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 360),
    end: pointOnArc(upperRightArc.center, upperRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 270),
    length: arcLength(upperRightArc.radius - HOME_HERO_MOWER_TRACK_INSET, 360, 270),
    sweepFlag: 0
  },
  {
    type: 'line',
    id: 'topStraight',
    start: point(topStraight.end.x, topStraight.end.y + HOME_HERO_MOWER_TRACK_INSET),
    end: point(topStraight.start.x, topStraight.start.y + HOME_HERO_MOWER_TRACK_INSET),
    length: lineLength(
      point(topStraight.end.x, topStraight.end.y + HOME_HERO_MOWER_TRACK_INSET),
      point(topStraight.start.x, topStraight.start.y + HOME_HERO_MOWER_TRACK_INSET)
    )
  }
];

export const HOME_HERO_MOWER_TRACK_SEGMENTS = mowerTrackSegments;
export const HOME_HERO_MOWER_TRACK_PATH = buildTrackPath(mowerTrackSegments);

const mowerTrackTotalLength = mowerTrackSegments.reduce((total, segment) => total + segment.length, 0);

export const HOME_HERO_MOWER_TRACK_TOTAL_LENGTH = Number(mowerTrackTotalLength.toFixed(3));

export const HOME_HERO_MOWER_TRACK_PROGRESS: readonly HeroMowerTrackProgressSegment[] = mowerTrackSegments.map(
  (segment, index) => {
    const startLength = mowerTrackSegments
      .slice(0, index)
      .reduce((total, item) => total + item.length, 0);
    const endLength = startLength + segment.length;

    return {
      id: segment.id,
      index,
      length: Number(segment.length.toFixed(3)),
      startLength: Number(startLength.toFixed(3)),
      endLength: Number(endLength.toFixed(3)),
      startProgress: Number((startLength / mowerTrackTotalLength).toFixed(6)),
      endProgress: Number((endLength / mowerTrackTotalLength).toFixed(6))
    };
  }
);

const bottomStraightTrackProgress = HOME_HERO_MOWER_TRACK_PROGRESS.find(
  (segment) => segment.id === 'bottomStraight'
);

if (!bottomStraightTrackProgress) {
  throw new Error('Missing bottomStraight hero mower track segment.');
}

export const HOME_HERO_MOWER_START_DISTANCE = Number(
  (bottomStraightTrackProgress.startLength + bottomStraightTrackProgress.length / 2).toFixed(3)
);

export const HOME_HERO_MOWER_START_PROGRESS = Number(
  (HOME_HERO_MOWER_START_DISTANCE / HOME_HERO_MOWER_TRACK_TOTAL_LENGTH).toFixed(6)
);

export const HOME_HERO_MOWER_START_SEGMENT_ID: HeroSegmentId = 'bottomStraight';

const getLoopCompletionProgress = (segment: HeroMowerTrackProgressSegment) => {
  const progress = (segment.endLength - HOME_HERO_MOWER_START_DISTANCE) / HOME_HERO_MOWER_TRACK_TOTAL_LENGTH;

  if (progress > 0) {
    return Number(progress.toFixed(6));
  }

  return Number((progress + 1).toFixed(6));
};

export const getHeroMeasurementRevealSchedule = (
  travelDurationMs = HOME_HERO_MOWER_TRAVEL_DURATION_MS,
  revealLagMs = HOME_HERO_MOWER_REVEAL_LAG_MS
): readonly HeroMeasurementReveal[] =>
  [...HOME_HERO_MOWER_TRACK_PROGRESS]
    .map((segment) => {
      const completionProgress = getLoopCompletionProgress(segment);

      return {
        id: segment.id,
        segmentEndMs: Math.round(completionProgress * travelDurationMs),
        revealAtMs: Math.round(completionProgress * travelDurationMs + revealLagMs),
        completionProgress
      };
    })
    .sort((first, second) => first.completionProgress - second.completionProgress);

export const HOME_HERO_MOWER_REVEAL_SCHEDULE = getHeroMeasurementRevealSchedule();

export const getHeroMowerTrackStateAtDistance = (distance: number): HeroMowerTrackState => {
  const boundedDistance = clamp(distance, 0, HOME_HERO_MOWER_TRACK_TOTAL_LENGTH);
  const progressSegment =
    HOME_HERO_MOWER_TRACK_PROGRESS.find((segment) => boundedDistance <= segment.endLength) ??
    HOME_HERO_MOWER_TRACK_PROGRESS[HOME_HERO_MOWER_TRACK_PROGRESS.length - 1];
  const segment = HOME_HERO_MOWER_TRACK_SEGMENTS[progressSegment.index];
  const localDistance = boundedDistance - progressSegment.startLength;
  const segmentProgress =
    progressSegment.length === 0 ? 0 : clamp(localDistance / progressSegment.length, 0, 1);

  if (segment.type === 'line') {
    const x = segment.start.x + (segment.end.x - segment.start.x) * segmentProgress;
    const y = segment.start.y + (segment.end.y - segment.start.y) * segmentProgress;
    const tangentDegrees = radiansToDegrees(
      Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x)
    );

    return {
      point: { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) },
      tangentDegrees: Number(tangentDegrees.toFixed(2)),
      segmentId: segment.id,
      segmentProgress: Number(segmentProgress.toFixed(4)),
      overallProgress: Number((boundedDistance / HOME_HERO_MOWER_TRACK_TOTAL_LENGTH).toFixed(6))
    };
  }

  const angle = segment.startAngle + (segment.endAngle - segment.startAngle) * segmentProgress;
  const radians = degreesToRadians(angle);
  const deltaSign = Math.sign(segment.endAngle - segment.startAngle) || 1;
  const dx = -Math.sin(radians) * deltaSign;
  const dy = Math.cos(radians) * deltaSign;
  const tangentDegrees = radiansToDegrees(Math.atan2(dy, dx));

  return {
    point: pointOnArc(segment.center, segment.radius, angle),
    tangentDegrees: Number(tangentDegrees.toFixed(2)),
    segmentId: segment.id,
    segmentProgress: Number(segmentProgress.toFixed(4)),
    overallProgress: Number((boundedDistance / HOME_HERO_MOWER_TRACK_TOTAL_LENGTH).toFixed(6))
  };
};

export const getHeroMowerTrackStateAtTravelDistance = (travelDistance: number): HeroMowerTrackState => {
  const boundedDistance = clamp(travelDistance, 0, HOME_HERO_MOWER_TRACK_TOTAL_LENGTH);
  const absoluteDistance =
    boundedDistance >= HOME_HERO_MOWER_TRACK_TOTAL_LENGTH
      ? HOME_HERO_MOWER_START_DISTANCE
      : (HOME_HERO_MOWER_START_DISTANCE + boundedDistance) % HOME_HERO_MOWER_TRACK_TOTAL_LENGTH;

  return getHeroMowerTrackStateAtDistance(absoluteDistance);
};

export const HOME_HERO_MOWER_INITIAL_TRACK_STATE = getHeroMowerTrackStateAtTravelDistance(0);

export const getHeroLineMeasurementLabel = (segmentId: HeroLineSegment['id']) => {
  const segment = heroSegments.find(
    (item): item is HeroLineSegment => item.type === 'line' && item.id === segmentId
  );

  if (!segment) {
    throw new Error(`Unknown hero line segment "${segmentId}".`);
  }

  return toMetersLabel(lineLengthUnits(segment));
};

export const getHeroArcRadiusLabel = (segmentId: HeroArcSegment['id']) => {
  const segment = heroSegments.find(
    (item): item is HeroArcSegment => item.type === 'arc' && item.id === segmentId
  );

  if (!segment) {
    throw new Error(`Unknown hero arc segment "${segmentId}".`);
  }

  return toRadiusLabel(segment.radius);
};
