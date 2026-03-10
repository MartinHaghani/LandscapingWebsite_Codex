import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { getAttributionSnapshot } from '../lib/attribution';

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  addressText: '',
  message: ''
};

export const QuoteContactPage = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
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
    () =>
      form.name.trim().length >= 2 &&
      form.email.trim().includes('@') &&
      form.phone.trim().length >= 7 &&
      !submitting,
    [form, submitting]
  );

  useEffect(() => {
    if (!quoteId) {
      return;
    }

    let mounted = true;

    const loadQuote = async () => {
      setLoadingQuote(true);
      setError(null);

      try {
        const result = await api.getQuote(quoteId);
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
  }, [quoteId]);

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
      await api.submitQuoteContact(
        quoteId,
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          addressText: form.addressText.trim() || undefined,
          message: form.message.trim() || undefined,
          attribution: getAttributionSnapshot()
        },
        createIdempotencyKey()
      );

      navigate(`/quote-confirmation/${quoteId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to finalize quote contact details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-20">
      <Card className="space-y-6 bg-black/70 p-7 md:p-10">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand">Quote Contact</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Finalize your instant quote request</h1>
          <p className="mt-3 text-sm text-white/75">
            One final step. Add your contact details so our team can verify and manage your quote.
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
                <label htmlFor="quote-name" className="mb-2 block text-sm text-white/80">
                  Full name
                </label>
                <input
                  id="quote-name"
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label htmlFor="quote-email" className="mb-2 block text-sm text-white/80">
                  Email
                </label>
                <input
                  id="quote-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

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
                <Button variant="secondary" type="button">
                  Back to Quote Tool
                </Button>
              </Link>
            </div>
          </form>
        ) : null}

        {!loadingQuote && !quote && !error ? (
          <p className="text-sm text-white/70">Quote not found. Please create a new quote draft.</p>
        ) : null}

        {error && !quote ? <p className="text-sm text-red-300">{error}</p> : null}
      </Card>
    </div>
  );
};
