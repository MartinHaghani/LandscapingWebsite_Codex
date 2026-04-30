import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { normalizeAccountQuote, type NormalizedAccountQuote } from '../lib/accountQuote';
import { api, ApiError } from '../lib/api';
import { hasRequiredPhone } from '../lib/accountProfile';
import { formatNumber } from '../lib/geometry';

interface DashboardQuotePaymentContentProps {
  quote: NormalizedAccountQuote | null;
  loading: boolean;
  error: string | null;
  checkoutError: string | null;
  checkoutLoading: boolean;
  returnStatus: string | null;
  onCheckout: () => void;
}

const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const paymentStatusCopy: Record<string, { title: string; body: string }> = {
  awaiting_payment: {
    title: 'Waiting for payment',
    body: 'Continue to Stripe Checkout from this dashboard page or use the secure link from your approval email.'
  },
  checkout_created: {
    title: 'Waiting for payment',
    body: 'Your Stripe Checkout session is ready. You can reopen it if the previous tab was closed.'
  },
  paid: {
    title: 'All done',
    body: 'Stripe has confirmed payment for this approved quote.'
  },
  subscription_scheduled: {
    title: 'All done',
    body: 'Weekly per-visit payments are set up and will begin on the seasonal start date.'
  },
  subscription_active: {
    title: 'All done',
    body: 'Weekly per-visit billing is active for this approved quote.'
  },
  past_due: {
    title: 'Payment needs attention',
    body: 'Stripe reported a failed weekly payment. You can retry checkout or contact Autoscape.'
  },
  failed: {
    title: 'Payment failed',
    body: 'Stripe could not complete this payment. Please try again.'
  },
  canceled: {
    title: 'Payment canceled',
    body: 'The payment setup was canceled. Contact Autoscape if you need a fresh payment link.'
  }
};

const isTerminalPaymentStatus = (status: string) =>
  status === 'paid' || status === 'subscription_scheduled' || status === 'subscription_active';

export const DashboardQuotePaymentContent = ({
  quote,
  loading,
  error,
  checkoutError,
  checkoutLoading,
  returnStatus,
  onCheckout
}: DashboardQuotePaymentContentProps) => {
  const quotePath = quote ? `/dashboard/quotes/${quote.id}` : '/dashboard';
  const paymentStatus = quote?.payment?.status ?? (quote?.customerStatus === 'verified' ? 'paid' : 'awaiting_payment');
  const statusCopy = paymentStatusCopy[paymentStatus] ?? paymentStatusCopy.awaiting_payment;
  const isPerVisit = quote?.billingMode === 'per_session';
  const paymentAmount = quote?.payment?.amountCents
    ? quote.payment.amountCents / 100
    : isPerVisit
      ? quote?.perSessionTotal ?? 0
      : quote?.seasonalDiscountedTotal ?? 0;
  const paymentCurrency = quote?.payment?.currency ?? 'CAD';
  const ctaLabel = isPerVisit ? 'Start weekly payments' : 'Pay seasonal total';
  const ctaDisabled =
    !quote || checkoutLoading || isTerminalPaymentStatus(paymentStatus) || paymentStatus === 'canceled';
  const returnMessage =
    returnStatus === 'success'
      ? 'Stripe is confirming the payment. This page updates once the secure webhook is received.'
      : returnStatus === 'canceled'
        ? 'Checkout was canceled before payment was completed.'
        : null;

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
                Review the final approved quote details, then continue through secure Stripe Checkout.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link to="/dashboard" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full sm:w-auto">
                  Back to Dashboard
                </Button>
              </Link>
              <Link to={quotePath} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Open Quote Details</Button>
              </Link>
            </div>
          </div>
        </div>

        <div>
          {loading ? <p className="text-sm text-copy-muted">Loading approved quote...</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          {quote ? (
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
                      {formatCurrency(paymentAmount, paymentCurrency)}
                    </p>
                    <p className="mt-2 text-sm text-copy-muted">
                      {isPerVisit
                        ? `Charged weekly, capped at ${quote.payment?.maxBillableVisits ?? quote.sessionsMax} visits`
                        : `${quote.sessionsMax} approved weekly visits paid upfront`}
                    </p>
                  </Card>

                  <Card className="bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">Payment Status</p>
                    <p className="mt-3 font-display text-3xl font-bold text-ink">{statusCopy.title}</p>
                    <p className="mt-2 text-sm leading-6 text-copy-muted">{statusCopy.body}</p>
                  </Card>
                </div>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">Approved quote summary</h2>
                  <div className="mt-4 space-y-3 text-sm text-copy-muted">
                    <p>
                      Quote ID: <span className="font-semibold text-brand">{quote.id}</span>
                    </p>
                    <p>Address: {quote.address}</p>
                    <p>Status: {quote.status}</p>
                    <p>Customer status: {quote.customerStatus}</p>
                    <p>Area: {formatNumber(quote.metrics.areaM2)} m²</p>
                    <p>Perimeter: {formatNumber(quote.metrics.perimeterM)} m</p>
                    <p>Season schedule: Weekly, {quote.sessionsMax} visits from May to September</p>
                    {quote.verifiedAt ? <p>Approved: {new Date(quote.verifiedAt).toLocaleString()}</p> : null}
                  </div>
                </Card>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">Payment status</h2>
                  <p className="mt-3 text-sm leading-7 text-copy-muted">
                    {isPerVisit
                      ? 'Stripe will set up weekly per-visit billing. If you pay before May 1, the first charge starts on May 1. If you pay after May 1, the first charge starts at checkout. Billing stops after the approved visit count and no later than September 30.'
                      : 'Stripe will collect the approved discounted seasonal total once. The amount shown here is the final approved quote total for payment.'}
                  </p>
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
                  {quote.approvedQuotePreviewImageUrl ? (
                    <img
                      src={quote.approvedQuotePreviewImageUrl}
                      alt={`Approved quote preview for ${quote.address}`}
                      className="block h-auto w-full"
                    />
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center bg-[#f5f8f5] px-6 text-center">
                      <div>
                        <p className="text-sm font-semibold text-ink">Preview unavailable</p>
                        <p className="mt-2 text-sm text-copy-muted">
                          The approved quote preview is not available right now. The pricing summary above is still the
                          approved reviewed quote.
                        </p>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="bg-surface p-6">
                  <h2 className="text-lg font-semibold text-ink">Area legend</h2>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-copy-muted">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-brand" />
                      Approved service area
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#BFEBCF] ring-1 ring-white" />
                      Added by admin review
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#DC2626]" />
                      Removed by admin review
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-copy-muted">
                    The map highlights how the approved service area changed after the Autoscape team reviewed mowable
                    boundaries, exclusions, and obstacle clearances. Added areas are shown in light green, and removed
                    areas are shown in red.
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

export const DashboardQuotePaymentPage = () => {
  const { quoteId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quote, setQuote] = useState<NormalizedAccountQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const profileHasRequiredPhone = hasRequiredPhone(user);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!quoteId) {
      setError('Missing quote ID.');
      setLoading(false);
      return;
    }

    if (!isSignedIn) {
      setError('Sign in to view this page.');
      setLoading(false);
      return;
    }

    if (!profileHasRequiredPhone) {
      setError('Phone number is required to view this page.');
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadQuote = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        const result = await api.getAccountQuote(quoteId, token);
        if (!mounted) {
          return;
        }

        setQuote(normalizeAccountQuote(result));
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load approved quote.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadQuote();

    return () => {
      mounted = false;
    };
  }, [quoteId, isLoaded, isSignedIn, getToken, profileHasRequiredPhone]);

  const startCheckout = async () => {
    if (!quoteId) {
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Authentication is required.', 401);
      }

      const result = await api.createAccountQuoteCheckout(quoteId, token);
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : 'Unable to open Stripe Checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectPath}`} replace />;
  }

  if (isLoaded && isSignedIn && !profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/complete-profile?redirect_url=${redirectPath}`} replace />;
  }

  return (
    <DashboardQuotePaymentContent
      quote={quote}
      loading={loading}
      error={error}
      checkoutError={checkoutError}
      checkoutLoading={checkoutLoading}
      returnStatus={searchParams.get('status')}
      onCheckout={startCheckout}
    />
  );
};
