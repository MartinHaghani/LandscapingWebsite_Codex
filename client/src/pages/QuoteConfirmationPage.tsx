import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api, ApiError } from '../lib/api';
import { formatNumber } from '../lib/geometry';

interface QuoteResult {
  id: string;
  createdAt: string;
  address: string;
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  quoteTotal: number;
}

export const QuoteConfirmationPage = () => {
  const { quoteId } = useParams();
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteId) {
      setError('Missing quote ID.');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.getQuote(quoteId);
        setQuote(response);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load quote.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [quoteId]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-16 md:px-8 md:py-24">
      <Card className="bg-black/75 p-8">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Quote Requested</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-white">Instant Quote Confirmation</h1>

        {loading ? <p className="mt-6 text-sm text-white/70">Loading quote details...</p> : null}
        {error ? <p className="mt-6 text-sm text-red-300">{error}</p> : null}

        {quote ? (
          <div className="mt-8 space-y-4 text-sm text-white/80">
            <p>
              Quote ID: <span className="font-semibold text-brand">{quote.id}</span>
            </p>
            <p>Address: {quote.address}</p>
            <p>Plan: {quote.plan}</p>
            <p>Area: {formatNumber(quote.metrics.areaM2)} m²</p>
            <p>Perimeter: {formatNumber(quote.metrics.perimeterM)} m</p>
            <p>Estimated Total: ${quote.quoteTotal.toFixed(2)}</p>
            <p>Submitted: {new Date(quote.createdAt).toLocaleString()}</p>
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
