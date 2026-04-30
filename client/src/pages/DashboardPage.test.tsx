import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedAccountQuote } from '../lib/accountQuote';
import type { AccountQuoteListItem } from '../types';
import { DashboardPageContent } from './DashboardPage';

const createQuote = (overrides: Partial<AccountQuoteListItem> = {}): AccountQuoteListItem => ({
  id: 'Q-TEST1',
  createdAt: '2026-04-16T12:00:00.000Z',
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
  submittedAt: '2026-04-16T12:05:00.000Z',
  verifiedAt: null,
  paymentPageUrl: '/dashboard/quotes/Q-TEST1/payment',
  payment: null,
  ...overrides
});

const createQuoteDetail = (overrides: Partial<NormalizedAccountQuote> = {}): NormalizedAccountQuote => ({
  id: 'Q-TEST1',
  createdAt: '2026-04-16T12:00:00.000Z',
  address: '123 Greenway Blvd, Vaughan, ON',
  metrics: {
    areaM2: 420,
    perimeterM: 96
  },
  plan: 'Precision Weekly Plan',
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
  status: 'verified',
  customerStatus: 'verified',
  contactPending: false,
  submittedAt: '2026-04-16T12:05:00.000Z',
  verifiedAt: '2026-04-16T15:15:00.000Z',
  paymentPageUrl: '/dashboard/quotes/Q-TEST1/payment',
  approvedQuotePreviewImageUrl: '/api/approved-quote-preview/token-123',
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
  },
  billing: {
    canManageCard: false,
    cardOnFile: null
  },
  ...overrides
});

const renderDashboard = (props: Partial<ComponentProps<typeof DashboardPageContent>> = {}) =>
  renderToStaticMarkup(
    <StaticRouter location="/dashboard">
      <DashboardPageContent
        customerName="Jane Customer"
        customerEmail="jane@example.com"
        quotes={[]}
        primaryQuote={null}
        primaryQuoteDetail={null}
        loading={false}
        error={null}
        primaryQuoteLoading={false}
        primaryQuoteError={null}
        billingPortalLoading={false}
        billingPortalError={null}
        onManageCard={vi.fn()}
        now={new Date('2026-04-28T12:00:00.000Z')}
        {...props}
      />
    </StaticRouter>
  );

describe('DashboardPage', () => {
  it('renders the zero state with get instant quote and no card panel', () => {
    const markup = renderDashboard();

    expect(markup).toContain('Get instant quote');
    expect(markup).toContain('No quotes yet.');
    expect(markup).not.toContain('Card on file');
    expect(markup).not.toContain('Where your quote stands');
  });

  it('renders the draft recovery state without pricing', () => {
    const draftQuote = createQuote({
      status: 'draft',
      customerStatus: 'pending',
      contactPending: true,
      submittedAt: null
    });
    const markup = renderDashboard({
      quotes: [draftQuote],
      primaryQuote: draftQuote
    });

    expect(markup).toContain('Finish submitting your quote');
    expect(markup).toContain('Pricing appears after the quote is fully submitted.');
    expect(markup).toContain('Where your quote stands');
    expect(markup).not.toContain('$1,160.00');
  });

  it('renders waiting-for-payment with quote history when multiple quotes exist', () => {
    const waitingQuote = createQuote({
      id: 'Q-PAY1',
      status: 'verified',
      customerStatus: 'awaiting_payment',
      verifiedAt: '2026-04-17T13:00:00.000Z',
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
      },
      paymentPageUrl: '/dashboard/quotes/Q-PAY1/payment'
    });
    const historyQuote = createQuote({
      id: 'Q-OLD1',
      createdAt: '2026-04-14T12:00:00.000Z'
    });

    const markup = renderDashboard({
      quotes: [waitingQuote, historyQuote],
      primaryQuote: waitingQuote
    });

    expect(markup).toContain('Waiting for payment');
    expect(markup).toContain('Open payment link');
    expect(markup).toContain('Other quotes on this account');
    expect(markup).toContain('Q-OLD1');
  });

  it('renders the all-done state with a saved card summary for paid per-visit plans', () => {
    const paidQuote = createQuote({
      id: 'Q-PAID1',
      status: 'verified',
      customerStatus: 'verified',
      billingMode: 'per_session',
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
      }
    });
    const paidQuoteDetail = createQuoteDetail({
      id: 'Q-PAID1',
      billingMode: 'per_session',
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
      billing: {
        canManageCard: true,
        cardOnFile: {
          brand: 'visa',
          last4: '4242',
          expMonth: 4,
          expYear: 2030
        }
      }
    });

    const markup = renderDashboard({
      quotes: [paidQuote],
      primaryQuote: paidQuote,
      primaryQuoteDetail: paidQuoteDetail
    });

    expect(markup).toContain('All done');
    expect(markup).toContain('Mowing starts the first week of May');
    expect(markup).toContain('$72.50 per visit');
    expect(markup).toContain('Card on file');
    expect(markup).toContain('Visa ending in 4242');
    expect(markup).toContain('Manage card');
    expect(markup).not.toContain('Other quotes on this account');
  });
});
