import { useEffect, useMemo, useRef, useState } from 'react';
import guideHouseBackgroundSvg from '../../assets/quote-guide/guide-house-background.svg?raw';
import { getQuotePolygonStyleToken } from '../../lib/polygonPresentation';
import {
  getQuoteGuideDemoLoopFadeOpacity,
  QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT,
  QUOTE_GUIDE_DEMO_BACKGROUND_TOP,
  QUOTE_GUIDE_DEMO_CAMERA_TRANSITION_DURATION_MS,
  QUOTE_GUIDE_DEMO_MAP_HEIGHT,
  QUOTE_GUIDE_DEMO_MAP_WIDTH,
  QUOTE_GUIDE_DEMO_STAGE_CENTER_LOCAL_POINT,
  type QuoteGuideDemoCameraState
} from '../../lib/quoteGuideDemo';
import {
  buildQuoteGuideMultiZonePolygonPath,
  getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs,
  getQuoteGuideMultiZoneInstructionStateForPhase,
  getReducedMotionQuoteGuideMultiZoneDemoAnimationState,
  QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS,
  type QuoteGuideMultiZoneInstructionState
} from '../../lib/quoteGuideMultiZoneDemo';
import { QuoteGuideDemoCursor } from './QuoteGuideDemoCursor';
import { QuoteGuideDemoToolbar } from './QuoteGuideDemoToolbar';
import { QuoteGuideVertexMarker } from './QuoteGuideVertexMarker';

interface QuoteGuideStepMultiZoneDemoProps {
  ariaLabel: string;
  onInstructionStateChange?: (state: QuoteGuideMultiZoneInstructionState) => void;
}

const getCameraLayerTransform = (camera: QuoteGuideDemoCameraState) =>
  `translate(${
    QUOTE_GUIDE_DEMO_STAGE_CENTER_LOCAL_POINT.x - camera.focusPoint.x * camera.scale
  }px, ${
    QUOTE_GUIDE_DEMO_STAGE_CENTER_LOCAL_POINT.y - camera.focusPoint.y * camera.scale
  }px) scale(${camera.scale})`;

export const QuoteGuideStepMultiZoneDemo = ({
  ariaLabel,
  onInstructionStateChange
}: QuoteGuideStepMultiZoneDemoProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [viewportScale, setViewportScale] = useState(1);

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
      setElapsedMs(0);
      return;
    }

    let animationFrameId = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      setElapsedMs((timestamp - startTime) % QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS);
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!viewportRef.current || typeof window === 'undefined') {
      return;
    }

    const element = viewportRef.current;
    const updateScale = () => {
      const bounds = element.getBoundingClientRect();
      const nextScale = Math.min(
        bounds.width / QUOTE_GUIDE_DEMO_MAP_WIDTH,
        bounds.height / QUOTE_GUIDE_DEMO_MAP_HEIGHT,
        1
      );

      setViewportScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const observer = new ResizeObserver(() => updateScale());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const animationState = useMemo(
    () =>
      prefersReducedMotion
        ? getReducedMotionQuoteGuideMultiZoneDemoAnimationState()
        : getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(elapsedMs),
    [elapsedMs, prefersReducedMotion]
  );
  const instructionState = getQuoteGuideMultiZoneInstructionStateForPhase(animationState.phase);
  const renderCursorInCamera =
    animationState.cursorPoint.y >= QUOTE_GUIDE_DEMO_BACKGROUND_TOP &&
    animationState.cursorPoint.y <= QUOTE_GUIDE_DEMO_MAP_HEIGHT &&
    animationState.phase !== 'cursor-to-delete';
  const stageOpacity = prefersReducedMotion
    ? 1
    : getQuoteGuideDemoLoopFadeOpacity(elapsedMs, QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS);

  useEffect(() => {
    onInstructionStateChange?.(instructionState);
  }, [instructionState, onInstructionStateChange]);

  return (
    <div
      className="pointer-events-none relative h-full min-h-[25.5rem] w-full"
      data-guide-multi-zone-demo="true"
      aria-label={ariaLabel}
    >
      <div
        ref={viewportRef}
        className="relative h-full min-h-[25.5rem] overflow-hidden bg-[#F3F7F1]"
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${QUOTE_GUIDE_DEMO_MAP_WIDTH}px`,
            height: `${QUOTE_GUIDE_DEMO_MAP_HEIGHT}px`,
            transform: `translate(-50%, -50%) scale(${viewportScale})`,
            transformOrigin: 'center center',
            opacity: stageOpacity
          }}
          data-guide-demo-stage="true"
        >
          <div className="relative flex h-full flex-col overflow-hidden bg-white">
            <div
              className="relative z-20"
              style={{ height: `${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px` }}
            >
              <QuoteGuideDemoToolbar
                drawButtonLabel={animationState.drawButtonLabel}
                drawButtonActive={animationState.drawButtonActive}
                obstacleButtonActive={animationState.obstacleButtonActive}
                deleteEnabled={animationState.deleteEnabled}
                clearAllEnabled={animationState.clearAllEnabled}
                undoEnabled={animationState.undoEnabled}
                redoEnabled={animationState.redoEnabled}
                doneEnabled={animationState.doneEnabled}
                deletePressed={animationState.phase === 'click-delete-button'}
              />
            </div>

            <div
              className="absolute inset-x-0 z-0 overflow-hidden bg-[#EAF4EA]"
              style={{
                top: `${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px`,
                height: `${QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT}px`
              }}
            >
              <div
                className="absolute left-0"
                data-guide-camera-layer="true"
                style={{
                  top: `-${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px`,
                  width: `${QUOTE_GUIDE_DEMO_MAP_WIDTH}px`,
                  height: `${QUOTE_GUIDE_DEMO_MAP_HEIGHT}px`,
                  transform: getCameraLayerTransform(animationState.camera),
                  transformOrigin: '0 0',
                  transition: prefersReducedMotion
                    ? 'none'
                    : `transform ${QUOTE_GUIDE_DEMO_CAMERA_TRANSITION_DURATION_MS}ms cubic-bezier(0.2, 0.9, 0.24, 1)`
                }}
              >
                <div
                  className="absolute inset-x-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                  style={{
                    top: `${QUOTE_GUIDE_DEMO_BACKGROUND_TOP}px`,
                    height: `${QUOTE_GUIDE_DEMO_BACKGROUND_HEIGHT}px`
                  }}
                  data-guide-house-background-svg="true"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: guideHouseBackgroundSvg }}
                />

                <svg
                  viewBox={`0 0 ${QUOTE_GUIDE_DEMO_MAP_WIDTH} ${QUOTE_GUIDE_DEMO_MAP_HEIGHT}`}
                  className="absolute inset-0 z-10 h-full w-full"
                  aria-hidden="true"
                >
                  <defs>
                    <filter
                      id="quote-guide-multi-zone-vertex-shadow"
                      x="-120%"
                      y="-120%"
                      width="340%"
                      height="340%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="4"
                        stdDeviation="3.2"
                        floodColor="#329F5B"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>

                  {animationState.polygons.map((polygon) => {
                    const polygonStyle = getQuotePolygonStyleToken('service', polygon.selected);

                    return (
                      <g key={polygon.id}>
                        <path
                          d={buildQuoteGuideMultiZonePolygonPath(polygon.ringLocalPoints)}
                          fill={polygonStyle.fillColor}
                          fillOpacity={polygonStyle.fillOpacity}
                          stroke={polygonStyle.outlineColor}
                          strokeWidth={polygonStyle.outlineWidth}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />

                        {polygon.showVertices
                          ? polygon.ringLocalPoints.map((point, index) => {
                              const selected = index === polygon.selectedVertexIndex;
                              const deletingSelectedVertex =
                                selected &&
                                animationState.phase === 'deleting-vertex' &&
                                animationState.deletedVertexPoint !== null;

                              return (
                                <QuoteGuideVertexMarker
                                  key={`${polygon.id}-vertex-${index}`}
                                  markerKey={`${polygon.id}-vertex-${index}`}
                                  cx={point.x}
                                  cy={point.y}
                                  selected={selected}
                                  filterId="quote-guide-multi-zone-vertex-shadow"
                                  opacity={
                                    deletingSelectedVertex
                                      ? Math.max(0, 1 - animationState.deletedVertexProgress * 1.7)
                                      : 1
                                  }
                                />
                              );
                            })
                          : null}
                      </g>
                    );
                  })}

                  {animationState.deletedVertexPoint ? (
                    <circle
                      cx={animationState.deletedVertexPoint.x}
                      cy={animationState.deletedVertexPoint.y}
                      r={8 + animationState.deletedVertexProgress * 16}
                      fill="none"
                      stroke="#329F5B"
                      strokeWidth="2.8"
                      strokeOpacity={Math.max(0, 0.75 - animationState.deletedVertexProgress)}
                    />
                  ) : null}

                  {animationState.rawStrokePath ? (
                    <path
                      d={animationState.rawStrokePath}
                      fill="none"
                      stroke="#7DE8A6"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray="1"
                      strokeDashoffset={1 - animationState.rawStrokeProgress}
                      opacity="0.96"
                    />
                  ) : null}
                </svg>

                {animationState.showCursor && renderCursorInCamera ? (
                  <QuoteGuideDemoCursor
                    point={animationState.cursorPoint}
                    variant={animationState.cursorVariant}
                    showClickPulse={
                      animationState.phase === 'activate-right-draw' ||
                      animationState.phase === 'insert-vertex' ||
                      animationState.phase === 'select-extra-vertex' ||
                      animationState.phase === 'click-delete-button'
                    }
                    clickTone={animationState.phase === 'click-delete-button' ? 'danger' : 'default'}
                  />
                ) : null}
              </div>
            </div>
          </div>

          {animationState.showCursor && !renderCursorInCamera ? (
            <QuoteGuideDemoCursor
              point={animationState.cursorPoint}
              variant={animationState.cursorVariant}
              showClickPulse={
                animationState.phase === 'activate-right-draw' ||
                animationState.phase === 'insert-vertex' ||
                animationState.phase === 'select-extra-vertex' ||
                animationState.phase === 'click-delete-button'
              }
              clickTone={animationState.phase === 'click-delete-button' ? 'danger' : 'default'}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
