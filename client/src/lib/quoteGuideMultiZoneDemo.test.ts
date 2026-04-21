import { describe, expect, it } from 'vitest';
import {
  getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs,
  getQuoteGuideMultiZoneInstructionStateForPhase,
  getReducedMotionQuoteGuideMultiZoneDemoAnimationState,
  QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS,
  type QuoteGuideMultiZoneDemoPhase
} from './quoteGuideMultiZoneDemo';
import {
  QUOTE_GUIDE_DEMO_CAMERA_TRANSITION_DURATION_MS,
  QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS,
  QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA
} from './quoteGuideDemo';

const findMultiZoneDemoPhase = (phase: QuoteGuideMultiZoneDemoPhase) => {
  for (
    let elapsedMs = 0;
    elapsedMs < QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS;
    elapsedMs += 20
  ) {
    const state = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(elapsedMs);

    if (state.phase === phase) {
      return { elapsedMs, state };
    }
  }

  throw new Error(`Unable to find quote guide multi-zone demo phase: ${phase}`);
};

describe('quote guide multi-zone demo helpers', () => {
  it('starts with both left-side lawns preserved and draws only the right-side backyard', () => {
    const initialState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(0);
    const rightZoneDrawingState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(2_400);
    const rightZoneFinalizedState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(3_200);

    expect(initialState.phase).toBe('idle');
    expect(initialState.polygons).toHaveLength(2);
    expect(initialState.polygons[0]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_FRONT_ZONE_TARGET_RING_LOCAL_POINTS
    );
    expect(initialState.polygons[1]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_BACK_ZONE_FINAL_RING_LOCAL_POINTS
    );
    expect(initialState.polygons[0]?.selected).toBe(false);
    expect(initialState.polygons[1]?.selected).toBe(false);

    expect(rightZoneDrawingState.phase).toBe('drawing-right-zone');
    expect(rightZoneDrawingState.drawButtonLabel).toBe('Stop drawing');
    expect(rightZoneDrawingState.rawStrokeProgress).toBeGreaterThan(0);
    expect(rightZoneDrawingState.polygons).toHaveLength(2);

    expect(rightZoneFinalizedState.phase).toBe('right-zone-finalized');
    expect(rightZoneFinalizedState.polygons).toHaveLength(3);
    expect(rightZoneFinalizedState.polygons[0]?.selected).toBe(false);
    expect(rightZoneFinalizedState.polygons[1]?.selected).toBe(false);
    expect(rightZoneFinalizedState.polygons[2]?.selected).toBe(true);
    expect(rightZoneFinalizedState.polygons[2]?.showVertices).toBe(true);
    expect(rightZoneFinalizedState.polygons[2]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS
    );
    expect(QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS).toHaveLength(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length
    );
    expect(QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS).not.toContainEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[7]
    );
    expect(QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS[7]).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[8]
    );
  });

  it('shows vertex insertion first, then extra-vertex deletion, and ends corrected', () => {
    const cursorToEdgeStart = findMultiZoneDemoPhase('cursor-to-edge');
    const cursorToEdgeState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      cursorToEdgeStart.elapsedMs + 360
    );
    const cursorToEdgePacedState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      cursorToEdgeStart.elapsedMs + 760
    );
    const insertedVertexState = findMultiZoneDemoPhase('insert-vertex').state;
    const draggingInsertedVertexStart = findMultiZoneDemoPhase('drag-inserted-vertex');
    const draggingInsertedVertexState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      draggingInsertedVertexStart.elapsedMs + 240
    );
    const vertexAddedState = findMultiZoneDemoPhase('vertex-added').state;
    const selectedExtraVertexState = findMultiZoneDemoPhase('select-extra-vertex').state;
    const cursorToDeleteStart = findMultiZoneDemoPhase('cursor-to-delete');
    const cursorToDeleteState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      cursorToDeleteStart.elapsedMs + 420
    );
    const clickDeleteState = findMultiZoneDemoPhase('click-delete-button').state;
    const deletingVertexStart = findMultiZoneDemoPhase('deleting-vertex');
    const deletingVertexEarlyState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      deletingVertexStart.elapsedMs + 400
    );
    const deletingVertexLateState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      deletingVertexStart.elapsedMs + 700
    );
    const finalizedStart = findMultiZoneDemoPhase('finalized');
    const finalZoomOutState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      finalizedStart.elapsedMs + QUOTE_GUIDE_DEMO_CAMERA_TRANSITION_DURATION_MS / 2
    );
    const finalState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS - 40
    );

    expect(cursorToEdgeState.phase).toBe('cursor-to-edge');
    expect(cursorToEdgeState.cursorVariant).toBe('add-vertex');
    expect(cursorToEdgeState.camera.scale).toBeCloseTo(2.05);
    expect(cursorToEdgePacedState.phase).toBe('insert-vertex');

    expect(insertedVertexState.phase).toBe('insert-vertex');
    expect(insertedVertexState.polygons[2]?.selectedVertexIndex).toBe(7);
    expect(insertedVertexState.camera.scale).toBeCloseTo(2.05);
    expect(insertedVertexState.polygons[2]?.ringLocalPoints).toHaveLength(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_INITIAL_RING_LOCAL_POINTS.length + 1
    );

    expect(draggingInsertedVertexState.phase).toBe('drag-inserted-vertex');
    expect(draggingInsertedVertexState.polygons[2]?.selectedVertexIndex).toBe(7);
    expect(draggingInsertedVertexState.camera.scale).toBeCloseTo(2.05);

    expect(vertexAddedState.phase).toBe('vertex-added');
    expect(vertexAddedState.polygons[2]?.ringLocalPoints[7]).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS[7]
    );
    expect(vertexAddedState.polygons[2]?.ringLocalPoints).toHaveLength(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length + 1
    );

    expect(selectedExtraVertexState.phase).toBe('select-extra-vertex');
    expect(selectedExtraVertexState.deleteEnabled).toBe(true);
    expect(selectedExtraVertexState.polygons[2]?.selectedVertexIndex).toBe(18);
    expect(selectedExtraVertexState.camera.scale).toBeCloseTo(2.05);

    expect(cursorToDeleteState.phase).toBe('cursor-to-delete');
    expect(cursorToDeleteState.deleteEnabled).toBe(true);
    expect(cursorToDeleteState.cursorPoint.x).toBeGreaterThan(320);
    expect(cursorToDeleteState.cursorPoint.x).toBeLessThan(405);
    expect(cursorToDeleteState.cursorPoint.y).toBeGreaterThan(29);
    expect(cursorToDeleteState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);

    expect(clickDeleteState.phase).toBe('click-delete-button');
    expect(clickDeleteState.deleteEnabled).toBe(true);
    expect(clickDeleteState.cursorPoint).toEqual({ x: 405, y: 29 });
    expect(clickDeleteState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);
    expect(clickDeleteState.polygons[2]?.ringLocalPoints).toHaveLength(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length + 1
    );

    expect(deletingVertexEarlyState.phase).toBe('deleting-vertex');
    expect(deletingVertexEarlyState.deletedVertexPoint).not.toBeNull();
    expect(deletingVertexEarlyState.deletedVertexProgress).toBeGreaterThan(0);
    expect(deletingVertexEarlyState.polygons[2]?.ringLocalPoints).toHaveLength(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS.length + 1
    );

    expect(deletingVertexLateState.phase).toBe('deleting-vertex');
    expect(deletingVertexLateState.polygons[2]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
    );

    expect(finalZoomOutState.phase).toBe('finalized');
    expect(finalZoomOutState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);

    expect(finalState.phase).toBe('finalized');
    expect(finalState.deleteEnabled).toBe(true);
    expect(finalState.camera.scale).toBeCloseTo(1, 2);
    expect(finalState.polygons).toHaveLength(3);
    expect(finalState.polygons[2]?.selected).toBe(true);
    expect(finalState.polygons[2]?.showVertices).toBe(true);
    expect(finalState.polygons[2]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
    );
  });

  it('maps multi-zone phases to draw, add, and remove instruction states', () => {
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('idle')).toBe('draw');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('drawing-right-zone')).toBe('draw');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('cursor-to-edge')).toBe('add');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('drag-inserted-vertex')).toBe('add');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('cursor-to-delete')).toBe('remove');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('click-delete-button')).toBe('remove');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('deleting-vertex')).toBe('remove');
    expect(getQuoteGuideMultiZoneInstructionStateForPhase('finalized')).toBe('remove');
  });

  it('jumps reduced-motion mode directly to the corrected three-zone state', () => {
    const reducedMotionState = getReducedMotionQuoteGuideMultiZoneDemoAnimationState();

    expect(reducedMotionState.phase).toBe('finalized');
    expect(reducedMotionState.showCursor).toBe(false);
    expect(reducedMotionState.camera).toEqual(QUOTE_GUIDE_DEMO_FULL_FRAME_CAMERA);
    expect(reducedMotionState.polygons).toHaveLength(3);
    expect(reducedMotionState.polygons[2]?.ringLocalPoints).toEqual(
      QUOTE_GUIDE_DEMO_RIGHT_ZONE_TARGET_RING_LOCAL_POINTS
    );
  });

  it('wraps cleanly across the loop boundary', () => {
    const initialState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(40);
    const wrappedState = getQuoteGuideMultiZoneDemoAnimationStateAtElapsedMs(
      QUOTE_GUIDE_MULTI_ZONE_DEMO_LOOP_DURATION_MS + 40
    );

    expect(wrappedState.phase).toBe(initialState.phase);
    expect(wrappedState.drawButtonLabel).toBe(initialState.drawButtonLabel);
    expect(wrappedState.cursorVariant).toBe(initialState.cursorVariant);
    expect(wrappedState.polygons).toEqual(initialState.polygons);
  });
});
