import { describe, expect, it } from 'vitest';
import {
  buildQuoteGuideObstaclePolygonPath,
  getQuoteGuideObstacleDemoAnimationStateAtElapsedMs,
  getReducedMotionQuoteGuideObstacleDemoAnimationState,
  QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS,
  type QuoteGuideObstacleDemoPhase
} from './quoteGuideObstacleDemo';
import {
  QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
} from './quoteGuideDemo';
import {
  QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
} from './quoteGuideMultiZoneDemo';

const findObstacleDemoPhase = (phase: QuoteGuideObstacleDemoPhase) => {
  for (let elapsedMs = 0; elapsedMs < QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS; elapsedMs += 20) {
    const state = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(elapsedMs);

    if (state.phase === phase) {
      return { elapsedMs, state };
    }
  }

  throw new Error(`Unable to find quote guide obstacle demo phase: ${phase}`);
};

describe('quote guide obstacle demo helpers', () => {
  it('starts from the completed three-zone lawn before drawing the front-tree obstacle', () => {
    const initialState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(0);
    const drawingStart = findObstacleDemoPhase('drawing-obstacle');
    const drawingState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(
      drawingStart.elapsedMs + 240
    );

    expect(initialState.phase).toBe('idle');
    expect(initialState.polygons).toHaveLength(3);
    expect(initialState.polygons[0]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(initialState.polygons[1]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS
    );
    expect(initialState.polygons[2]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(initialState.polygons.every((polygon) => polygon.selected === false)).toBe(true);

    expect(drawingState.phase).toBe('drawing-obstacle');
    expect(drawingState.obstacleButtonActive).toBe(true);
    expect(drawingState.drawButtonLabel).toBe('Draw lawn');
    expect(drawingState.rawStrokeProgress).toBeGreaterThan(0);
    expect(drawingState.polygons).toHaveLength(3);
  });

  it('clicks Draw obstacle, finalizes a red obstacle around the front tree, and holds it', () => {
    const activateState = findObstacleDemoPhase('activate-obstacle-draw').state;
    const finalizedStart = findObstacleDemoPhase('finalized');
    const finalizedMidState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(
      finalizedStart.elapsedMs + 1_000
    );
    const finalState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS - 40
    );

    expect(activateState.phase).toBe('activate-obstacle-draw');
    expect(activateState.obstacleButtonActive).toBe(true);

    expect(finalizedMidState.phase).toBe('finalized');
    expect(finalizedMidState.showCursor).toBe(false);
    expect(finalizedMidState.polygons).toHaveLength(4);
    expect(finalizedMidState.polygons[3]?.kind).toBe('obstacle');
    expect(finalizedMidState.polygons[3]?.selected).toBe(true);
    expect(finalizedMidState.polygons[3]?.showVertices).toBe(true);
    expect(finalizedMidState.polygons[3]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS
    );

    expect(finalState.phase).toBe('finalized');
    expect(finalState.polygons[3]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS
    );
    expect(finalState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);
  });

  it('jumps reduced-motion mode directly to the completed obstacle scene', () => {
    const reducedMotionState = getReducedMotionQuoteGuideObstacleDemoAnimationState();

    expect(reducedMotionState.phase).toBe('finalized');
    expect(reducedMotionState.showCursor).toBe(false);
    expect(reducedMotionState.polygons).toHaveLength(4);
    expect(reducedMotionState.polygons[3]?.kind).toBe('obstacle');
    expect(reducedMotionState.polygons[3]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS
    );
  });

  it('builds a closed polygon path and wraps cleanly across the loop boundary', () => {
    const initialState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(40);
    const wrappedState = getQuoteGuideObstacleDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_OBSTACLE_DEMO_LOOP_DURATION_MS + 40
    );

    expect(buildQuoteGuideObstaclePolygonPath([])).toBe('');
    expect(
      buildQuoteGuideObstaclePolygonPath(QUOTE_GUIDE_DEMO_FRONT_TREE_OBSTACLE_TARGET_RING_LOCAL_POINTS)
    ).toContain('Z');
    expect(wrappedState.phase).toBe(initialState.phase);
    expect(wrappedState.obstacleButtonActive).toBe(initialState.obstacleButtonActive);
    expect(wrappedState.polygons).toEqual(initialState.polygons);
  });
});
