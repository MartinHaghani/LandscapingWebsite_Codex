import { describe, expect, it } from 'vitest';
import {
  deleteVertexOrPolygonFromEditorState,
  removePolygonFromEditorState
} from './polygonEditing';

describe('polygon editing helpers', () => {
  it('deletes the whole polygon when removing a vertex from a 3-point polygon', () => {
    const nextState = deleteVertexOrPolygonFromEditorState(
      {
        polygons: [
          {
            id: 'triangle',
            ringPoints: [
              [0, 0],
              [2, 0],
              [1, 2]
            ]
          },
          {
            id: 'square',
            ringPoints: [
              [5, 0],
              [7, 0],
              [7, 2],
              [5, 2]
            ]
          }
        ],
        activePolygonId: 'triangle'
      },
      'triangle',
      1
    );

    expect(nextState.polygons.map((polygon) => polygon.id)).toEqual(['square']);
    expect(nextState.activePolygonId).toBe('square');
  });

  it('removes only the selected vertex when the polygon has more than 3 points', () => {
    const nextState = deleteVertexOrPolygonFromEditorState(
      {
        polygons: [
          {
            id: 'square',
            ringPoints: [
              [0, 0],
              [4, 0],
              [4, 4],
              [0, 4]
            ]
          }
        ],
        activePolygonId: 'square'
      },
      'square',
      1
    );

    expect(nextState.polygons[0]?.ringPoints).toEqual([
      [0, 0],
      [4, 4],
      [0, 4]
    ]);
    expect(nextState.activePolygonId).toBe('square');
  });

  it('updates the active polygon when deleting a selected polygon', () => {
    const nextState = removePolygonFromEditorState(
      {
        polygons: [
          { id: 'one', ringPoints: [[0, 0], [1, 0], [0, 1]] },
          { id: 'two', ringPoints: [[3, 0], [4, 0], [3, 1]] }
        ],
        activePolygonId: 'one'
      },
      'one'
    );

    expect(nextState.polygons.map((polygon) => polygon.id)).toEqual(['two']);
    expect(nextState.activePolygonId).toBe('two');
  });
});
