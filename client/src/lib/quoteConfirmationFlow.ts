import { api, createIdempotencyKey } from './api';
import { getAttributionSnapshot } from './attribution';
import { legalAcceptancePayload } from './legalAcceptance';
import type { QuoteLookupResponse } from '../types';

const finalizeIdempotencyKeysByQuoteId = new Map<string, string>();

export interface QuoteConfirmationRedirectInput {
  isLoaded: boolean;
  isSignedIn: boolean;
  hasRequiredPhone: boolean;
  quoteId?: string;
  locationPath: string;
  locationSearch: string;
}

export interface QuoteConfirmationRequestDependencies {
  claimQuote: typeof api.claimQuote;
  getQuote: typeof api.getQuote;
  submitClaimedQuoteContact: typeof api.submitClaimedQuoteContact;
  createIdempotencyKey: typeof createIdempotencyKey;
  getAttributionSnapshot: typeof getAttributionSnapshot;
}

export interface LoadQuoteConfirmationInput {
  quoteId: string;
  authToken: string;
  finalizeIdempotencyKeyRef: { current: string | null };
  onFinalizeStart?: () => void;
  deps?: Partial<QuoteConfirmationRequestDependencies>;
}

export interface LoadQuoteConfirmationResult {
  quote: QuoteLookupResponse;
  finalizedDuringLoad: boolean;
}

const defaultDeps: QuoteConfirmationRequestDependencies = {
  claimQuote: api.claimQuote,
  getQuote: api.getQuote,
  submitClaimedQuoteContact: api.submitClaimedQuoteContact,
  createIdempotencyKey,
  getAttributionSnapshot
};

const getRedirectPath = (locationPath: string, locationSearch: string) =>
  encodeURIComponent(`${locationPath}${locationSearch}`);

const getFinalizeIdempotencyKey = (
  quoteId: string,
  finalizeIdempotencyKeyRef: { current: string | null },
  createKey: typeof createIdempotencyKey
) => {
  if (finalizeIdempotencyKeyRef.current) {
    return finalizeIdempotencyKeyRef.current;
  }

  const existing = finalizeIdempotencyKeysByQuoteId.get(quoteId);
  if (existing) {
    finalizeIdempotencyKeyRef.current = existing;
    return existing;
  }

  const next = createKey();
  finalizeIdempotencyKeyRef.current = next;
  finalizeIdempotencyKeysByQuoteId.set(quoteId, next);
  return next;
};

const clearFinalizeIdempotencyKey = (quoteId: string, finalizeIdempotencyKeyRef: { current: string | null }) => {
  finalizeIdempotencyKeysByQuoteId.delete(quoteId);
  finalizeIdempotencyKeyRef.current = null;
};

export const getQuoteConfirmationRedirect = ({
  isLoaded,
  isSignedIn,
  hasRequiredPhone,
  quoteId,
  locationPath,
  locationSearch
}: QuoteConfirmationRedirectInput) => {
  if (!isLoaded || !quoteId) {
    return null;
  }

  const redirectPath = getRedirectPath(locationPath, locationSearch);

  if (!isSignedIn) {
    return `/sign-in?redirect_url=${redirectPath}`;
  }

  if (!hasRequiredPhone) {
    return `/complete-profile?redirect_url=${redirectPath}`;
  }

  return null;
};

export const loadQuoteConfirmation = async ({
  quoteId,
  authToken,
  finalizeIdempotencyKeyRef,
  onFinalizeStart,
  deps
}: LoadQuoteConfirmationInput): Promise<LoadQuoteConfirmationResult> => {
  const resolvedDeps = { ...defaultDeps, ...deps };

  await resolvedDeps.claimQuote(quoteId, authToken, {
    legalAcceptance: legalAcceptancePayload
  });

  let quote = await resolvedDeps.getQuote(quoteId, authToken);
  let finalizedDuringLoad = false;

  if (quote.contactPending) {
    const idempotencyKey = getFinalizeIdempotencyKey(
      quoteId,
      finalizeIdempotencyKeyRef,
      resolvedDeps.createIdempotencyKey
    );

    onFinalizeStart?.();

    await resolvedDeps.submitClaimedQuoteContact(
      quoteId,
      {
        attribution: resolvedDeps.getAttributionSnapshot()
      },
      idempotencyKey,
      authToken
    );

    quote = await resolvedDeps.getQuote(quoteId, authToken);
    finalizedDuringLoad = true;
  }

  if (!quote.contactPending) {
    clearFinalizeIdempotencyKey(quoteId, finalizeIdempotencyKeyRef);
  }

  return {
    quote,
    finalizedDuringLoad
  };
};
