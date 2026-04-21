import { describe, expect, it } from 'vitest';
import {
  getQuoteGuideDemoLoopFadeOpacity,
  getQuoteGuideDemoAnimationStateAtElapsedMs,
  getQuoteGuideDemoInstructionStateForPhase,
  getReducedMotionQuoteGuideDemoAnimationState,
  QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_STAGE_FADE_DURATION_MS,
  QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_LOOP_DURATION_MS,
  type QuoteGuideDemoPhase
} from './quoteGuideDemo';

const findDrawDemoPhase = (phase: QuoteGuideDemoPhase) => {
  for (let elapsedMs = 0; elapsedMs < QUOTE_GUIDE_DEMO_LOOP_DURATION_MS; elapsedMs += 20) {
    const state = getQuoteGuideDemoAnimationStateAtElapsedMs(elapsedMs);

    if (state.phase === phase) {
      return { elapsedMs, state };
    }
  }

  throw new Error(`Unable to find quote guide draw demo phase: ${phase}`);
};

describe('quote guide draw demo helpers', () => {
  it('derives an editable front-down polygon that differs from the exact lawn target', () => {
    expect(QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS).toHaveLength(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS.length
    );
    expect(QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS)).not.toBe(
      JSON.stringify(QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS)
    );
  });

  it('moves through draw, finalize, and point-edit phases in order', () => {
    const idleState = getQuoteGuideDemoAnimationStateAtElapsedMs(0);
    const drawingStart = findDrawDemoPhase('drawing');
    const drawingState = getQuoteGuideDemoAnimationStateAtElapsedMs(drawingStart.elapsedMs + 100);
    const finalizedState = findDrawDemoPhase('polygon-finalized').state;
    const cursorToVertexStart = findDrawDemoPhase('cursor-to-vertex');
    const cursorToVertexState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      cursorToVertexStart.elapsedMs + 140
    );
    const cursorToVertexPacedState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      cursorToVertexStart.elapsedMs + 300
    );
    const draggingVertexStart = findDrawDemoPhase('dragging-vertex');
    const draggingVertexState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      draggingVertexStart.elapsedMs + 100
    );
    const frontZoneFinalizedStart = findDrawDemoPhase('front-zone-finalized');
    const frontZoneZoomOutState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      frontZoneFinalizedStart.elapsedMs + 120
    );
    const backZoneDrawingStart = findDrawDemoPhase('drawing-back-zone');
    const backZoneDrawingState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      backZoneDrawingStart.elapsedMs + 100
    );
    const finalState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_DEMO_LOOP_DURATION_MS - 60
    );

    expect(idleState.phase).toBe('idle');
    expect(idleState.buttonLabel).toBe('Draw lawn');
    expect(idleState.polygonRingLocalPoints).toBeNull();

    expect(drawingState.phase).toBe('drawing');
    expect(drawingState.buttonLabel).toBe('Stop drawing');
    expect(drawingState.drawButtonActive).toBe(true);
    expect(drawingState.rawStrokeProgress).toBeGreaterThan(0);
    expect(drawingState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);

    expect(finalizedState.phase).toBe('polygon-finalized');
    expect(finalizedState.buttonLabel).toBe('Draw lawn');
    expect(finalizedState.showVertices).toBe(true);
    expect(finalizedState.polygonRingLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS
    );

    expect(cursorToVertexState.phase).toBe('cursor-to-vertex');
    expect(cursorToVertexState.selectedVertexIndex).toBe(0);
    expect(cursorToVertexState.camera.scale).toBeCloseTo(1.72);
    expect(cursorToVertexState.polygonRingLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS
    );
    expect(cursorToVertexPacedState.phase).toBe('dragging-vertex');

    expect(draggingVertexState.phase).toBe('dragging-vertex');
    expect(draggingVertexState.selectedVertexIndex).toBe(0);
    expect(draggingVertexState.camera.scale).toBeCloseTo(1.72);
    expect(draggingVertexState.polygonRingLocalPoints).not.toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_INITIAL_RING_LOCAL_POINTS
    );
    expect(draggingVertexState.polygonRingLocalPoints).not.toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );

    expect(frontZoneZoomOutState.phase).toBe('front-zone-finalized');
    expect(frontZoneZoomOutState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);

    expect(backZoneDrawingState.phase).toBe('drawing-back-zone');
    expect(backZoneDrawingState.buttonLabel).toBe('Stop drawing');
    expect(backZoneDrawingState.polygons).toHaveLength(1);
    expect(backZoneDrawingState.polygons[0]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(backZoneDrawingState.polygons[0]?.selected).toBe(false);
    expect(backZoneDrawingState.rawStrokeProgress).toBeGreaterThan(0);
    expect(backZoneDrawingState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);

    expect(finalState.phase).toBe('finalized');
    expect(finalState.buttonLabel).toBe('Draw lawn');
    expect(finalState.polygons).toHaveLength(2);
    expect(finalState.polygons[0]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(finalState.polygons[0]?.selected).toBe(false);
    expect(finalState.polygons[1]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(finalState.polygons[1]?.selected).toBe(true);
    expect(finalState.polygons[1]?.showVertices).toBe(true);
  });

  it('maps demo phases to the correct instruction copy state', () => {
    expect(getQuoteGuideDemoInstructionStateForPhase('idle')).toBe('draw');
    expect(getQuoteGuideDemoInstructionStateForPhase('drawing')).toBe('draw');
    expect(getQuoteGuideDemoInstructionStateForPhase('polygon-finalized')).toBe('draw');
    expect(getQuoteGuideDemoInstructionStateForPhase('cursor-to-vertex')).toBe('edit');
    expect(getQuoteGuideDemoInstructionStateForPhase('dragging-vertex')).toBe('edit');
    expect(getQuoteGuideDemoInstructionStateForPhase('finalized')).toBe('edit');
  });

  it('ends reduced-motion mode on the fully corrected left-side polygons', () => {
    const reducedMotionState = getReducedMotionQuoteGuideDemoAnimationState();

    expect(reducedMotionState.phase).toBe('finalized');
    expect(reducedMotionState.polygons).toHaveLength(2);
    expect(reducedMotionState.polygons[0]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(reducedMotionState.polygons[0]?.selected).toBe(false);
    expect(reducedMotionState.polygons[1]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_BACK_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(reducedMotionState.polygons[1]?.selected).toBe(true);
    expect(reducedMotionState.polygons[1]?.showVertices).toBe(true);
    expect(reducedMotionState.showVertices).toBe(true);
    expect(reducedMotionState.showCursor).toBe(false);
    expect(reducedMotionState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);
    expect(getQuoteGuideDemoInstructionStateForPhase(reducedMotionState.phase)).toBe('edit');
  });

  it('wraps the animation timeline cleanly across loop boundaries', () => {
    const initialState = getQuoteGuideDemoAnimationStateAtElapsedMs(40);
    const wrappedState = getQuoteGuideDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_DEMO_LOOP_DURATION_MS + 40
    );

    expect(wrappedState.phase).toBe(initialState.phase);
    expect(wrappedState.buttonLabel).toBe(initialState.buttonLabel);
    expect(wrappedState.drawButtonActive).toBe(initialState.drawButtonActive);
    expect(wrappedState.selectedVertexIndex).toBe(initialState.selectedVertexIndex);
  });

  it('fades the demo stage in at the start of the loop and back out at the end', () => {
    expect(getQuoteGuideDemoLoopFadeOpacity(0, QUOTE_GUIDE_DEMO_LOOP_DURATION_MS)).toBe(0);
    expect(
      getQuoteGuideDemoLoopFadeOpacity(
        QUOTE_GUIDE_DEMO_STAGE_FADE_DURATION_MS,
        QUOTE_GUIDE_DEMO_LOOP_DURATION_MS
      )
    ).toBeCloseTo(1, 3);
    expect(
      getQuoteGuideDemoLoopFadeOpacity(
        QUOTE_GUIDE_DEMO_LOOP_DURATION_MS - 40,
        QUOTE_GUIDE_DEMO_LOOP_DURATION_MS
      )
    ).toBeLessThan(0.01);
  });
});
