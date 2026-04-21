import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PaymentLinkResponse } from '../types';
import { PublicQuotePaymentContent } from './PublicQuotePaymentPage';

const basePaymentLink: PaymentLinkResponse = {
  quote: {
    id: 'Q-APPROVED1',
    address: '123 Greenway Blvd, Vaughan, ON',
    metrics: {
      areaM2: 420,
      perimeterM: 96
    },
    serviceFrequency: 'weekly',
    billingMode: 'seasonal',
    sessionsMin: 20,
    sessionsMax: 20,
    perSessionTotal: 72.5,
    seasonalTotalMin: 1450,
    seasonalTotalMax: 1450,
    fullSeasonTotal: 1450,
    seasonalDiscountedTotal: 1160,
    seasonalSavingsTotal: 290,
    seasonalDiscountRate: 0.2,
    verifiedAt: '2026-04-16T15:15:00.000Z',
    approvedQuotePreviewImageUrl: '/api/approved-quote-preview/token-123'
  },
  payment: {
    mode: 'seasonal_payment',
    status: 'awaiting_payment',
    amountCents: 116000,
    amount: 1160,
    currency: 'CAD',
    recurringInterval: null,
    maxBillableVisits: null,
    paidInvoiceCount: 0,
    seasonStartAt: null,
    seasonEndAt: null,
    checkoutExpiresAt: null
  }
};

const renderPayment = (paymentLink: PaymentLinkResponse, returnStatus: string | null = null) =>
  renderToStaticMarkup(
    <StaticRouter location="/pay/test-token">
      <PublicQuotePaymentContent
        paymentLink={paymentLink}
        loading={false}
        error={null}
        checkoutError={null}
        checkoutLoading={false}
        returnStatus={returnStatus}
        onCheckout={vi.fn()}
      />
    </StaticRouter>
  );

describe('PublicQuotePaymentPage', () => {
  it('renders a public seasonal payment page without sign-in copy', () => {
    const markup = renderPayment(basePaymentLink);

    expect(markup).toContain('Complete payment for your approved quote.');
    expect(markup).toContain('Seasonal Payment');
    expect(markup).toContain('$1,160.00');
    expect(markup).toContain('Pay seasonal total');
    expect(markup).toContain('Q-APPROVED1');
    expect(markup).toContain('/api/approved-quote-preview/token-123');
    expect(markup).not.toContain('Sign in');
  });

  it('renders per-visit subscription terms and active states', () => {
    const perVisit: PaymentLinkResponse = {
      ...basePaymentLink,
      quote: {
        ...basePaymentLink.quote,
        billingMode: 'per_session'
      },
      payment: {
        ...basePaymentLink.payment,
        mode: 'per_session_subscription',
        status: 'subscription_active',
        amountCents: 7250,
        amount: 72.5,
        recurringInterval: 'week',
        maxBillableVisits: 20,
        paidInvoiceCount: 1,
        seasonStartAt: '2026-05-01T04:00:00.000Z',
        seasonEndAt: '2026-10-01T03:59:59.000Z'
      }
    };

    const markup = renderPayment(perVisit, 'success');

    expect(markup).toContain('Weekly Per Visit');
    expect(markup).toContain('$72.50');
    expect(markup).toContain('Weekly payments active');
    expect(markup).toContain('Billing stops after the approved visit count');
    expect(markup).toContain('Stripe is confirming the payment');
  });

  it('renders expired token errors without a payment card', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/pay/test-token">
        <PublicQuotePaymentContent
          paymentLink={null}
          loading={false}
          error="This payment link is no longer active."
          checkoutError={null}
          checkoutLoading={false}
          returnStatus={null}
          onCheckout={vi.fn()}
        />
      </StaticRouter>
    );

    expect(markup).toContain('This payment link is no longer active.');
    expect(markup).not.toContain('Pay seasonal total');
  });
});
