interface SubmissionStatusInput {
  selectedAddress: string;
  validServicePolygonCount: number;
  selfIntersecting: boolean;
  effectiveGeometryEmpty: boolean;
}

interface QuoteDraftReadyInput extends SubmissionStatusInput {
  hasGeometry: boolean;
}

interface ContinueToMapInput {
  selectedAddress: string;
  addressInput: string;
}

export type CoverageGateOutcome = 'in-area' | 'out-of-area' | 'check-failed';

export const canContinueToMapStep = ({ selectedAddress, addressInput }: ContinueToMapInput) =>
  selectedAddress.trim().length > 0 || addressInput.trim().length >= 3;

export const canSubmitQuoteDraft = ({
  selectedAddress,
  validServicePolygonCount,
  hasGeometry,
  selfIntersecting,
  effectiveGeometryEmpty
}: QuoteDraftReadyInput) =>
  selectedAddress.trim().length > 0 &&
  validServicePolygonCount > 0 &&
  hasGeometry &&
  !selfIntersecting &&
  !effectiveGeometryEmpty;

export const getCoverageGateDestination = (outcome: CoverageGateOutcome) => {
  if (outcome === 'in-area') {
    return 'map';
  }

  if (outcome === 'out-of-area') {
    return '/service-unavailable';
  }

  return '/service-check-error';
};

export const getSubmissionStatus = ({
  selectedAddress,
  validServicePolygonCount,
  selfIntersecting,
  effectiveGeometryEmpty
}: SubmissionStatusInput) => {
  if (validServicePolygonCount < 1) {
    return 'Add at least one service polygon with 3 points.';
  }

  if (selfIntersecting) {
    return 'Overlapping boundary edges detected. Adjust vertices to continue.';
  }

  if (effectiveGeometryEmpty) {
    return 'Obstacles remove the entire service area. Adjust boundaries to continue.';
  }

  if (selectedAddress.trim().length > 0) {
    return 'Ready to continue.';
  }

  return 'Select an address.';
};
