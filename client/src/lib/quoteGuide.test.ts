import { describe, expect, it } from 'vitest';
import {
  createQuoteGuideSessionState,
  dismissActiveQuoteGuideSession,
  getNextQuoteGuideStepIndex,
  getPreviousQuoteGuideStepIndex,
  getQuoteGuideSliderOffsetPercent,
  isActiveQuoteGuideSessionDismissed,
  QUOTE_GUIDE_STEPS,
  startNextQuoteGuideSession
} from './quoteGuide';

describe('quote guide helpers', () => {
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
});
