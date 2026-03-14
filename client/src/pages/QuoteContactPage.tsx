import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { getAttributionSnapshot } from '../lib/attribution';

const defaultForm = {
  phone: '',
  addressText: '',
  message: ''
};

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
    perSessionTotal: number;
    sessionsMin: number;
    sessionsMax: number;
    seasonalTotalMin: number;
    seasonalTotalMax: number;
    plan: string;
    contactPending: boolean;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => form.phone.trim().length >= 7 && !submitting,
    [form.phone, submitting]
  );

  useEffect(() => {
    if (!quoteId || !isLoaded) {
      return;
    }

    if (!isSignedIn) {
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

        setQuote({
          id: result.id,
          address: result.address,
          serviceFrequency: result.serviceFrequency,
          perSessionTotal: result.perSessionTotal,
          sessionsMin: result.sessionsMin,
          sessionsMax: result.sessionsMax,
          seasonalTotalMin: result.seasonalTotalMin,
          seasonalTotalMax: result.seasonalTotalMax,
          plan: result.plan,
          contactPending: result.contactPending,
          status: result.status
        });

        setForm((current) => ({
          ...current,
          addressText: result.address
        }));
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
  }, [quoteId, isLoaded, isSignedIn, getToken]);

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
          phone: form.phone.trim(),
          addressText: form.addressText.trim() || undefined,
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
        <Card className="space-y-6 bg-black/70 p-7 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-brand">Account Required</p>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">
              Sign in or create an account to finalize your quote
            </h1>
            <p className="mt-3 text-sm text-white/75">
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-20">
      <Card className="space-y-6 bg-black/70 p-7 md:p-10">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand">Quote Contact</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Finalize your instant quote request</h1>
          <p className="mt-3 text-sm text-white/75">
            One final step. We use your account profile for name and email.
          </p>
          <p className="mt-2 text-xs text-white/60">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? 'your account'}
          </p>
        </div>

        {loadingQuote ? <p className="text-sm text-white/70">Loading quote details...</p> : null}

        {quote ? (
          <Card className="border-white/20 bg-black/45">
            <p className="text-sm text-white/75">Quote ID: {quote.id}</p>
            <p className="mt-2 text-sm text-white/75">Address: {quote.address}</p>
            <p className="mt-2 text-sm text-white/75">Plan: {quote.plan}</p>
            <p className="mt-2 text-sm text-white/75">
              Cadence: {quote.serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} ({quote.sessionsMin}-{quote.sessionsMax}{' '}
              sessions)
            </p>
            <p className="mt-2 text-sm text-white/75">Per-session estimate: ${quote.perSessionTotal.toFixed(2)}</p>
            <p className="mt-2 text-sm text-white/75">
              Seasonal estimate: ${quote.seasonalTotalMin.toFixed(2)} - ${quote.seasonalTotalMax.toFixed(2)}
            </p>
            <p className="mt-2 text-sm text-white/75">Status: {quote.status}</p>

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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="quote-phone" className="mb-2 block text-sm text-white/80">
                  Phone
                </label>
                <input
                  id="quote-phone"
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                  placeholder="+1 416 000 0000"
                />
              </div>

              <div>
                <label htmlFor="quote-address" className="mb-2 block text-sm text-white/80">
                  Address (optional)
                </label>
                <input
                  id="quote-address"
                  value={form.addressText}
                  onChange={(event) => setForm((current) => ({ ...current, addressText: event.target.value }))}
                  className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                  placeholder="Property address"
                />
              </div>
            </div>

            <div>
              <label htmlFor="quote-message" className="mb-2 block text-sm text-white/80">
                Notes (optional)
              </label>
              <textarea
                id="quote-message"
                rows={4}
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                placeholder="Access notes, scheduling constraints, or anything else we should know."
              />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

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
