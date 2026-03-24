import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { hasRequiredPhone } from '../lib/accountProfile';
import { getAttributionSnapshot } from '../lib/attribution';

const defaultForm = {
  message: ''
};

const toMoney = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toRate = (value: number | undefined, fallback = 0.2) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export const QuoteContactPage = () => {
  const { quoteId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [form, setForm] = useState(defaultForm);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<{
    id: string;
    address: string;
    serviceFrequency: 'weekly' | 'biweekly';
    billingMode: 'seasonal' | 'per_session';
    perSessionTotal: number;
    sessionsMin: number;
    sessionsMax: number;
    seasonalTotalMin: number;
    seasonalTotalMax: number;
    fullSeasonTotal: number;
    seasonalDiscountedTotal: number;
    seasonalSavingsTotal: number;
    seasonalDiscountRate: number;
    plan: string;
    contactPending: boolean;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profileHasRequiredPhone = hasRequiredPhone(user);
  const canSubmit = !submitting;

  useEffect(() => {
    if (!quoteId || !isLoaded) {
      return;
    }

    if (!isSignedIn || !profileHasRequiredPhone) {
      setLoadingQuote(false);
      return;
    }

    let mounted = true;
    const loadQuote = async () => {
      setLoadingQuote(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        await api.claimQuote(quoteId, token);
        const result = await api.getQuote(quoteId, token);
        if (!mounted) {
          return;
        }

        const perSessionTotal = toMoney(result.perSessionTotal);
        const fullSeasonTotal = toMoney(result.fullSeasonTotal, toMoney(result.seasonalTotalMax));
        const seasonalDiscountRate = toRate(result.seasonalDiscountRate);
        const seasonalDiscountedTotal = toMoney(
          result.seasonalDiscountedTotal,
          Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2))
        );
        const seasonalSavingsTotal = toMoney(
          result.seasonalSavingsTotal,
          Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2))
        );

        setQuote({
          id: result.id,
          address: result.address,
          serviceFrequency: result.serviceFrequency,
          billingMode: result.billingMode === 'per_session' ? 'per_session' : 'seasonal',
          perSessionTotal,
          sessionsMin: result.sessionsMin,
          sessionsMax: result.sessionsMax,
          seasonalTotalMin: toMoney(result.seasonalTotalMin, fullSeasonTotal),
          seasonalTotalMax: toMoney(result.seasonalTotalMax, fullSeasonTotal),
          fullSeasonTotal,
          seasonalDiscountedTotal,
          seasonalSavingsTotal,
          seasonalDiscountRate,
          plan: result.plan,
          contactPending: result.contactPending,
          status: result.status
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof ApiError ? err.message : 'Unable to load quote details.');
      } finally {
        if (mounted) {
          setLoadingQuote(false);
        }
      }
    };

    void loadQuote();

    return () => {
      mounted = false;
    };
  }, [quoteId, isLoaded, isSignedIn, getToken, profileHasRequiredPhone]);

  if (!quoteId) {
    return <Navigate to="/instant-quote" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Authentication is required.', 401);
      }

      await api.submitClaimedQuoteContact(
        quoteId,
        {
          message: form.message.trim() || undefined,
          attribution: getAttributionSnapshot()
        },
        createIdempotencyKey(),
        token
      );

      navigate(`/quote-confirmation/${quoteId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to finalize quote contact details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="space-y-6 bg-surface p-7 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-brand">Account Required</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
              Sign in or create an account to finalize your quote
            </h1>
            <p className="mt-3 text-sm text-copy-muted">
              Your draft quote is saved. Continue after signing in.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={`/sign-in?redirect_url=${redirectPath}`}>
              <Button>Sign In</Button>
            </Link>
            <Link to={`/sign-up?redirect_url=${redirectPath}`}>
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
        <Card className="space-y-6 bg-surface p-7 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-brand">Phone Number Required</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">Add your phone number to continue</h1>
            <p className="mt-3 text-sm text-copy-muted">
              Your account must include a phone number before finalizing quotes.
            </p>
          </div>
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
    <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-20">
      <Card className="space-y-6 bg-surface p-7 md:p-10">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand">Quote Contact</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">Finalize your instant quote request</h1>
          <p className="mt-3 text-sm text-copy-muted">
            One final step. We use your account profile for name, email, and phone, and your quote draft address.
          </p>
          <p className="mt-2 text-xs text-copy-muted">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? 'your account'}
          </p>
        </div>

        {loadingQuote ? <p className="text-sm text-copy-muted">Loading quote details...</p> : null}

        {quote ? (
          <Card className="border-stroke bg-surface">
            <p className="text-sm text-copy-muted">Quote ID: {quote.id}</p>
            <p className="mt-2 text-sm text-copy-muted">Address: {quote.address}</p>
            <p className="mt-2 text-sm text-copy-muted">Plan: {quote.plan}</p>
            <p className="mt-2 text-sm text-copy-muted">
              Cadence: {quote.serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} ({quote.sessionsMin}-{quote.sessionsMax}{' '}
              sessions)
            </p>
            <p className="mt-2 text-sm text-copy-muted">
              Per-session estimate: ${quote.perSessionTotal.toFixed(2)} · Full season: $
              {quote.fullSeasonTotal.toFixed(2)}
            </p>
            <p className="mt-2 text-sm text-copy-muted">
              Seasonal discounted total: ${quote.seasonalDiscountedTotal.toFixed(2)} (
              {(quote.seasonalDiscountRate * 100).toFixed(0)}% off, save ${quote.seasonalSavingsTotal.toFixed(2)})
            </p>
            <p className="mt-2 text-sm text-copy-muted">
              Selected billing mode: {quote.billingMode === 'seasonal' ? 'Seasonal (charged once)' : 'Per session'}
            </p>
            <p className="mt-2 text-sm text-copy-muted">Status: {quote.status}</p>

            {!quote.contactPending ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`/quote-confirmation/${quote.id}`}>
                  <Button>View confirmation</Button>
                </Link>
                <Link to="/instant-quote">
                  <Button variant="secondary">Create another quote</Button>
                </Link>
              </div>
            ) : null}
          </Card>
        ) : null}

        {quote && quote.contactPending ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="quote-message" className="form-label">
                Notes (optional)
              </label>
              <textarea
                id="quote-message"
                rows={4}
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="form-input min-h-[120px]"
                placeholder="Access notes, scheduling constraints, or anything else we should know."
              />
            </div>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? 'Finalizing...' : 'Finalize Quote Request'}
              </Button>
              <Link to="/instant-quote">
                <Button type="button" variant="secondary">
                  Back to quote builder
                </Button>
              </Link>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
};
