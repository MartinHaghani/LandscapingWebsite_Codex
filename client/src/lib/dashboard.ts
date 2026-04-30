import type { AccountQuoteListItem, QuotePaymentStatus } from '../types';

export type DashboardQuoteState = 'draft' | 'in_review' | 'waiting_for_payment' | 'complete';

const terminalPaidStatuses: QuotePaymentStatus[] = ['paid', 'subscription_scheduled', 'subscription_active'];
const paymentActionStatuses: QuotePaymentStatus[] = ['awaiting_payment', 'checkout_created', 'past_due', 'failed', 'canceled'];

export const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

export const getQuoteDashboardState = (quote: AccountQuoteListItem): DashboardQuoteState => {
  if (quote.contactPending || quote.status === 'draft') {
    return 'draft';
  }

  if (quote.payment && terminalPaidStatuses.includes(quote.payment.status)) {
    return 'complete';
  }

  if (quote.payment && paymentActionStatuses.includes(quote.payment.status)) {
    return 'waiting_for_payment';
  }

  if (quote.customerStatus === 'awaiting_payment') {
    return 'waiting_for_payment';
  }

  if (quote.customerStatus === 'verified' && quote.status === 'verified') {
    return 'complete';
  }

  return 'in_review';
};

export const isQuoteComplete = (quote: AccountQuoteListItem) => getQuoteDashboardState(quote) === 'complete';

export const shouldShowQuotePrice = (quote: AccountQuoteListItem) => !quote.contactPending;

export const getPrimaryQuotePriority = (quote: AccountQuoteListItem) => {
  switch (getQuoteDashboardState(quote)) {
    case 'waiting_for_payment':
      return 0;
    case 'in_review':
      return 1;
    case 'draft':
      return 2;
    case 'complete':
    default:
      return 3;
  }
};

export const selectPrimaryDashboardQuote = (quotes: AccountQuoteListItem[]) =>
  [...quotes].sort((left, right) => {
    const priorityDelta = getPrimaryQuotePriority(left) - getPrimaryQuotePriority(right);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0] ?? null;

export const shouldShowQuoteHistory = (
  quotes: AccountQuoteListItem[],
  primaryQuote: AccountQuoteListItem | null
) => quotes.length > 1 && primaryQuote !== null && !isQuoteComplete(primaryQuote);

export const getLifecycleStepIndex = (quote: AccountQuoteListItem) => {
  switch (getQuoteDashboardState(quote)) {
    case 'draft':
      return 0;
    case 'in_review':
      return 1;
    case 'waiting_for_payment':
      return 2;
    case 'complete':
    default:
      return 3;
  }
};

export const getPlanPriceLabel = (quote: AccountQuoteListItem) =>
  quote.billingMode === 'per_session'
    ? `${formatCurrency(quote.perSessionTotal)} per visit`
    : `${formatCurrency(quote.seasonalDiscountedTotal ?? quote.seasonalTotalMax)} per season`;

export const getSeasonReadinessCopy = (quote: AccountQuoteListItem, now = new Date()) => {
  const beforeSeasonStart = now.getMonth() < 4;

  if (getQuoteDashboardState(quote) !== 'complete') {
    return 'Weekly visits run from May through September across the 20-visit season.';
  }

  if (beforeSeasonStart) {
    return 'Mowing starts the first week of May and continues through the September schedule window.';
  }

  return 'Your plan is active for the May-through-September service season.';
};
