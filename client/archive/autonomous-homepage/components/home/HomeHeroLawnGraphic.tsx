import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import {
  HOME_HERO_LAWN,
  HOME_HERO_MOWER_ASSET_PATH,
  HOME_HERO_MOWER_FADE_IN_DURATION_MS,
  HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  HOME_HERO_MOWER_INITIAL_TRACK_STATE,
  HOME_HERO_MOWER_REVEAL_SCHEDULE,
  HOME_HERO_MOWER_TRACK_TOTAL_LENGTH,
  HOME_HERO_MOWER_TRAVEL_DURATION_MS,
  getHeroMowerTrackStateAtTravelDistance,
  type HeroMeasurementAnnotation,
  type HeroPoint,
  type HeroSegmentId
} from '../../lib/homeHeroLawn';
import {
  HOME_HERO_COVERAGE_ARROW_ANCHORS,
  HOME_HERO_COVERAGE_INITIAL_STATE,
  HOME_HERO_COVERAGE_PATH_D,
  HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH,
  HOME_HERO_GENERATING_PATH_DURATION_MS,
  HOME_HERO_LEARNING_DURATION_MS,
  HOME_HERO_MOWING_DURATION_MS,
  HOME_HERO_RESET_DURATION_MS,
  HOME_HERO_TOTAL_CYCLE_DURATION_MS,
  getHeroAnimationPhaseAtElapsedMs,
  getHeroCoveragePathStateAtDistance,
  type HeroAnimationPhase,
  type HeroCoverageArrowAnchor
} from '../../lib/homeHeroLawnCoverage';

interface HomeHeroLawnShapeProps {
  className?: string;
  mowerOpacity?: number;
  mowerPosition?: HeroPoint;
  mowerRotation?: number;
  revealedMeasurementIds?: readonly HeroSegmentId[];
  coveragePathOpacity?: number;
  coveragePathProgress?: number;
}

interface HomeHeroLawnGraphicProps {
  className?: string;
}

type HeroStatusPhase = 'learning' | 'generatingPath' | 'mowing';

interface HeroAnimationState {
  phase: HeroAnimationPhase;
  statusPhase: HeroStatusPhase;
  mowerOpacity: number;
  mowerPosition: HeroPoint;
  mowerRotation: number;
  revealedMeasurementIds: readonly HeroSegmentId[];
  coveragePathOpacity: number;
  coveragePathProgress: number;
}

const DIMENSION_COLOR = 'rgba(121, 128, 124, 0.82)';
const EXTENSION_COLOR = 'rgba(154, 160, 156, 0.58)';
const TEXT_COLOR = 'rgba(99, 106, 103, 0.92)';
const COVERAGE_PATH_COLOR = 'rgba(230, 239, 232, 0.88)';
const COVERAGE_ARROW_COLOR = 'rgba(216, 228, 221, 0.78)';
const DIMENSION_STROKE_WIDTH = 1.08;
const EXTENSION_STROKE_WIDTH = 0.86;
const COVERAGE_PATH_STROKE_WIDTH = 1.9;
const COVERAGE_ARROW_STROKE_WIDTH = 1.08;
const CAP_HALF_LENGTH = 3.5;
const MOWER_WIDTH = 36;
const MOWER_HEIGHT = 58;
const ALL_MEASUREMENT_IDS = HOME_HERO_LAWN.annotations.map((annotation) => annotation.id);
const HERO_STATUS_MEASURE_TEXT: Record<HeroStatusPhase, string> = {
  learning: 'learning your lawn...',
  generatingPath: 'Generating path',
  mowing: 'Mowing...'
};
const HERO_STATUS_MOTION = 'tickerFlip';
const HERO_STATUS_RAIL_WIDTH_BUFFER_PX = 28;

const easeInOut = (value: number) => value * value * (3 - 2 * value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getLineLength = (start: HeroPoint, end: HeroPoint) =>
  Number(Math.hypot(end.x - start.x, end.y - start.y).toFixed(2));

const getStrokeStyle = ({
  lineLength,
  visible,
  dashed = false
}: {
  lineLength: number;
  visible: boolean;
  dashed?: boolean;
}) => ({
  opacity: visible ? 1 : 0,
  strokeDasharray: dashed ? '4 4' : `${lineLength}`,
  strokeDashoffset: visible ? 0 : dashed ? lineLength * 0.6 : lineLength,
  transition:
    'opacity 260ms ease-out, stroke-dashoffset 460ms cubic-bezier(0.22, 1, 0.36, 1)'
});

const getTextStyle = (visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transition: 'opacity 240ms ease-out 120ms'
});

const getCoveragePathStyle = ({
  progress,
  opacity
}: {
  progress: number;
  opacity: number;
}) => ({
  opacity,
  strokeDasharray: `${HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH}`,
  strokeDashoffset: HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH * (1 - progress),
  transition: 'opacity 260ms ease-out'
});

const getCoverageArrowOpacity = ({
  anchorProgress,
  pathProgress,
  pathOpacity
}: {
  anchorProgress: number;
  pathProgress: number;
  pathOpacity: number;
}) => {
  const revealProgress = clamp((pathProgress - anchorProgress + 0.06) / 0.08, 0, 1);
  return revealProgress * pathOpacity * 0.9;
};

const createInitialAnimationState = (): HeroAnimationState => ({
  phase: 'learning',
  statusPhase: 'learning',
  mowerOpacity: 0,
  mowerPosition: HOME_HERO_MOWER_INITIAL_TRACK_STATE.point,
  mowerRotation:
    HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds: [],
  coveragePathOpacity: 0,
  coveragePathProgress: 0
});

const createReducedMotionState = (): HeroAnimationState => ({
  phase: 'learning',
  statusPhase: 'learning',
  mowerOpacity: 1,
  mowerPosition: HOME_HERO_COVERAGE_INITIAL_STATE.point,
  mowerRotation:
    HOME_HERO_COVERAGE_INITIAL_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds: ALL_MEASUREMENT_IDS,
  coveragePathOpacity: 0.34,
  coveragePathProgress: 1
});

const getHeroAnimationStateAtElapsedMs = (elapsedMs: number): HeroAnimationState => {
  const phaseState = getHeroAnimationPhaseAtElapsedMs(elapsedMs);

  if (phaseState.phase === 'learning') {
    const fadeInProgress = Math.min(phaseState.phaseElapsedMs / HOME_HERO_MOWER_FADE_IN_DURATION_MS, 1);
    const mowerOpacity = easeInOut(fadeInProgress);
    const travelElapsedMs = Math.max(0, phaseState.phaseElapsedMs - HOME_HERO_MOWER_FADE_IN_DURATION_MS);
    const travelProgress = Math.min(travelElapsedMs / HOME_HERO_MOWER_TRAVEL_DURATION_MS, 1);
    const trackState = getHeroMowerTrackStateAtTravelDistance(
      HOME_HERO_MOWER_TRACK_TOTAL_LENGTH * travelProgress
    );
    const revealedMeasurementIds = HOME_HERO_MOWER_REVEAL_SCHEDULE.filter(
      (segment) => travelElapsedMs >= segment.revealAtMs
    ).map((segment) => segment.id);

    return {
      phase: 'learning',
      statusPhase: 'learning',
      mowerOpacity,
      mowerPosition: trackState.point,
      mowerRotation: trackState.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
      revealedMeasurementIds,
      coveragePathOpacity: 0,
      coveragePathProgress: 0
    };
  }

  if (phaseState.phase === 'generatingPath') {
    const progress = phaseState.phaseElapsedMs / HOME_HERO_GENERATING_PATH_DURATION_MS;

    return {
      phase: 'generatingPath',
      statusPhase: 'generatingPath',
      mowerOpacity: 0,
      mowerPosition: HOME_HERO_COVERAGE_INITIAL_STATE.point,
      mowerRotation:
        HOME_HERO_COVERAGE_INITIAL_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
      revealedMeasurementIds: ALL_MEASUREMENT_IDS,
      coveragePathOpacity: 0.14 + easeInOut(progress) * 0.34,
      coveragePathProgress: progress
    };
  }

  if (phaseState.phase === 'mowing') {
    const progress = phaseState.phaseElapsedMs / HOME_HERO_MOWING_DURATION_MS;
    const mowerState = getHeroCoveragePathStateAtDistance(
      HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH * progress
    );

    return {
      phase: 'mowing',
      statusPhase: 'mowing',
      mowerOpacity: 1,
      mowerPosition: mowerState.point,
      mowerRotation: mowerState.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
      revealedMeasurementIds: ALL_MEASUREMENT_IDS,
      coveragePathOpacity: 0.48,
      coveragePathProgress: 1
    };
  }

  const fadeOut = 1 - easeInOut(phaseState.phaseElapsedMs / HOME_HERO_RESET_DURATION_MS);
  const finalCoverageState = getHeroCoveragePathStateAtDistance(HOME_HERO_COVERAGE_PATH_TOTAL_LENGTH);

  return {
    phase: 'reset',
    statusPhase: 'mowing',
    mowerOpacity: fadeOut,
    mowerPosition: finalCoverageState.point,
    mowerRotation: finalCoverageState.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
    revealedMeasurementIds: [],
    coveragePathOpacity: 0.48 * fadeOut,
    coveragePathProgress: 1
  };
};

const EndCap = ({
  x,
  y,
  orientation,
  visible
}: {
  x: number;
  y: number;
  orientation: 'vertical' | 'horizontal';
  visible: boolean;
}) => {
  const start =
    orientation === 'vertical'
      ? { x, y: y - CAP_HALF_LENGTH }
      : { x: x - CAP_HALF_LENGTH, y };
  const end =
    orientation === 'vertical'
      ? { x, y: y + CAP_HALF_LENGTH }
      : { x: x + CAP_HALF_LENGTH, y };

  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={DIMENSION_COLOR}
      strokeWidth={DIMENSION_STROKE_WIDTH}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      style={getStrokeStyle({ lineLength: getLineLength(start, end), visible })}
    />
  );
};

const LinearAnnotation = ({
  annotation,
  visible
}: {
  annotation: Extract<HeroMeasurementAnnotation, { type: 'linear' }>;
  visible: boolean;
}) => {
  const capOrientation =
    annotation.dimensionLine.start.y === annotation.dimensionLine.end.y ? 'vertical' : 'horizontal';
  const dimensionLength = getLineLength(annotation.dimensionLine.start, annotation.dimensionLine.end);

  return (
    <g data-measurement-id={annotation.id} data-measurement-visible={visible}>
      {annotation.extensionLines.map((extensionLine) => (
        <line
          key={`${annotation.id}-${extensionLine.start.x}-${extensionLine.start.y}`}
          x1={extensionLine.start.x}
          y1={extensionLine.start.y}
          x2={extensionLine.end.x}
          y2={extensionLine.end.y}
          stroke={EXTENSION_COLOR}
          strokeWidth={EXTENSION_STROKE_WIDTH}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={getStrokeStyle({
            lineLength: getLineLength(extensionLine.start, extensionLine.end),
            visible
          })}
        />
      ))}

      <line
        x1={annotation.dimensionLine.start.x}
        y1={annotation.dimensionLine.start.y}
        x2={annotation.dimensionLine.end.x}
        y2={annotation.dimensionLine.end.y}
        stroke={DIMENSION_COLOR}
        strokeWidth={DIMENSION_STROKE_WIDTH}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={getStrokeStyle({ lineLength: dimensionLength, visible, dashed: true })}
      />

      <EndCap
        x={annotation.dimensionLine.start.x}
        y={annotation.dimensionLine.start.y}
        orientation={capOrientation}
        visible={visible}
      />
      <EndCap
        x={annotation.dimensionLine.end.x}
        y={annotation.dimensionLine.end.y}
        orientation={capOrientation}
        visible={visible}
      />

      <text
        x={annotation.labelPosition.x}
        y={annotation.labelPosition.y}
        fill={TEXT_COLOR}
        fontFamily="Sora, ui-sans-serif, sans-serif"
        fontSize="11.5"
        fontWeight="600"
        textAnchor={annotation.textAnchor}
        dominantBaseline="central"
        style={{ ...getTextStyle(visible), fontVariantNumeric: 'tabular-nums' }}
      >
        {annotation.label}
      </text>
    </g>
  );
};

const RadiusAnnotation = ({
  annotation,
  visible
}: {
  annotation: Extract<HeroMeasurementAnnotation, { type: 'radius' }>;
  visible: boolean;
}) => {
  const [start, end] = annotation.leader;

  return (
    <g data-measurement-id={annotation.id} data-measurement-visible={visible}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={DIMENSION_COLOR}
        strokeWidth={DIMENSION_STROKE_WIDTH}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={getStrokeStyle({ lineLength: getLineLength(start, end), visible })}
      />

      <text
        x={annotation.labelPosition.x}
        y={annotation.labelPosition.y}
        fill={TEXT_COLOR}
        fontFamily="Sora, ui-sans-serif, sans-serif"
        fontSize="11.5"
        fontWeight="600"
        textAnchor={annotation.textAnchor}
        dominantBaseline="central"
        style={{ ...getTextStyle(visible), fontVariantNumeric: 'tabular-nums' }}
      >
        {annotation.label}
      </text>
    </g>
  );
};

const CoverageArrow = ({
  anchor,
  pathOpacity,
  pathProgress
}: {
  anchor: HeroCoverageArrowAnchor;
  pathOpacity: number;
  pathProgress: number;
}) => {
  const arrowOpacity = getCoverageArrowOpacity({
    anchorProgress: anchor.progress,
    pathOpacity,
    pathProgress
  });
  const arrowLength = anchor.variant === 'scanline' ? 6.8 : 5.6;
  const arrowHeadInset = anchor.variant === 'scanline' ? 2.9 : 2.3;
  const arrowWing = anchor.variant === 'scanline' ? 1.85 : 1.5;

  return (
    <g
      transform={`translate(${anchor.point.x} ${anchor.point.y}) rotate(${anchor.tangentDegrees}) scale(${anchor.scale})`}
      opacity={arrowOpacity}
      data-hero-coverage-arrow="true"
      data-arrow-variant={anchor.variant}
      data-arrow-visible={arrowOpacity > 0.03}
    >
      <path
        d={`M ${-arrowLength} 0 L ${arrowHeadInset} 0 M ${arrowHeadInset - 2.4} ${-arrowWing} L ${arrowHeadInset} 0 L ${arrowHeadInset - 2.4} ${arrowWing}`}
        fill="none"
        stroke={COVERAGE_ARROW_COLOR}
        strokeWidth={COVERAGE_ARROW_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
};

const HeroStatusLabel = ({
  phase,
  animatedEllipsis = true
}: {
  phase: HeroStatusPhase;
  animatedEllipsis?: boolean;
}) => {
  if (phase === 'learning') {
    return (
      <>
        learning your lawn
        {animatedEllipsis ? (
          <span className="hero-status-ellipsis" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        ) : (
          '...'
        )}
      </>
    );
  }

  if (phase === 'generatingPath') {
    return <>Generating path</>;
  }

  return <>Mowing...</>;
};

export const HomeHeroLawnShape = ({
  className,
  mowerOpacity = 0,
  mowerPosition = HOME_HERO_MOWER_INITIAL_TRACK_STATE.point,
  mowerRotation =
    HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds = [],
  coveragePathOpacity = 0,
  coveragePathProgress = 0
}: HomeHeroLawnShapeProps) => {
  const baseId = useId().replace(/:/g, '');
  const shadowFilterId = `${baseId}-${HOME_HERO_LAWN.id}-shadow`;
  const mowerClipId = `${baseId}-${HOME_HERO_LAWN.id}-clip`;

  return (
    <svg
      viewBox={HOME_HERO_LAWN.viewBox}
      className={cn('pointer-events-none w-full overflow-visible text-brand', className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-measurement-count={HOME_HERO_LAWN.annotations.length}
      data-revealed-count={revealedMeasurementIds.length}
    >
      <defs>
        <filter
          id={shadowFilterId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#101713" floodOpacity="0.12" />
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#101713" floodOpacity="0.06" />
        </filter>
        <clipPath id={mowerClipId}>
          <path d={HOME_HERO_LAWN.silhouettePath} />
        </clipPath>
      </defs>

      <g filter={`url(#${shadowFilterId})`} data-hero-parcel="true">
        <path d={HOME_HERO_LAWN.silhouettePath} fill="currentColor" />
      </g>

      <g clipPath={`url(#${mowerClipId})`} aria-hidden="true">
        <path
          d={HOME_HERO_COVERAGE_PATH_D}
          fill="none"
          stroke={COVERAGE_PATH_COLOR}
          strokeWidth={COVERAGE_PATH_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={getCoveragePathStyle({
            progress: coveragePathProgress,
            opacity: coveragePathOpacity
          })}
          data-hero-coverage-path="true"
          data-coverage-visible={coveragePathOpacity > 0.02}
          data-coverage-progress={coveragePathProgress.toFixed(3)}
        />

        {HOME_HERO_COVERAGE_ARROW_ANCHORS.map((anchor) => (
          <CoverageArrow
            key={`${anchor.variant}-${anchor.index}`}
            anchor={anchor}
            pathOpacity={coveragePathOpacity}
            pathProgress={coveragePathProgress}
          />
        ))}

        <image
          href={HOME_HERO_MOWER_ASSET_PATH}
          x={-MOWER_WIDTH / 2}
          y={-MOWER_HEIGHT / 2}
          width={MOWER_WIDTH}
          height={MOWER_HEIGHT}
          preserveAspectRatio="xMidYMid meet"
          opacity={mowerOpacity}
          transform={`translate(${mowerPosition.x} ${mowerPosition.y}) rotate(${mowerRotation})`}
          data-hero-mower="true"
        />
      </g>

      <path
        d={HOME_HERO_LAWN.silhouettePath}
        fill="none"
        stroke="rgba(255,255,255,0.66)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        data-hero-outline="true"
      />

      <g aria-hidden="true">
        {HOME_HERO_LAWN.annotations.map((annotation) => {
          const visible = revealedMeasurementIds.includes(annotation.id);

          return annotation.type === 'linear' ? (
            <LinearAnnotation key={annotation.id} annotation={annotation} visible={visible} />
          ) : (
            <RadiusAnnotation key={annotation.id} annotation={annotation} visible={visible} />
          );
        })}
      </g>
    </svg>
  );
};

export const HomeHeroLawnGraphic = ({ className }: HomeHeroLawnGraphicProps) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animationState, setAnimationState] = useState<HeroAnimationState>(createInitialAnimationState);
  const [statusAnimationKey, setStatusAnimationKey] = useState(0);
  const [statusRailWidth, setStatusRailWidth] = useState<number | null>(null);
  const statusMeasureRef = useRef<HTMLSpanElement | null>(null);
  const activeStatusText = HERO_STATUS_MEASURE_TEXT[animationState.statusPhase];
  const statusBurstClass = prefersReducedMotion
    ? null
    : statusAnimationKey % 2 === 0
      ? 'hero-status-burst-a'
      : 'hero-status-burst-b';

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimationState(createReducedMotionState());
      return;
    }

    let animationFrameId = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      setAnimationState(getHeroAnimationStateAtElapsedMs(timestamp - startTime));
      animationFrameId = window.requestAnimationFrame(tick);
    };

    setAnimationState(createInitialAnimationState());
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!statusMeasureRef.current || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const nextWidth = statusMeasureRef.current?.offsetWidth ?? 0;
      setStatusRailWidth(nextWidth > 0 ? nextWidth + HERO_STATUS_RAIL_WIDTH_BUFFER_PX : null);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeStatusText]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    setStatusAnimationKey((currentKey) => currentKey + 1);
  }, [animationState.statusPhase, prefersReducedMotion]);

  return (
    <div
      className={cn(
        'pointer-events-none flex h-full w-full items-center justify-center overflow-visible px-2 md:px-0',
        className
      )}
      data-hero-animation={prefersReducedMotion ? 'reduced-motion' : 'wall-and-infill-loop'}
      data-animation-phase={animationState.phase}
      data-learning-duration-ms={HOME_HERO_LEARNING_DURATION_MS}
      data-generating-duration-ms={HOME_HERO_GENERATING_PATH_DURATION_MS}
      data-mowing-duration-ms={HOME_HERO_MOWING_DURATION_MS}
      data-cycle-duration-ms={HOME_HERO_TOTAL_CYCLE_DURATION_MS}
      data-hero-lawn-stack="true"
    >
      <div className="flex w-full max-w-[35.5rem] flex-col items-center justify-center">
        <HomeHeroLawnShape
          className="w-full"
          mowerOpacity={animationState.mowerOpacity}
          mowerPosition={animationState.mowerPosition}
          mowerRotation={animationState.mowerRotation}
          revealedMeasurementIds={animationState.revealedMeasurementIds}
          coveragePathOpacity={animationState.coveragePathOpacity}
          coveragePathProgress={animationState.coveragePathProgress}
        />

        <div className="-mt-10 flex w-full justify-center md:-mt-12" data-hero-status-stack="true">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'hero-status-capsule flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-ink md:px-5',
                !prefersReducedMotion && `hero-status-capsule--${HERO_STATUS_MOTION}`,
                statusBurstClass
              )}
              data-status-phase={animationState.statusPhase}
              data-status-motion={prefersReducedMotion ? 'reduced' : HERO_STATUS_MOTION}
            >
              <span
                className={cn(
                  'hero-status-indicator',
                  animationState.statusPhase === 'learning'
                    ? 'hero-status-indicator--pulse'
                    : 'hero-status-indicator--steady'
                )}
                aria-hidden="true"
              />
              <div
                className="hero-status-text-rail relative flex h-5 items-center justify-center overflow-hidden leading-none"
                style={statusRailWidth ? { width: `${statusRailWidth}px` } : undefined}
                data-status-rail="true"
              >
                <span
                  ref={statusMeasureRef}
                  className="pointer-events-none invisible shrink-0 whitespace-nowrap tracking-[0.03em]"
                  aria-hidden="true"
                >
                  {activeStatusText}
                </span>
                <span
                  key={`${HERO_STATUS_MOTION}-${animationState.statusPhase}-${statusAnimationKey}`}
                  className={cn(
                    'hero-status-text absolute inset-0 inline-flex items-center justify-center whitespace-nowrap tracking-[0.03em]',
                    !prefersReducedMotion && `hero-status-text--${HERO_STATUS_MOTION}`
                  )}
                  data-status-active={animationState.statusPhase}
                >
                  <HeroStatusLabel phase={animationState.statusPhase} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
