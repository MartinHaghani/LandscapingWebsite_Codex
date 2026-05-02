import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { LegalAgreementCheckbox, LegalDocumentLinks } from '../components/legal/LegalAgreementCheckbox';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { hasRequiredPhone } from '../lib/accountProfile';
import { ApiError } from '../lib/api';
import { legalDocumentSlugs } from '../lib/legalAcceptance';
import { getQuoteConfirmationRedirect, loadQuoteConfirmation } from '../lib/quoteConfirmationFlow';
import type { BillingMode } from '../types';

interface QuoteResult {
  id: string;
  createdAt: string;
  address: string;
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  serviceFrequency: 'weekly';
  billingMode: BillingMode;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  fullSeasonTotal: number;
  seasonalDiscountedTotal: number;
  seasonalSavingsTotal: number;
  seasonalDiscountRate: number;
  quoteTotal: number;
  status: string;
  contactPending: boolean;
  submittedAt: string | null;
}

const toMoney = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toRate = (value: number | undefined, fallback = 0.2) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

interface QuoteConfirmationContentProps {
  quote: QuoteResult | null;
  loading: boolean;
  finalizing: boolean;
  error: string | null;
  customerEmail: string | null;
}

export const QuoteConfirmationContent = ({
  quote,
  loading,
  finalizing,
  error,
  customerEmail
}: QuoteConfirmationContentProps) => {
  const confirmationDestination = customerEmail ?? 'the email on your account';
  const dashboardTarget = quote ? `/dashboard/quotes/${quote.id}` : '/dashboard';

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(50,159,91,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,244,238,0.45))]"
      />
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center px-4 py-10 md:px-8 md:py-16">
        <section className="w-full rounded-[1.75rem] border border-stroke bg-surface px-5 py-7 shadow-soft md:rounded-[2.25rem] md:px-10 md:py-10 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">Instant Quote Confirmation</p>

              <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold leading-tight text-ink md:text-6xl">
                Your quote is in review.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-8 text-copy-muted md:text-lg">
                You are done. The next email from us will contain your final confirmation and payment options once the
                Autoscape team completes review.
              </p>

              {quote ? <p className="mt-4 text-xs uppercase tracking-[0.14em] text-copy-soft">Quote ID: {quote.id}</p> : null}

              {loading ? (
                <div className="status-info mt-6 max-w-xl">
                  {finalizing ? 'Sending your quote to our review queue...' : 'Preparing your confirmation...'}
                </div>
              ) : null}
              {error ? (
                <div className="status-error mt-6 max-w-xl">
                  {error} You can revisit this quote from your dashboard if you need to return later.
                </div>
              ) : null}

              <Link
                to={dashboardTarget}
                className="mt-6 inline-flex text-sm font-semibold text-copy-muted underline underline-offset-4 hover:text-brand"
              >
                View quote in dashboard
              </Link>
            </div>

            <div className="border-l-0 border-stroke lg:border-l lg:pl-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand">What happens next</h2>
              <div className="mt-5 space-y-4 text-sm leading-7 text-copy-muted">
                <p>
                  Your submission has been received and is now with the Autoscape team.
                </p>
                <p>
                  We will review your quote within <strong className="font-semibold text-ink">24 hours</strong>.
                </p>
                <p>
                  Final confirmation and payment options will be sent to{' '}
                  <strong className="font-semibold text-ink">{confirmationDestination}</strong>.
                </p>
                <p className="text-xs leading-6 text-copy-soft">
                  If you do not see the email by then, check your spam or junk folder.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const QuoteConfirmationPage = () => {
  const { quoteId } = useParams();
  const location = useLocation();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [legalChecked, setLegalChecked] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalizeIdempotencyKeyRef = useRef<string | null>(null);
  const profileHasRequiredPhone = hasRequiredPhone(user);
  const customerEmail = user?.primaryEmailAddress?.emailAddress ?? null;

  useEffect(() => {
    if (!quoteId || !isLoaded || !isSignedIn || !profileHasRequiredPhone || !legalAccepted) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setFinalizing(false);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        const result = await loadQuoteConfirmation({
          quoteId,
          authToken: token,
          finalizeIdempotencyKeyRef,
          onFinalizeStart: () => {
            if (mounted) {
              setFinalizing(true);
            }
          }
        });

        if (!mounted) {
          return;
        }

        const quoteResponse = result.quote;
        const perSessionTotal = toMoney(quoteResponse.perSessionTotal);
        const fullSeasonTotal = toMoney(quoteResponse.fullSeasonTotal, toMoney(quoteResponse.seasonalTotalMax));
        const seasonalDiscountRate = toRate(quoteResponse.seasonalDiscountRate);
        const seasonalDiscountedTotal = toMoney(
          quoteResponse.seasonalDiscountedTotal,
          Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2))
        );
        const seasonalSavingsTotal = toMoney(
          quoteResponse.seasonalSavingsTotal,
          Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2))
        );

        setQuote({
          ...quoteResponse,
          billingMode: quoteResponse.billingMode === 'per_session' ? 'per_session' : 'seasonal',
          perSessionTotal,
          seasonalTotalMin: toMoney(quoteResponse.seasonalTotalMin, fullSeasonTotal),
          seasonalTotalMax: toMoney(quoteResponse.seasonalTotalMax, fullSeasonTotal),
          fullSeasonTotal,
          seasonalDiscountRate,
          seasonalDiscountedTotal,
          seasonalSavingsTotal
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof ApiError ? err.message : 'Unable to load quote.');
      } finally {
        if (mounted) {
          setFinalizing(false);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [quoteId, isLoaded, isSignedIn, profileHasRequiredPhone, legalAccepted, getToken]);

  if (!quoteId) {
    return <Navigate to="/instant-quote" replace />;
  }

  const redirectTarget = getQuoteConfirmationRedirect({
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    hasRequiredPhone: profileHasRequiredPhone,
    quoteId,
    locationPath: location.pathname,
    locationSearch: location.search
  });

  if (redirectTarget) {
    return <Navigate to={redirectTarget} replace />;
  }

  if (!legalAccepted) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8 md:py-20">
        <Card className="space-y-6 bg-surface p-5 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-brand">Claim Quote</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
              Review the quote terms to continue
            </h1>
            <p className="mt-3 text-sm leading-6 text-copy-muted">
              Autoscape will attach this quote to your account and submit it to the review queue.
            </p>
          </div>

          <LegalAgreementCheckbox
            id="quote-claim-legal-acceptance"
            checked={legalChecked}
            onChange={setLegalChecked}
            documentSlugs={legalDocumentSlugs.quoteClaim}
          >
            I have read and agree to the <LegalDocumentLinks documentSlugs={legalDocumentSlugs.quoteClaim} />.
          </LegalAgreementCheckbox>

          <Button
            type="button"
            disabled={!legalChecked}
            className="w-full sm:w-auto"
            onClick={() => setLegalAccepted(true)}
          >
            Claim Quote
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <QuoteConfirmationContent
      quote={quote}
      loading={loading}
      finalizing={finalizing}
      error={error}
      customerEmail={customerEmail}
    />
  );
};
