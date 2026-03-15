import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError } from '../lib/api';
import { hasRequiredPhone } from '../lib/accountProfile';
import { formatNumber } from '../lib/geometry';
import type { QuoteLookupResponse } from '../types';

export const DashboardQuoteDetailPage = () => {
  const { quoteId } = useParams();
  const location = useLocation();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [quote, setQuote] = useState<QuoteLookupResponse | null>(null);
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
        setQuote(result);
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
      <Card className="bg-black/70 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-white">Quote Details</h1>
          <Link to="/dashboard">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>

        {loading ? <p className="mt-4 text-sm text-white/70">Loading quote...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {quote ? (
          <div className="mt-6 space-y-3 text-sm text-white/80">
            <p>
              Quote ID: <span className="text-brand">{quote.id}</span>
            </p>
            <p>Address: {quote.address}</p>
            <p>Plan: {quote.plan}</p>
            <p>Status: {quote.status}</p>
            <p>Area: {formatNumber(quote.metrics.areaM2)} m²</p>
            <p>Perimeter: {formatNumber(quote.metrics.perimeterM)} m</p>
            <p>
              Cadence: {quote.serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} ({quote.sessionsMin}-{quote.sessionsMax}{' '}
              sessions)
            </p>
            <p>Per-session estimate: ${quote.perSessionTotal.toFixed(2)}</p>
            <p>
              Seasonal estimate: ${quote.seasonalTotalMin.toFixed(2)} - ${quote.seasonalTotalMax.toFixed(2)}
            </p>
            <p>Created: {new Date(quote.createdAt).toLocaleString()}</p>
            {quote.submittedAt ? <p>Submitted: {new Date(quote.submittedAt).toLocaleString()}</p> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};
