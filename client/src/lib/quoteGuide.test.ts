import { describe, expect, it } from 'vitest';
import {
  createQuoteGuideSessionState,
  dismissActiveQuoteGuideSession,
  getQuoteGuideInstructionContent,
  getQuoteGuideStep,
  getNextQuoteGuideStepIndex,
  getPreviousQuoteGuideStepIndex,
  getQuoteGuideSliderOffsetPercent,
  isActiveQuoteGuideSessionDismissed,
  QUOTE_GUIDE_STEPS,
  startNextQuoteGuideSession
} from './quoteGuide';

describe('quote guide helpers', () => {
  it('registers concrete lesson variants for all three guide steps', () => {
    expect(getQuoteGuideStep(0).kind).toBe('draw-demo');
    expect(getQuoteGuideStep(0).ariaLabel).toContain('Draw lawn demo');
    expect(getQuoteGuideStep(1).kind).toBe('multi-zone-edit-demo');
    expect(getQuoteGuideStep(1).ariaLabel).toContain('Multi-zone lawn demo');
    expect(getQuoteGuideStep(2).kind).toBe('obstacle-draw-demo');
    expect(getQuoteGuideStep(2).ariaLabel).toContain('Draw obstacle demo');
  });

  it('keeps step navigation bounded at the first and last placeholder steps', () => {
    expect(getPreviousQuoteGuideStepIndex(0)).toBe(0);
    expect(getNextQuoteGuideStepIndex(QUOTE_GUIDE_STEPS.length - 1)).toBe(
      QUOTE_GUIDE_STEPS.length - 1
    );
  });

  it('keeps the slider position in sync with the active step index', () => {
    expect(getQuoteGuideSliderOffsetPercent(0)).toBe(0);
    expect(getQuoteGuideSliderOffsetPercent(1)).toBe(50);
    expect(getQuoteGuideSliderOffsetPercent(QUOTE_GUIDE_STEPS.length - 1)).toBe(100);
  });

  it('scopes dismissal to a single map session and resets on the next session', () => {
    const initialState = createQuoteGuideSessionState();
    const firstSession = startNextQuoteGuideSession(initialState);
    const dismissedFirstSession = dismissActiveQuoteGuideSession(firstSession);
    const secondSession = startNextQuoteGuideSession(dismissedFirstSession);

    expect(isActiveQuoteGuideSessionDismissed(firstSession)).toBe(false);
    expect(isActiveQuoteGuideSessionDismissed(dismissedFirstSession)).toBe(true);
    expect(isActiveQuoteGuideSessionDismissed(secondSession)).toBe(false);
    expect(secondSession.activeSessionId).toBe(firstSession.activeSessionId + 1);
  });

  it('returns step-aware instruction copy for the full three-step guide', () => {
    expect(getQuoteGuideInstructionContent(0, 'step-1-draw')).toEqual({
      text: 'Draw loosely around your lawn.'
    });
    expect(getQuoteGuideInstructionContent(0, 'step-1-edit')).toEqual({
      text: 'Move the points to match your lawn.'
    });
    expect(getQuoteGuideInstructionContent(1, 'step-2-draw')).toEqual({
      text: 'Draw each separate lawn area on its own.'
    });
    expect(getQuoteGuideInstructionContent(1, 'step-2-add')).toEqual({
      text: 'Add extra points'
    });
    expect(getQuoteGuideInstructionContent(1, 'step-2-remove')).toEqual({
      text: 'Delete extra points'
    });
    expect(getQuoteGuideInstructionContent(2, 'step-3-obstacle')).toEqual({
      text: 'Use Draw obstacle for gardens, pools, and other no-mow areas.'
    });
  });
});
