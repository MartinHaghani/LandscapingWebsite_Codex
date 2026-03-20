import { useEffect, useId, useState } from 'react';
import { cn } from '../../lib/cn';
import {
  HOME_HERO_LAWN,
  HOME_HERO_MOWER_ASSET_PATH,
  HOME_HERO_MOWER_FADE_IN_DURATION_MS,
  HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  HOME_HERO_MOWER_INITIAL_TRACK_STATE,
  HOME_HERO_MOWER_REVEAL_LAG_MS,
  HOME_HERO_MOWER_REVEAL_SCHEDULE,
  HOME_HERO_MOWER_TRACK_TOTAL_LENGTH,
  HOME_HERO_MOWER_TRAVEL_DURATION_MS,
  getHeroMowerTrackStateAtTravelDistance,
  type HeroMeasurementAnnotation,
  type HeroPoint,
  type HeroSegmentId
} from '../../lib/homeHeroLawn';

interface HomeHeroLawnShapeProps {
  className?: string;
  mowerOpacity?: number;
  mowerPosition?: HeroPoint;
  mowerRotation?: number;
  revealedMeasurementIds?: readonly HeroSegmentId[];
}

interface HomeHeroLawnGraphicProps {
  className?: string;
}

interface HeroAnimationState {
  mowerOpacity: number;
  mowerPosition: HeroPoint;
  mowerRotation: number;
  revealedMeasurementIds: readonly HeroSegmentId[];
}

const DIMENSION_COLOR = 'rgba(121, 128, 124, 0.82)';
const EXTENSION_COLOR = 'rgba(154, 160, 156, 0.58)';
const TEXT_COLOR = 'rgba(99, 106, 103, 0.92)';
const DIMENSION_STROKE_WIDTH = 1.08;
const EXTENSION_STROKE_WIDTH = 0.86;
const CAP_HALF_LENGTH = 3.5;
const MOWER_WIDTH = 36;
const MOWER_HEIGHT = 58;
const RESET_BUFFER_MS = 380;

const createInitialAnimationState = (): HeroAnimationState => ({
  mowerOpacity: 0,
  mowerPosition: HOME_HERO_MOWER_INITIAL_TRACK_STATE.point,
  mowerRotation:
    HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds: []
});

const createReducedMotionState = (): HeroAnimationState => ({
  mowerOpacity: 1,
  mowerPosition: HOME_HERO_MOWER_INITIAL_TRACK_STATE.point,
  mowerRotation:
    HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds: HOME_HERO_LAWN.annotations.map((annotation) => annotation.id)
});

const easeInOut = (value: number) => value * value * (3 - 2 * value);

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

export const HomeHeroLawnShape = ({
  className,
  mowerOpacity = 0,
  mowerPosition = HOME_HERO_MOWER_INITIAL_TRACK_STATE.point,
  mowerRotation =
    HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
  revealedMeasurementIds = []
}: HomeHeroLawnShapeProps) => {
  const baseId = useId().replace(/:/g, '');
  const shadowFilterId = `${baseId}-${HOME_HERO_LAWN.id}-shadow`;
  const mowerClipId = `${baseId}-${HOME_HERO_LAWN.id}-clip`;

  return (
    <svg
      viewBox={HOME_HERO_LAWN.viewBox}
      className={cn('pointer-events-none h-full w-full overflow-visible text-brand', className)}
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
    const totalDurationMs =
      HOME_HERO_MOWER_FADE_IN_DURATION_MS +
      HOME_HERO_MOWER_TRAVEL_DURATION_MS +
      HOME_HERO_MOWER_REVEAL_LAG_MS +
      RESET_BUFFER_MS;

    setAnimationState(createInitialAnimationState());

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      const elapsedMs = timestamp - startTime;
      const fadeInProgress = Math.min(elapsedMs / HOME_HERO_MOWER_FADE_IN_DURATION_MS, 1);
      const mowerOpacity = easeInOut(fadeInProgress);
      const travelElapsedMs = Math.max(0, elapsedMs - HOME_HERO_MOWER_FADE_IN_DURATION_MS);
      const travelProgress = Math.min(travelElapsedMs / HOME_HERO_MOWER_TRAVEL_DURATION_MS, 1);
      const trackState = getHeroMowerTrackStateAtTravelDistance(
        HOME_HERO_MOWER_TRACK_TOTAL_LENGTH * travelProgress
      );
      const revealedMeasurementIds = HOME_HERO_MOWER_REVEAL_SCHEDULE.filter(
        (segment) => travelElapsedMs >= segment.revealAtMs
      ).map((segment) => segment.id);

      setAnimationState({
        mowerOpacity,
        mowerPosition: trackState.point,
        mowerRotation: trackState.tangentDegrees + HOME_HERO_MOWER_HEADING_OFFSET_DEGREES,
        revealedMeasurementIds
      });

      if (elapsedMs < totalDurationMs) {
        animationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      setAnimationState(createInitialAnimationState());
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={cn(
        'pointer-events-none relative flex h-full w-full items-center justify-center overflow-visible px-2 pb-16 md:px-0 md:pb-20',
        className
      )}
      data-hero-animation={prefersReducedMotion ? 'reduced-motion' : 'single-pass-reset'}
    >
      <HomeHeroLawnShape
        className="mx-auto max-h-full w-full max-w-[42rem]"
        mowerOpacity={animationState.mowerOpacity}
        mowerPosition={animationState.mowerPosition}
        mowerRotation={animationState.mowerRotation}
        revealedMeasurementIds={animationState.revealedMeasurementIds}
      />

      <div className="absolute inset-x-4 bottom-3 flex justify-center md:inset-x-8 md:bottom-5">
        <div className="hero-status-capsule flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-ink md:px-5">
          <span className="hero-status-indicator" aria-hidden="true" />
          <span className="tracking-[0.03em]">
            learning your lawn
            <span className="hero-status-ellipsis" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
