export interface QuoteGuideStep {
  id: string;
}

export interface QuoteGuideSessionState {
  activeSessionId: number;
  dismissedSessionId: number | null;
}

export const QUOTE_GUIDE_STEPS: QuoteGuideStep[] = [
  { id: 'quote-guide-step-1' },
  { id: 'quote-guide-step-2' },
  { id: 'quote-guide-step-3' }
];

export const createQuoteGuideSessionState = (): QuoteGuideSessionState => ({
  activeSessionId: 0,
  dismissedSessionId: null
});

export const startNextQuoteGuideSession = (
  state: QuoteGuideSessionState
): QuoteGuideSessionState => ({
  ...state,
  activeSessionId: state.activeSessionId + 1
});

export const dismissActiveQuoteGuideSession = (
  state: QuoteGuideSessionState
): QuoteGuideSessionState => {
  if (state.activeSessionId < 1) {
    return state;
  }

  return {
    ...state,
    dismissedSessionId: state.activeSessionId
  };
};

export const isActiveQuoteGuideSessionDismissed = (state: QuoteGuideSessionState) =>
  state.activeSessionId > 0 && state.dismissedSessionId === state.activeSessionId;

export const getBoundedQuoteGuideStepIndex = (
  stepIndex: number,
  stepCount = QUOTE_GUIDE_STEPS.length
) => Math.min(Math.max(stepIndex, 0), Math.max(stepCount - 1, 0));

export const getPreviousQuoteGuideStepIndex = (
  stepIndex: number,
  stepCount = QUOTE_GUIDE_STEPS.length
) => getBoundedQuoteGuideStepIndex(stepIndex - 1, stepCount);

export const getNextQuoteGuideStepIndex = (
  stepIndex: number,
  stepCount = QUOTE_GUIDE_STEPS.length
) => getBoundedQuoteGuideStepIndex(stepIndex + 1, stepCount);

export const getQuoteGuideSliderOffsetPercent = (
  stepIndex: number,
  stepCount = QUOTE_GUIDE_STEPS.length
) => {
  if (stepCount <= 1) {
    return 0;
  }

  return (getBoundedQuoteGuideStepIndex(stepIndex, stepCount) / (stepCount - 1)) * 100;
};
