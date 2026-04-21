import { describe, expect, it, vi } from 'vitest';
import { getQuoteConfirmationRedirect, loadQuoteConfirmation } from './quoteConfirmationFlow';
import type { QuoteLookupResponse } from '../types';

const createQuote = (overrides: Partial<QuoteLookupResponse> = {}): QuoteLookupResponse => ({
  id: 'Q-ABC12345',
  createdAt: '2026-04-16T12:00:00.000Z',
  address: '123 Greenway Blvd, Vaughan, ON',
  metrics: {
    areaM2: 420,
    perimeterM: 96
  },
  plan: 'Premium Weekly',
  serviceFrequency: 'weekly',
  sessionsMin: 20,
  sessionsMax: 20,
  perSessionTotal: 72.5,
  seasonalTotalMin: 1450,
  seasonalTotalMax: 1450,
  fullSeasonTotal: 1450,
  seasonalDiscountedTotal: 1160,
  seasonalSavingsTotal: 290,
  seasonalDiscountRate: 0.2,
  billingMode: 'seasonal',
  quoteTotal: 72.5,
  status: 'draft',
  contactPending: true,
  submittedAt: null,
  ...overrides
});

describe('quoteConfirmationFlow', () => {
  it('routes signed-out customers to sign-in with a return URL', () => {
    expect(
      getQuoteConfirmationRedirect({
        isLoaded: true,
        isSignedIn: false,
        hasRequiredPhone: false,
        quoteId: 'Q-ABC12345',
        locationPath: '/quote-confirmation/Q-ABC12345',
        locationSearch: ''
      })
    ).toBe('/sign-in?redirect_url=%2Fquote-confirmation%2FQ-ABC12345');
  });

  it('routes signed-in customers without a phone number to complete profile', () => {
    expect(
      getQuoteConfirmationRedirect({
        isLoaded: true,
        isSignedIn: true,
        hasRequiredPhone: false,
        quoteId: 'Q-ABC12345',
        locationPath: '/quote-confirmation/Q-ABC12345',
        locationSearch: '?from=signup'
      })
    ).toBe('/complete-profile?redirect_url=%2Fquote-confirmation%2FQ-ABC12345%3Ffrom%3Dsignup');
  });

  it('auto-finalizes draft quotes that are still pending contact review', async () => {
    const claimQuote = vi.fn().mockResolvedValue({ ok: true });
    const getQuote = vi
      .fn()
      .mockResolvedValueOnce(createQuote({ contactPending: true, status: 'draft' }))
      .mockResolvedValueOnce(
        createQuote({
          contactPending: false,
          status: 'in_review',
          submittedAt: '2026-04-16T12:05:00.000Z'
        })
      );
    const submitClaimedQuoteContact = vi.fn().mockResolvedValue({
      ok: true,
      quoteId: 'Q-ABC12345',
      status: 'in_review',
      submittedAt: '2026-04-16T12:05:00.000Z'
    });
    const createIdempotencyKey = vi.fn().mockReturnValue('quote-confirmation-key');
    const getAttributionSnapshot = vi.fn().mockReturnValue({ utmSource: 'google' });
    const finalizeIdempotencyKeyRef = { current: null as string | null };

    const result = await loadQuoteConfirmation({
      quoteId: 'Q-ABC12345',
      authToken: 'token-123',
      finalizeIdempotencyKeyRef,
      deps: {
        claimQuote,
        getQuote,
        submitClaimedQuoteContact,
        createIdempotencyKey,
        getAttributionSnapshot
      }
    });

    expect(result.finalizedDuringLoad).toBe(true);
    expect(result.quote.status).toBe('in_review');
    expect(result.quote.contactPending).toBe(false);
    expect(claimQuote).toHaveBeenCalledWith('Q-ABC12345', 'token-123');
    expect(getQuote).toHaveBeenCalledTimes(2);
    expect(submitClaimedQuoteContact).toHaveBeenCalledWith(
      'Q-ABC12345',
      { attribution: { utmSource: 'google' } },
      'quote-confirmation-key',
      'token-123'
    );
    expect(finalizeIdempotencyKeyRef.current).toBeNull();
  });

  it('skips auto-finalize when the quote is already in review', async () => {
    const claimQuote = vi.fn().mockResolvedValue({ ok: true });
    const getQuote = vi.fn().mockResolvedValue(
      createQuote({
        contactPending: false,
        status: 'in_review',
        submittedAt: '2026-04-16T12:05:00.000Z'
      })
    );
    const submitClaimedQuoteContact = vi.fn();

    const result = await loadQuoteConfirmation({
      quoteId: 'Q-ABC12345',
      authToken: 'token-123',
      finalizeIdempotencyKeyRef: { current: null },
      deps: {
        claimQuote,
        getQuote,
        submitClaimedQuoteContact,
        createIdempotencyKey: vi.fn().mockReturnValue('unused-key'),
        getAttributionSnapshot: vi.fn().mockReturnValue({})
      }
    });

    expect(result.finalizedDuringLoad).toBe(false);
    expect(result.quote.status).toBe('in_review');
    expect(getQuote).toHaveBeenCalledTimes(1);
    expect(submitClaimedQuoteContact).not.toHaveBeenCalled();
  });
});
