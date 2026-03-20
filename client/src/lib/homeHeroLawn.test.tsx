import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeHeroLawnGraphic, HomeHeroLawnShape } from '../components/home/HomeHeroLawnGraphic';
import {
  HOME_HERO_LAWN,
  HOME_HERO_COUNTER_CLOCKWISE_SEGMENT_IDS,
  HOME_HERO_MOWER_ASSET_PATH,
  HOME_HERO_MOWER_INITIAL_TRACK_STATE,
  HOME_HERO_MOWER_REVEAL_SCHEDULE,
  HOME_HERO_MOWER_START_DISTANCE,
  HOME_HERO_MOWER_START_PROGRESS,
  HOME_HERO_MOWER_START_SEGMENT_ID,
  HOME_HERO_MOWER_TRACK_PROGRESS,
  HOME_HERO_MOWER_TRACK_SEGMENTS,
  HOME_HERO_MOWER_TRACK_TOTAL_LENGTH,
  HOME_HERO_SILHOUETTE_PATH,
  getHeroArcRadiusLabel,
  getHeroMeasurementRevealSchedule,
  getHeroMowerTrackStateAtTravelDistance,
  getHeroLineMeasurementLabel
} from './homeHeroLawn';

const isAxisAligned = (
  first: { x: number; y: number },
  second: { x: number; y: number }
) => first.x === second.x || first.y === second.y;

describe('homeHeroLawn', () => {
  it('uses the exact curated parcel path from the fixed geometry source', () => {
    expect(HOME_HERO_LAWN.id).toBe('curatedCadParcelLawn');
    expect(HOME_HERO_LAWN.viewBox).toBe('0 0 640 480');
    expect(HOME_HERO_LAWN.scaleMetersPerUnit).toBe(0.03048);
    expect(HOME_HERO_SILHOUETTE_PATH).toBe(
      'M 140 130 L 420 130 A 60 60 0 0 1 480 190 L 480 300 A 70 70 0 0 1 410 370 L 200 370 A 100 100 0 0 1 100 270 L 100 170 A 40 40 0 0 1 140 130 Z'
    );
    expect(HOME_HERO_LAWN.silhouettePath).toBe(HOME_HERO_SILHOUETTE_PATH);
  });

  it('derives the four straight measurements from the same geometry source in meters with two decimals', () => {
    expect(getHeroLineMeasurementLabel('topStraight')).toBe('8.53 m');
    expect(getHeroLineMeasurementLabel('rightStraight')).toBe('3.35 m');
    expect(getHeroLineMeasurementLabel('bottomStraight')).toBe('6.40 m');
    expect(getHeroLineMeasurementLabel('leftStraight')).toBe('3.05 m');
  });

  it('derives the four arc radius labels from the same geometry source in meters with two decimals', () => {
    expect(getHeroArcRadiusLabel('upperRightArc')).toBe('R 1.83 m');
    expect(getHeroArcRadiusLabel('lowerRightArc')).toBe('R 2.13 m');
    expect(getHeroArcRadiusLabel('lowerLeftArc')).toBe('R 3.05 m');
    expect(getHeroArcRadiusLabel('upperLeftArc')).toBe('R 1.22 m');
  });

  it('derives the inset mower track and counter-clockwise traversal order from the same parcel geometry', () => {
    expect(HOME_HERO_COUNTER_CLOCKWISE_SEGMENT_IDS).toEqual([
      'upperLeftArc',
      'leftStraight',
      'lowerLeftArc',
      'bottomStraight',
      'lowerRightArc',
      'rightStraight',
      'upperRightArc',
      'topStraight'
    ]);
    expect(HOME_HERO_MOWER_TRACK_SEGMENTS.map((segment) => segment.id)).toEqual(
      HOME_HERO_COUNTER_CLOCKWISE_SEGMENT_IDS
    );
    expect(HOME_HERO_MOWER_TRACK_SEGMENTS[0]).toMatchObject({
      type: 'arc',
      radius: 22,
      start: { x: 140, y: 148 },
      end: { x: 118, y: 170 }
    });
    expect(HOME_HERO_MOWER_TRACK_SEGMENTS[1]).toMatchObject({
      type: 'line',
      start: { x: 118, y: 170 },
      end: { x: 118, y: 270 }
    });
    expect(HOME_HERO_MOWER_TRACK_SEGMENTS[7]).toMatchObject({
      type: 'line',
      start: { x: 420, y: 148 },
      end: { x: 140, y: 148 }
    });
    expect(HOME_HERO_MOWER_START_SEGMENT_ID).toBe('bottomStraight');
    expect(HOME_HERO_MOWER_START_DISTANCE).toBeGreaterThan(
      HOME_HERO_MOWER_TRACK_PROGRESS[3].startLength
    );
    expect(HOME_HERO_MOWER_START_DISTANCE).toBeLessThan(HOME_HERO_MOWER_TRACK_PROGRESS[3].endLength);
    expect(HOME_HERO_MOWER_START_PROGRESS).toBeGreaterThan(0);
    expect(HOME_HERO_MOWER_TRACK_TOTAL_LENGTH).toBeGreaterThan(0);
  });

  it('starts the mower in the middle of the bottom straight and loops back to that point', () => {
    expect(HOME_HERO_MOWER_INITIAL_TRACK_STATE.segmentId).toBe('bottomStraight');
    expect(HOME_HERO_MOWER_INITIAL_TRACK_STATE.point).toEqual({ x: 305, y: 352 });
    expect(HOME_HERO_MOWER_INITIAL_TRACK_STATE.tangentDegrees).toBe(0);
    expect(getHeroMowerTrackStateAtTravelDistance(HOME_HERO_MOWER_TRACK_TOTAL_LENGTH)).toEqual(
      HOME_HERO_MOWER_INITIAL_TRACK_STATE
    );
  });

  it('keeps reveal timestamps strictly after each segment traversal end from the bottom-start animation offset', () => {
    const customSchedule = getHeroMeasurementRevealSchedule(10000, 200);

    expect(HOME_HERO_MOWER_TRACK_PROGRESS).toHaveLength(8);
    expect(HOME_HERO_MOWER_REVEAL_SCHEDULE).toHaveLength(8);
    expect(customSchedule.map((segment) => segment.id)).toEqual([
      'bottomStraight',
      'lowerRightArc',
      'rightStraight',
      'upperRightArc',
      'topStraight',
      'upperLeftArc',
      'leftStraight',
      'lowerLeftArc'
    ]);
    customSchedule.forEach((segment, index) => {
      expect(segment.revealAtMs).toBeGreaterThan(segment.segmentEndMs);
      if (index > 0) {
        expect(segment.segmentEndMs).toBeGreaterThan(
          customSchedule[index - 1].segmentEndMs
        );
      }
    });
  });

  it('keeps line dimensions axis-aligned and radius callouts as single straight leaders', () => {
    HOME_HERO_LAWN.annotations.forEach((annotation) => {
      if (annotation.type === 'linear') {
        annotation.extensionLines.forEach((line) => {
          expect(isAxisAligned(line.start, line.end)).toBe(true);
        });

        expect(isAxisAligned(annotation.dimensionLine.start, annotation.dimensionLine.end)).toBe(true);
        return;
      }

      expect(annotation.leader).toHaveLength(2);
      expect(annotation.leader[0]).not.toEqual(annotation.leader[1]);
    });
  });

  it('renders one transparent inline SVG hero with exactly eight measurement labels', () => {
    const markup = renderToStaticMarkup(<HomeHeroLawnGraphic />);

    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('pointer-events-none');
    expect(markup).toContain('data-measurement-count="8"');
    expect(markup).toContain('data-revealed-count="0"');
    expect(markup).toContain(HOME_HERO_MOWER_ASSET_PATH);
    expect(markup).toContain('learning your lawn');
    expect(markup).toContain('data-measurement-visible="false"');
    expect(markup.match(/<text/g)?.length ?? 0).toBe(8);
    expect(markup).toContain('8.53 m');
    expect(markup).toContain('R 1.83 m');
    expect(markup).not.toContain('<rect');
    expect(markup).not.toContain('Lawn Variant');
    expect(markup).not.toContain('carousel');
    expect(markup).not.toContain('strokeLinejoin="miter"');
  });

  it('keeps the parcel fill, white outline, and shadow isolated from the dimension overlay', () => {
    const markup = renderToStaticMarkup(<HomeHeroLawnShape />);

    expect(markup).toContain('data-hero-parcel="true"');
    expect(markup).toContain('data-hero-outline="true"');
    expect(markup).toContain('data-hero-mower="true"');
    expect(markup).toContain('feDropShadow');
    expect(markup).toContain('<clipPath');
    expect(markup.match(/<path/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(markup.match(/<line/g)?.length ?? 0).toBeGreaterThanOrEqual(16);
    expect(markup).toContain(HOME_HERO_MOWER_ASSET_PATH);
    expect(markup).toContain('currentColor');
    expect(markup).toContain('rgba(255,255,255,0.66)');
    expect(markup).toContain('stroke-width="2.2"');
    expect(markup).toContain('rgba(121, 128, 124, 0.82)');
    expect(markup).toContain('rgba(154, 160, 156, 0.58)');
    expect(markup).toContain('rgba(99, 106, 103, 0.92)');
    expect(markup).toContain('stroke-dasharray:4 4');
    expect(markup).not.toContain('<polyline');
  });
});
