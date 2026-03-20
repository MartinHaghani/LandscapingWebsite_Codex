import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api, ApiError } from '../lib/api';
import { formatNumber } from '../lib/geometry';
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
  serviceFrequency: 'weekly' | 'biweekly';
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

export const QuoteConfirmationPage = () => {
  const { quoteId } = useParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }
        const response = await api.getQuote(quoteId, token);
        const perSessionTotal = toMoney(response.perSessionTotal);
        const fullSeasonTotal = toMoney(response.fullSeasonTotal, toMoney(response.seasonalTotalMax));
        const seasonalDiscountRate = toRate(response.seasonalDiscountRate);
        const seasonalDiscountedTotal = toMoney(
          response.seasonalDiscountedTotal,
          Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2))
        );
        const seasonalSavingsTotal = toMoney(
          response.seasonalSavingsTotal,
          Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2))
        );

        setQuote({
          ...response,
          billingMode: response.billingMode === 'per_session' ? 'per_session' : 'seasonal',
          perSessionTotal,
          seasonalTotalMin: toMoney(response.seasonalTotalMin, fullSeasonTotal),
          seasonalTotalMax: toMoney(response.seasonalTotalMax, fullSeasonTotal),
          fullSeasonTotal,
          seasonalDiscountRate,
          seasonalDiscountedTotal,
          seasonalSavingsTotal
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load quote.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [quoteId, isLoaded, isSignedIn, getToken]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-16 md:px-8 md:py-24">
      <Card className="bg-surface p-8">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Quote Requested</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-ink">Instant Quote Confirmation</h1>

        {loading ? <p className="mt-6 text-sm text-copy-muted">Loading quote details...</p> : null}
        {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

        {quote ? (
          <div className="mt-8 space-y-4 text-sm text-copy-muted">
            <p>
              Quote ID: <span className="font-semibold text-brand">{quote.id}</span>
            </p>
            <p>Address: {quote.address}</p>
            <p>Plan: {quote.plan}</p>
            <p>Area: {formatNumber(quote.metrics.areaM2)} m²</p>
            <p>Perimeter: {formatNumber(quote.metrics.perimeterM)} m</p>
            <p>
              Cadence: {quote.serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} ({quote.sessionsMin}-{quote.sessionsMax}{' '}
              sessions)
            </p>
            <p>Per-session estimate: ${quote.perSessionTotal.toFixed(2)}</p>
            <p>
              Seasonal discounted total: ${quote.seasonalDiscountedTotal.toFixed(2)} (
              {(quote.seasonalDiscountRate * 100).toFixed(0)}% off)
            </p>
            <p>Full season price: ${quote.fullSeasonTotal.toFixed(2)} · Savings: ${quote.seasonalSavingsTotal.toFixed(2)}</p>
            <p>Selected billing mode: {quote.billingMode === 'seasonal' ? 'Seasonal (charged once)' : 'Per session'}</p>
            <p>Status: {quote.status}</p>
            <p>Contact finalized: {quote.contactPending ? 'No' : 'Yes'}</p>
            <p>Draft created: {new Date(quote.createdAt).toLocaleString()}</p>
            {quote.submittedAt ? <p>Submitted: {new Date(quote.submittedAt).toLocaleString()}</p> : null}
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/instant-quote">
            <Button>Build Another Quote</Button>
          </Link>
          <Link to="/contact">
            <Button variant="secondary">Contact Autoscape</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
