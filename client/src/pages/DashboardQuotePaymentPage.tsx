import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
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
}

export const DashboardQuotePaymentContent = ({
  quote,
  loading,
  error
}: DashboardQuotePaymentContentProps) => {
  const quotePath = quote ? `/dashboard/quotes/${quote.id}` : '/dashboard';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <section className="overflow-hidden rounded-[2rem] border border-stroke bg-surface shadow-soft">
        <div className="border-b border-stroke bg-[linear-gradient(135deg,rgba(15,23,18,1),rgba(28,40,33,0.92))] px-6 py-8 text-white md:px-10 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fd8b0]">Approved Quote Payment</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">
                Review the approved quote while payment comes online.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 md:text-base">
                Online payment is not live yet. This page shows the final approved quote details, the reviewed service
                area, and the fastest ways to reach Autoscape while payment setup is completed.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard">
                <Button variant="secondary">Back to Dashboard</Button>
              </Link>
              <Link to={quotePath}>
                <Button>Open Quote Details</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 md:px-10 md:py-10">
          {loading ? <p className="text-sm text-copy-muted">Loading approved quote...</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          {quote ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Per Visit</p>
                    <p className="mt-3 font-display text-4xl font-bold text-ink">
                      ${quote.perSessionTotal.toFixed(2)}
                    </p>
                    <p className="mt-2 text-sm text-copy-muted">Weekly service</p>
                  </Card>

                  <Card className="bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Per Season</p>
                    <p className="mt-3 font-display text-4xl font-bold text-ink">
                      ${quote.seasonalDiscountedTotal.toFixed(2)}
                    </p>
                    <p className="mt-2 text-sm text-copy-muted">
                      ${quote.fullSeasonTotal.toFixed(2)} regular season price · Save ${quote.seasonalSavingsTotal.toFixed(2)}
                    </p>
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
                    Online payment is still being finalized. If you want to move forward right away, contact Autoscape
                    and reference your quote ID. The pricing shown here is the approved reviewed quote.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href="mailto:contact@autoscape.ca">
                      <Button>contact@autoscape.ca</Button>
                    </a>
                    <a href="tel:+14168482841">
                      <Button variant="secondary">+1 (416) 848-2841</Button>
                    </a>
                  </div>
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
                    <div className="flex min-h-[320px] items-center justify-center bg-[radial-gradient(circle_at_top,#eff6f1_0%,#f8faf8_54%,#ffffff_100%)] px-6 text-center">
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

  if (isLoaded && !isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectPath}`} replace />;
  }

  if (isLoaded && isSignedIn && !profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/complete-profile?redirect_url=${redirectPath}`} replace />;
  }

  return <DashboardQuotePaymentContent quote={quote} loading={loading} error={error} />;
};
