import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedAccountQuote } from '../lib/accountQuote';
import { DashboardQuotePaymentContent } from './DashboardQuotePaymentPage';

const quote: NormalizedAccountQuote = {
  id: 'Q-APPROVED1',
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
  status: 'verified',
  customerStatus: 'awaiting_payment',
  contactPending: false,
  submittedAt: '2026-04-16T12:05:00.000Z',
  verifiedAt: '2026-04-16T15:15:00.000Z',
  paymentPageUrl: '/dashboard/quotes/Q-APPROVED1/payment',
  approvedQuotePreviewImageUrl: '/api/approved-quote-preview/token-123',
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
};

const renderPaymentPage = () =>
  renderToStaticMarkup(
    <StaticRouter location="/dashboard/quotes/Q-APPROVED1/payment">
      <DashboardQuotePaymentContent
        quote={quote}
        loading={false}
        error={null}
        checkoutError={null}
        checkoutLoading={false}
        returnStatus={null}
        onCheckout={vi.fn()}
      />
    </StaticRouter>
  );

describe('DashboardQuotePaymentPage', () => {
  it('renders the approved quote dashboard payment detail experience with preview and legend', () => {
    const markup = renderPaymentPage();

    expect(markup).toContain('Approved Quote Payment');
    expect(markup).toContain('Complete payment for your approved quote');
    expect(markup).toContain('Stripe Checkout');
    expect(markup).toContain('Approved quote summary');
    expect(markup).toContain('Seasonal Payment');
    expect(markup).toContain('Ready for payment');
    expect(markup).toContain('Pay seasonal total');
    expect(markup).toContain('Area legend');
    expect(markup).toContain('Approved service area');
    expect(markup).toContain('Added by admin review');
    expect(markup).toContain('Removed by admin review');
    expect(markup).toContain('contact@autoscape.ca');
    expect(markup).toContain('/api/approved-quote-preview/token-123');
    expect(markup).not.toContain('Credit card');
  });
});
