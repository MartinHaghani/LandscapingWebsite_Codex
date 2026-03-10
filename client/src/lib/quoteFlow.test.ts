import { describe, expect, it } from 'vitest';
import { canContinueToMapStep, getCoverageGateDestination, getSubmissionStatus } from './quoteFlow';

describe('quote flow helpers', () => {
  it('allows continue when address is selected or user typed enough to resolve', () => {
    expect(canContinueToMapStep({ selectedAddress: '', addressInput: '' })).toBe(false);
    expect(canContinueToMapStep({ selectedAddress: '   ', addressInput: '12' })).toBe(false);
    expect(
      canContinueToMapStep({
        selectedAddress: '',
        addressInput: '123 Lawn Drive, Austin, TX'
      })
    ).toBe(true);
    expect(
      canContinueToMapStep({
        selectedAddress: '123 Lawn Drive, Austin, TX',
        addressInput: ''
      })
    ).toBe(true);
  });

  it('prioritizes minimum service polygon requirement in submission status', () => {
    expect(
      getSubmissionStatus({
        selectedAddress: '123 Lawn Drive, Austin, TX',
        validServicePolygonCount: 0,
        selfIntersecting: false,
        effectiveGeometryEmpty: false
      })
    ).toBe('Add at least one service polygon with 3 points.');
  });

  it('returns overlap warning once enough service polygons are present', () => {
    expect(
      getSubmissionStatus({
        selectedAddress: '123 Lawn Drive, Austin, TX',
        validServicePolygonCount: 1,
        selfIntersecting: true,
        effectiveGeometryEmpty: false
      })
    ).toBe('Overlapping boundary edges detected. Adjust vertices to continue.');
  });

  it('returns empty-effective-geometry status after intersection checks', () => {
    expect(
      getSubmissionStatus({
        selectedAddress: '123 Lawn Drive, Austin, TX',
        validServicePolygonCount: 1,
        selfIntersecting: false,
        effectiveGeometryEmpty: true
      })
    ).toBe('Obstacles remove the entire service area. Adjust boundaries to continue.');
  });

  it('returns ready when address and valid polygon requirements are met', () => {
    expect(
      getSubmissionStatus({
        selectedAddress: '123 Lawn Drive, Austin, TX',
        validServicePolygonCount: 1,
        selfIntersecting: false,
        effectiveGeometryEmpty: false
      })
    ).toBe('Ready to submit.');
  });

  it('returns expected navigation target for coverage gate outcomes', () => {
    expect(getCoverageGateDestination('in-area')).toBe('map');
    expect(getCoverageGateDestination('out-of-area')).toBe('/service-unavailable');
    expect(getCoverageGateDestination('check-failed')).toBe('/service-check-error');
  });
});
