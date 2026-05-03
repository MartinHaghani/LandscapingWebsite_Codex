import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LegalAgreementCheckbox, LegalDocumentLinks } from '../components/legal/LegalAgreementCheckbox';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError } from '../lib/api';
import { trackAnalyticsEvent } from '../lib/analytics';
import { formatNumber } from '../lib/geometry';
import { legalAcceptancePayload, legalDocumentSlugs } from '../lib/legalAcceptance';
import type { PaymentLinkResponse, QuotePaymentStatus } from '../types';

interface PublicQuotePaymentContentProps {
  paymentLink: PaymentLinkResponse | null;
  loading: boolean;
  error: string | null;
  checkoutError: string | null;
  checkoutLoading: boolean;
  legalAccepted: boolean;
  returnStatus: string | null;
  onLegalAcceptedChange: (accepted: boolean) => void;
  onCheckout: () => void;
}

const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const statusCopy: Record<QuotePaymentStatus, { title: string; body: string }> = {
  awaiting_payment: {
    title: 'Ready for payment',
    body: 'Review the approved quote and continue to Stripe Checkout when you are ready.'
  },
  checkout_created: {
    title: 'Checkout started',
    body: 'A Stripe Checkout session is ready. You can reopen it if you closed the payment tab.'
  },
  paid: {
    title: 'Payment complete',
    body: 'Stripe has confirmed payment for this approved quote.'
  },
  subscription_scheduled: {
    title: 'Weekly payments scheduled',
    body: 'Your weekly per-visit payments are set up and will begin on the seasonal start date.'
  },
  subscription_active: {
    title: 'Weekly payments active',
    body: 'Your weekly per-visit billing is active for this approved quote.'
  },
  past_due: {
    title: 'Payment needs attention',
    body: 'Stripe reported a failed weekly payment. Please retry checkout or contact Autoscape.'
  },
  failed: {
    title: 'Payment failed',
    body: 'Stripe could not complete this payment. Please try again.'
  },
  canceled: {
    title: 'Payment canceled',
    body: 'The payment setup was canceled. Contact Autoscape if you need a new payment link.'
  }
};

const isTerminalPaidStatus = (status: QuotePaymentStatus) =>
  status === 'paid' || status === 'subscription_scheduled' || status === 'subscription_active';

export const PublicQuotePaymentContent = ({
  paymentLink,
  loading,
  error,
  checkoutError,
  checkoutLoading,
  legalAccepted,
  returnStatus,
  onLegalAcceptedChange,
  onCheckout
}: PublicQuotePaymentContentProps) => {
  const paymentStatus = paymentLink?.payment.status ?? 'awaiting_payment';
  const copy = statusCopy[paymentStatus];
  const isPerVisit = paymentLink?.payment.mode === 'per_session_subscription';
  const paymentAmount = paymentLink ? paymentLink.payment.amount : 0;
  const ctaLabel = isPerVisit ? 'Start weekly payments' : 'Pay seasonal total';
  const ctaDisabled =
    !paymentLink ||
    checkoutLoading ||
    !legalAccepted ||
    isTerminalPaidStatus(paymentStatus) ||
    paymentStatus === 'canceled';

  const returnMessage = useMemo(() => {
    if (returnStatus === 'success') {
      return 'Stripe is confirming the payment. This page updates once the secure webhook is received.';
    }

    if (returnStatus === 'canceled') {
      return 'Checkout was canceled before payment was completed.';
    }

    return null;
  }, [returnStatus]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-20">
      <section className="space-y-8">
        <div className="rounded-[1.75rem] bg-[#111813] px-5 py-7 text-white shadow-soft md:rounded-none md:px-10 md:py-10">
          <p className="text-xs font-semibold uppercase text-[#9fd8b0]">Approved Quote Payment</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">
                Complete payment for your approved quote.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 md:text-base">
                Review the final Autoscape quote details below, then continue through secure Stripe Checkout.
              </p>
            </div>

            <Link to="/" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">
                Back to Autoscape
              </Button>
            </Link>
          </div>
        </div>

        <div>
          {loading ? <p className="text-sm text-copy-muted">Loading approved quote...</p> : null}
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          {paymentLink ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-5">
                {returnMessage ? (
                  <Card className="border-brand/30 bg-[#eef8f1] p-5">
                    <p className="text-sm font-semibold text-ink">{returnMessage}</p>
                  </Card>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">
                      {isPerVisit ? 'Weekly Per Visit' : 'Seasonal Payment'}
                    </p>
                    <p className="mt-3 font-display text-4xl font-bold text-ink">
                      {formatCurrency(paymentAmount, paymentLink.payment.currency)}
                    </p>
                    <p className="mt-2 text-sm text-copy-muted">
                      {isPerVisit
                        ? `Charged weekly, capped at ${paymentLink.payment.maxBillableVisits ?? paymentLink.quote.sessionsMax} visits`
                        : `${paymentLink.quote.sessionsMax} approved weekly visits paid upfront`}
                    </p>
                  </Card>

                  <Card className="bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">Payment Status</p>
                    <p className="mt-3 font-display text-3xl font-bold text-ink">{copy.title}</p>
                    <p className="mt-2 text-sm leading-6 text-copy-muted">{copy.body}</p>
                  </Card>
                </div>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">Approved quote summary</h2>
                  <div className="mt-4 space-y-3 text-sm text-copy-muted">
                    <p>
                      Quote ID: <span className="font-semibold text-brand">{paymentLink.quote.id}</span>
                    </p>
                    <p>Address: {paymentLink.quote.address}</p>
                    <p>Area: {formatNumber(paymentLink.quote.metrics.areaM2)} m²</p>
                    <p>Perimeter: {formatNumber(paymentLink.quote.metrics.perimeterM)} m</p>
                    <p>Season schedule: Weekly, {paymentLink.quote.sessionsMax} visits from May to September</p>
                    {paymentLink.quote.verifiedAt ? (
                      <p>Approved: {new Date(paymentLink.quote.verifiedAt).toLocaleString()}</p>
                    ) : null}
                  </div>
                </Card>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">
                    {isPerVisit ? 'Weekly billing terms' : 'Seasonal payment terms'}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-copy-muted">
                    {isPerVisit
                      ? 'Stripe will set up weekly per-visit billing. If you pay before May 1, the first charge starts on May 1. If you pay after May 1, the first charge starts at checkout. Billing stops after the approved visit count and no later than September 30.'
                      : 'Stripe will collect the approved discounted seasonal total once. The amount shown here is the final approved quote total for payment.'}
                  </p>
                  <div className="mt-5">
                    <LegalAgreementCheckbox
                      id="public-payment-legal-acceptance"
                      checked={legalAccepted}
                      onChange={onLegalAcceptedChange}
                      documentSlugs={legalDocumentSlugs.paymentCheckout}
                    >
                      I have read and agree to the <LegalDocumentLinks documentSlugs={legalDocumentSlugs.paymentCheckout} />.
                    </LegalAgreementCheckbox>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={onCheckout} disabled={ctaDisabled} className="w-full sm:w-auto">
                      {checkoutLoading ? 'Opening Stripe...' : ctaLabel}
                    </Button>
                    <a href="mailto:contact@autoscape.ca" className="w-full sm:w-auto">
                      <Button variant="secondary" className="w-full sm:w-auto">
                        Contact Autoscape
                      </Button>
                    </a>
                  </div>
                  {checkoutError ? <p className="mt-4 text-sm font-medium text-red-700">{checkoutError}</p> : null}
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="overflow-hidden bg-surface p-0">
                  {paymentLink.quote.approvedQuotePreviewImageUrl ? (
                    <img
                      src={paymentLink.quote.approvedQuotePreviewImageUrl}
                      alt={`Approved quote preview for ${paymentLink.quote.address}`}
                      className="block h-auto w-full"
                    />
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center bg-[#f5f8f5] px-6 text-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">Preview unavailable</p>
                        <p className="mt-2 text-sm text-copy-muted">
                          The approved quote pricing is still available on this page.
                        </p>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">Secure payment</h2>
                  <p className="mt-3 text-sm leading-7 text-copy-muted">
                    Payment is processed by Stripe. Autoscape does not store card details on this website.
                  </p>
                </Card>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export const PublicQuotePaymentPage = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [paymentLink, setPaymentLink] = useState<PaymentLinkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPaymentLink = async () => {
      if (!token) {
        setError('Missing payment link token.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await api.getPaymentLink(token);
        if (mounted) {
          setPaymentLink(result);
          trackAnalyticsEvent('payment.link_viewed', {
            step: 'payment',
            quoteId: result.quote.id,
            properties: {
              paymentMode: result.payment.mode,
              status: result.payment.status
            }
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof ApiError ? err.message : 'Unable to load payment link.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPaymentLink();

    return () => {
      mounted = false;
    };
  }, [token]);

  const startCheckout = async () => {
    if (!token) {
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);
    if (paymentLink) {
      trackAnalyticsEvent('payment.checkout_started', {
        step: 'payment',
        quoteId: paymentLink.quote.id,
        properties: {
          paymentMode: paymentLink.payment.mode,
          amount: paymentLink.payment.amount
        }
      });
    }
    try {
      const result = await api.createPaymentCheckout(token, {
        legalAcceptance: legalAcceptancePayload
      });
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : 'Unable to open Stripe Checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <PublicQuotePaymentContent
      paymentLink={paymentLink}
      loading={loading}
      error={error}
      checkoutError={checkoutError}
      checkoutLoading={checkoutLoading}
      legalAccepted={legalAccepted}
      returnStatus={searchParams.get('status')}
      onLegalAcceptedChange={setLegalAccepted}
      onCheckout={startCheckout}
    />
  );
};
