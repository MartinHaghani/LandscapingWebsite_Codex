import { describe, expect, it } from 'vitest';
import {
  buildQuotePreviewFeatureCollection,
  getQuotePreviewBounds
} from './quoteStaticPreview';

describe('quoteStaticPreview', () => {
  it('builds preview features for service and obstacle polygons', () => {
    const featureCollection = buildQuotePreviewFeatureCollection([
      {
        id: 'polygon-1',
        kind: 'service',
        ringPoints: [
          [-79.52, 43.84],
          [-79.521, 43.84],
          [-79.521, 43.841]
        ],
        rawStrokePoints: null
      },
      {
        id: 'polygon-2',
        kind: 'obstacle',
        ringPoints: [
          [-79.5204, 43.8402],
          [-79.5207, 43.8402],
          [-79.5207, 43.8405]
        ],
        rawStrokePoints: null
      }
    ], 'polygon-2');

    expect(featureCollection.features).toHaveLength(2);
    expect(featureCollection.features[0]?.properties).toMatchObject({
      polygonId: 'polygon-1',
      polygonKind: 'service'
    });
    expect(featureCollection.features[1]?.properties).toMatchObject({
      polygonId: 'polygon-2',
      polygonKind: 'obstacle',
      selected: true
    });
    expect(featureCollection.features[0]?.properties).toMatchObject({
      selected: false
    });
  });

  it('derives padded preview bounds from the property center and geometry', () => {
    const bounds = getQuotePreviewBounds([-79.52, 43.84], [
      {
        id: 'polygon-1',
        kind: 'service',
        ringPoints: [
          [-79.52, 43.84],
          [-79.521, 43.84],
          [-79.521, 43.841]
        ],
        rawStrokePoints: null
      }
    ]);

    expect(bounds).not.toBeNull();
    expect(bounds?.[0][0]).toBeLessThan(-79.521);
    expect(bounds?.[0][0]).toBeGreaterThan(-79.5213);
    expect(bounds?.[0][1]).toBeLessThan(43.84);
    expect(bounds?.[0][1]).toBeGreaterThan(43.8397);
    expect(bounds?.[1][0]).toBeGreaterThan(-79.52);
    expect(bounds?.[1][0]).toBeLessThan(-79.5197);
    expect(bounds?.[1][1]).toBeGreaterThan(43.841);
    expect(bounds?.[1][1]).toBeLessThan(43.8413);
  });
});
