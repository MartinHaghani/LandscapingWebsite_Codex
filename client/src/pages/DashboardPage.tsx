import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError } from '../lib/api';
import { hasRequiredPhone } from '../lib/accountProfile';
import type { AccountQuoteListItem } from '../types';

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toMoney = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const DashboardPage = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();
  const [quotes, setQuotes] = useState<AccountQuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileHasRequiredPhone = hasRequiredPhone(user);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !profileHasRequiredPhone) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadQuotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        const response = await api.getAccountQuotes(token);
        if (!mounted) {
          return;
        }
        setQuotes(response.items);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load account quotes.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadQuotes();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, getToken, profileHasRequiredPhone]);

  if (isLoaded && !isSignedIn) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="space-y-5 bg-surface p-8">
          <h1 className="text-3xl font-semibold text-ink">Sign in to access your dashboard</h1>
          <div className="flex flex-wrap gap-3">
            <Link to="/sign-in">
              <Button>Sign In</Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="secondary">Create Account</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoaded && isSignedIn && !profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="space-y-5 bg-surface p-8">
          <h1 className="text-3xl font-semibold text-ink">Phone number required</h1>
          <p className="text-sm text-copy-muted">Add your phone number to unlock dashboard access.</p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/complete-profile?redirect_url=${redirectPath}`}>
              <Button>Complete Profile</Button>
            </Link>
            <Link to="/instant-quote">
              <Button variant="secondary">Back to quote builder</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-surface p-6 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Account</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Welcome back</h1>
          <p className="mt-3 text-sm text-copy-muted">
            {user?.fullName ?? 'Autoscape Customer'} · {user?.primaryEmailAddress?.emailAddress ?? 'No email on file'}
          </p>
        </Card>
        <Card className="bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Quotes</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{quotes.length}</p>
          <p className="mt-1 text-sm text-copy-muted">Quotes linked to your account</p>
        </Card>
      </div>

      <Card className="mt-6 bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Your Quotes</h2>
          <Link to="/instant-quote">
            <Button variant="secondary">Create New Quote</Button>
          </Link>
        </div>

        {loading ? <p className="mt-4 text-sm text-copy-muted">Loading quotes...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        {!loading && !error && quotes.length === 0 ? (
          <p className="mt-4 text-sm text-copy-muted">No quotes yet. Build your first instant quote to get started.</p>
        ) : null}

        {!loading && quotes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {quotes.map((quote) => (
              <Link key={quote.id} to={`/dashboard/quotes/${quote.id}`}>
                <article className="rounded-xl border border-stroke bg-surface p-4 transition-colors hover:border-brand/70">
                  <p className="text-xs uppercase tracking-[0.12em] text-brand">{quote.id}</p>
                  <p className="mt-2 text-sm text-copy-muted">{quote.address}</p>
                  {(() => {
                    const perSessionTotal = toMoney(quote.perSessionTotal);
                    const fullSeasonTotal = toMoney(
                      quote.seasonalTotalMax,
                      toMoney(quote.fullSeasonTotal, perSessionTotal)
                    );
                    const seasonalDiscountedTotal =
                      typeof quote.seasonalDiscountedTotal === 'number' && Number.isFinite(quote.seasonalDiscountedTotal)
                        ? quote.seasonalDiscountedTotal
                        : fullSeasonTotal;

                    return (
                      <p className="mt-1 text-sm text-copy-muted">
                        Status: {formatStatus(quote.status)} · Per session ${perSessionTotal.toFixed(2)} · Seasonal $
                        {seasonalDiscountedTotal.toFixed(2)}
                      </p>
                    );
                  })()}
                </article>
              </Link>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Billing</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">Placeholder</h3>
          <p className="mt-2 text-sm text-copy-muted">Billing portal and payment management are coming soon.</p>
        </Card>
        <Card className="bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Messages</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">Placeholder</h3>
          <p className="mt-2 text-sm text-copy-muted">In-app messaging with the Autoscape team is coming soon.</p>
        </Card>
      </div>
    </div>
  );
};
