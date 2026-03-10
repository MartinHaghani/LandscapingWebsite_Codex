import { describe, expect, it } from 'vitest';
import {
  applyPolygonEdit,
  createPolygonHistory,
  redoPolygonEdit,
  undoPolygonEdit
} from './polygonHistory';

describe('polygonHistory', () => {
  it('pushes the current state to past when applying an edit', () => {
    const initial = createPolygonHistory({ polygons: [], activePolygonId: null });
    const next = applyPolygonEdit(initial, {
      polygons: [{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }],
      activePolygonId: 'p1'
    });

    expect(next.past).toEqual([{ polygons: [], activePolygonId: null }]);
    expect(next.present.activePolygonId).toBe('p1');
    expect(next.present.polygons).toHaveLength(1);
    expect(next.future).toEqual([]);
  });

  it('undo restores previous state and redo reapplies it', () => {
    const edited = applyPolygonEdit(createPolygonHistory({ polygons: [], activePolygonId: null }), {
      polygons: [{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }],
      activePolygonId: 'p1'
    });

    const undone = undoPolygonEdit(edited);
    expect(undone.present).toEqual({ polygons: [], activePolygonId: null });

    const redone = redoPolygonEdit(undone);
    expect(redone.present.activePolygonId).toBe('p1');
    expect(redone.present.polygons).toEqual([{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }]);
  });

  it('clears future history after a branched edit', () => {
    const edited = applyPolygonEdit(createPolygonHistory({ polygons: [], activePolygonId: null }), {
      polygons: [{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }],
      activePolygonId: 'p1'
    });

    const undone = undoPolygonEdit(edited);
    const branched = applyPolygonEdit(undone, {
      polygons: [{ id: 'p2', kind: 'service', points: [[-96.82, 32.71]] }],
      activePolygonId: 'p2'
    });

    expect(branched.future).toEqual([]);
  });

  it('does not add history for no-op edits', () => {
    const edited = applyPolygonEdit(createPolygonHistory({ polygons: [], activePolygonId: null }), {
      polygons: [{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }],
      activePolygonId: 'p1'
    });

    const noOp = applyPolygonEdit(edited, {
      polygons: [{ id: 'p1', kind: 'service', points: [[-96.8, 32.7]] }],
      activePolygonId: 'p1'
    });

    expect(noOp).toBe(edited);
  });
});
