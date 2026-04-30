import { describe, expect, it } from 'vitest';
import type { AccountQuoteListItem } from '../types';
import {
  getLifecycleStepIndex,
  getQuoteDashboardState,
  isQuoteComplete,
  selectPrimaryDashboardQuote,
  shouldShowQuoteHistory,
  shouldShowQuotePrice
} from './dashboard';

const createQuote = (overrides: Partial<AccountQuoteListItem> = {}): AccountQuoteListItem => ({
  id: 'Q-TEST1',
  createdAt: '2026-04-10T12:00:00.000Z',
  address: '123 Greenway Blvd, Vaughan, ON',
  status: 'in_review',
  customerStatus: 'pending',
  contactPending: false,
  serviceFrequency: 'weekly',
  perSessionTotal: 72.5,
  seasonalTotalMin: 1450,
  seasonalTotalMax: 1450,
  fullSeasonTotal: 1450,
  seasonalDiscountedTotal: 1160,
  seasonalSavingsTotal: 290,
  seasonalDiscountRate: 0.2,
  billingMode: 'seasonal',
  submittedAt: '2026-04-10T12:05:00.000Z',
  verifiedAt: null,
  paymentPageUrl: '/dashboard/quotes/Q-TEST1/payment',
  payment: null,
  ...overrides
});

describe('dashboard helpers', () => {
  it('classifies draft quotes as recovery states and hides price', () => {
    const quote = createQuote({
      status: 'draft',
      contactPending: true,
      submittedAt: null
    });

    expect(getQuoteDashboardState(quote)).toBe('draft');
    expect(getLifecycleStepIndex(quote)).toBe(0);
    expect(shouldShowQuotePrice(quote)).toBe(false);
  });

  it('classifies awaiting payment and payment issue states ahead of in-review quotes', () => {
    const awaitingPayment = createQuote({
      id: 'Q-PAY1',
      customerStatus: 'awaiting_payment',
      status: 'verified',
      verifiedAt: '2026-04-11T14:00:00.000Z',
      payment: {
        mode: 'seasonal_payment',
        status: 'awaiting_payment',
        amountCents: 116000,
        currency: 'CAD',
        recurringInterval: null,
        maxBillableVisits: null,
        paidInvoiceCount: 0,
        seasonStartAt: null,
        seasonEndAt: null,
        checkoutExpiresAt: null
      }
    });
    const inReview = createQuote({
      id: 'Q-REVIEW1',
      createdAt: '2026-04-12T12:00:00.000Z'
    });

    expect(getQuoteDashboardState(awaitingPayment)).toBe('waiting_for_payment');
    expect(selectPrimaryDashboardQuote([inReview, awaitingPayment])?.id).toBe('Q-PAY1');
  });

  it('treats paid and active subscription states as complete', () => {
    const paidSeasonal = createQuote({
      customerStatus: 'verified',
      status: 'verified',
      payment: {
        mode: 'seasonal_payment',
        status: 'paid',
        amountCents: 116000,
        currency: 'CAD',
        recurringInterval: null,
        maxBillableVisits: null,
        paidInvoiceCount: 0,
        seasonStartAt: null,
        seasonEndAt: null,
        checkoutExpiresAt: null
      }
    });
    const activeSubscription = createQuote({
      payment: {
        mode: 'per_session_subscription',
        status: 'subscription_active',
        amountCents: 7250,
        currency: 'CAD',
        recurringInterval: 'week',
        maxBillableVisits: 20,
        paidInvoiceCount: 1,
        seasonStartAt: '2026-05-01T04:00:00.000Z',
        seasonEndAt: '2026-10-01T03:59:59.000Z',
        checkoutExpiresAt: null
      },
      customerStatus: 'verified',
      status: 'verified'
    });

    expect(getQuoteDashboardState(paidSeasonal)).toBe('complete');
    expect(getQuoteDashboardState(activeSubscription)).toBe('complete');
    expect(isQuoteComplete(paidSeasonal)).toBe(true);
  });

  it('only shows quote history when the primary quote is not complete', () => {
    const awaitingPayment = createQuote({
      id: 'Q-PAY2',
      customerStatus: 'awaiting_payment',
      status: 'verified',
      payment: {
        mode: 'seasonal_payment',
        status: 'checkout_created',
        amountCents: 116000,
        currency: 'CAD',
        recurringInterval: null,
        maxBillableVisits: null,
        paidInvoiceCount: 0,
        seasonStartAt: null,
        seasonEndAt: null,
        checkoutExpiresAt: '2026-04-15T15:00:00.000Z'
      }
    });
    const paid = createQuote({
      id: 'Q-PAID2',
      createdAt: '2026-04-13T12:00:00.000Z',
      customerStatus: 'verified',
      status: 'verified',
      payment: {
        mode: 'seasonal_payment',
        status: 'paid',
        amountCents: 116000,
        currency: 'CAD',
        recurringInterval: null,
        maxBillableVisits: null,
        paidInvoiceCount: 0,
        seasonStartAt: null,
        seasonEndAt: null,
        checkoutExpiresAt: null
      }
    });

    expect(shouldShowQuoteHistory([awaitingPayment, paid], awaitingPayment)).toBe(true);
    expect(shouldShowQuoteHistory([paid, createQuote({ id: 'Q-OLD', createdAt: '2026-04-01T10:00:00.000Z' })], paid)).toBe(
      false
    );
  });
});
