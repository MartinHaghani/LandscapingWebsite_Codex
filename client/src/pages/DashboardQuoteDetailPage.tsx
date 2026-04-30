import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { normalizeAccountQuote, type NormalizedAccountQuote } from '../lib/accountQuote';
import { api, ApiError } from '../lib/api';
import { hasRequiredPhone } from '../lib/accountProfile';
import { formatNumber } from '../lib/geometry';

export const DashboardQuoteDetailPage = () => {
  const { quoteId } = useParams();
  const location = useLocation();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quote, setQuote] = useState<NormalizedAccountQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError('Sign in to view this quote.');
      setLoading(false);
      return;
    }

    if (!profileHasRequiredPhone) {
      setError('Phone number is required to view this quote.');
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
        setError(err instanceof ApiError ? err.message : 'Unable to load quote details.');
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

  if (isLoaded && !isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectPath}`} replace />;
  }

  if (isLoaded && isSignedIn && !profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/complete-profile?redirect_url=${redirectPath}`} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8 md:py-20">
      <Card className="bg-surface p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-ink">Quote Details</h1>
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {loading ? <p className="mt-4 text-sm text-copy-muted">Loading quote...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        {quote ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-lg border border-stroke bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">
                Active property
              </p>
              <h2 className="mt-2 text-xl font-semibold leading-snug text-ink">{quote.address}</h2>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                Quote ID: {quote.id}
              </p>
            </section>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ['Plan', quote.plan],
                ['Status', quote.status],
                ['Customer status', quote.customerStatus],
                ['Area', `${formatNumber(quote.metrics.areaM2)} m²`],
                ['Perimeter', `${formatNumber(quote.metrics.perimeterM)} m`],
                ['Season schedule', `Weekly, ${quote.sessionsMax} visits from May to September`],
                ['Per-visit estimate', `$${quote.perSessionTotal.toFixed(2)}`],
                [
                  'Seasonal discounted total',
                  `$${quote.seasonalDiscountedTotal.toFixed(2)} (${(quote.seasonalDiscountRate * 100).toFixed(0)}% off)`
                ],
                [
                  'Full season price',
                  `$${quote.fullSeasonTotal.toFixed(2)} · Savings: $${quote.seasonalSavingsTotal.toFixed(2)}`
                ],
                [
                  'Billing mode',
                  quote.billingMode === 'seasonal' ? 'Seasonal (charged once)' : 'Per visit'
                ],
                ['Created', new Date(quote.createdAt).toLocaleString()],
                ...(quote.submittedAt
                  ? ([['Submitted', new Date(quote.submittedAt).toLocaleString()]] as const)
                  : []),
                ...(quote.verifiedAt
                  ? ([['Approved', new Date(quote.verifiedAt).toLocaleString()]] as const)
                  : [])
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-stroke bg-surface-raised px-4 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-copy-soft">
                    {label}
                  </dt>
                  <dd className="mt-1 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            {quote.paymentPageUrl ? (
              <div className="pt-2">
                <Link
                  to={quote.paymentPageUrl.replace(/^https?:\/\/[^/]+/, '')}
                  className="block w-full sm:inline-block sm:w-auto"
                >
                  <Button className="w-full sm:w-auto">Open Payment Page</Button>
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};
