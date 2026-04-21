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
    <div className="mx-auto w-full max-w-4xl px-4 py-14 md:px-8 md:py-20">
      <Card className="bg-surface p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-ink">Quote Details</h1>
          <Link to="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>

        {loading ? <p className="mt-4 text-sm text-copy-muted">Loading quote...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        {quote ? (
          <div className="mt-6 space-y-3 text-sm text-copy-muted">
            <p>
              Quote ID: <span className="text-brand">{quote.id}</span>
            </p>
            <p>Address: {quote.address}</p>
            <p>Plan: {quote.plan}</p>
            <p>Status: {quote.status}</p>
            <p>Customer status: {quote.customerStatus}</p>
            <p>Area: {formatNumber(quote.metrics.areaM2)} m²</p>
            <p>Perimeter: {formatNumber(quote.metrics.perimeterM)} m</p>
            <p>Season schedule: Weekly, {quote.sessionsMax} visits from May to September</p>
            <p>Per-visit estimate: ${quote.perSessionTotal.toFixed(2)}</p>
            <p>
              Seasonal discounted total: ${quote.seasonalDiscountedTotal.toFixed(2)} (
              {(quote.seasonalDiscountRate * 100).toFixed(0)}% off)
            </p>
            <p>Full season price: ${quote.fullSeasonTotal.toFixed(2)} · Savings: ${quote.seasonalSavingsTotal.toFixed(2)}</p>
            <p>Billing mode: {quote.billingMode === 'seasonal' ? 'Seasonal (charged once)' : 'Per visit'}</p>
            <p>Created: {new Date(quote.createdAt).toLocaleString()}</p>
            {quote.submittedAt ? <p>Submitted: {new Date(quote.submittedAt).toLocaleString()}</p> : null}
            {quote.verifiedAt ? <p>Approved: {new Date(quote.verifiedAt).toLocaleString()}</p> : null}
            {quote.paymentPageUrl ? (
              <div className="pt-2">
                <Link to={quote.paymentPageUrl.replace(/^https?:\/\/[^/]+/, '')}>
                  <Button>Open Payment Page</Button>
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};
