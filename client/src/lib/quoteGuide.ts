export type QuoteGuideStepKind =
  | 'draw-demo'
  | 'multi-zone-edit-demo'
  | 'obstacle-draw-demo';

export type QuoteGuideInstructionKey =
  | 'step-1-draw'
  | 'step-1-edit'
  | 'step-2-draw'
  | 'step-2-add'
  | 'step-2-remove'
  | 'step-3-obstacle';

export interface QuoteGuideStep {
  id: string;
  kind: QuoteGuideStepKind;
  ariaLabel: string;
  defaultInstructionKey: QuoteGuideInstructionKey;
}

export interface QuoteGuideInstructionContent {
  text: string;
}

export interface QuoteGuideSessionState {
  activeSessionId: number;
  dismissedSessionId: number | null;
}

export const QUOTE_GUIDE_STEPS: QuoteGuideStep[] = [
  {
    id: 'quote-guide-step-1',
    kind: 'draw-demo',
    ariaLabel: 'Guide step 1: Draw lawn demo',
    defaultInstructionKey: 'step-1-draw'
  },
  {
    id: 'quote-guide-step-2',
    kind: 'multi-zone-edit-demo',
    ariaLabel: 'Guide step 2: Multi-zone lawn demo',
    defaultInstructionKey: 'step-2-draw'
  },
  {
    id: 'quote-guide-step-3',
    kind: 'obstacle-draw-demo',
    ariaLabel: 'Guide step 3: Draw obstacle demo',
    defaultInstructionKey: 'step-3-obstacle'
  }
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

export const getQuoteGuideStep = (stepIndex: number) =>
  QUOTE_GUIDE_STEPS[getBoundedQuoteGuideStepIndex(stepIndex)];

export const getQuoteGuideInstructionContent = (
  stepIndex: number,
  instructionKey?: QuoteGuideInstructionKey
): QuoteGuideInstructionContent | null => {
  const step = getQuoteGuideStep(stepIndex);
  const effectiveInstructionKey = instructionKey ?? step.defaultInstructionKey;

  switch (effectiveInstructionKey) {
    case 'step-1-draw':
      return { text: 'Draw loosely around your lawn.' };
    case 'step-1-edit':
      return { text: 'Move the points to match your lawn.' };
    case 'step-2-draw':
      return { text: 'Draw each separate lawn area on its own.' };
    case 'step-2-add':
      return { text: 'Add extra points' };
    case 'step-2-remove':
      return { text: 'Delete extra points' };
    case 'step-3-obstacle':
      return { text: 'Use Draw obstacle for gardens, pools, and other no-mow areas.' };
    default:
      return null;
  }
};
