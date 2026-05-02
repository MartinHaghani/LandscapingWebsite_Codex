import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QuoteStaticPreview } from '../components/quote/QuoteStaticPreview';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { hasRequiredPhone } from '../lib/accountProfile';
import { api } from '../lib/api';
import { formatNumber } from '../lib/geometry';
import type { BillingMode, LngLat, QuoteLookupResponse, QuotePolygonSource } from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const normalizeQuoteId = (value: string) => value.trim().toUpperCase();

const getPreviewCenter = (polygonSource: QuotePolygonSource | null | undefined): LngLat => {
  const points = polygonSource?.polygons.flatMap((polygon) => polygon.ringPoints) ?? [];
  if (points.length === 0) {
    return [-79.51962, 43.844147];
  }

  const totals = points.reduce(
    (accumulator, [lng, lat]) => {
      accumulator.lng += lng;
      accumulator.lat += lat;
      return accumulator;
    },
    { lng: 0, lat: 0 }
  );

  return [totals.lng / points.length, totals.lat / points.length];
};

const getSafeClaimPath = (quoteId: string) => `/claim-quote?quoteId=${encodeURIComponent(quoteId)}`;

export const ClaimQuoteLegalNotice = () => (
  <p className="mt-4 text-xs leading-6 text-white/58">
    By claiming or continuing with this quote, you agree to the{' '}
    <Link to="/legal/terms-of-service" className="font-semibold text-white underline underline-offset-4">
      Terms
    </Link>{' '}
    and acknowledge the{' '}
    <Link to="/legal/privacy-policy" className="font-semibold text-white underline underline-offset-4">
      Privacy Policy
    </Link>{' '}
    and{' '}
    <Link
      to="/legal/refund-cancellation-payment-policy"
      className="font-semibold text-white underline underline-offset-4"
    >
      Payment Policy
    </Link>
    .
  </p>
);

export const ClaimQuotePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const quoteIdParam = searchParams.get('quoteId');
  const initialQuoteId = normalizeQuoteId(quoteIdParam ?? '');
  const [quoteIdInput, setQuoteIdInput] = useState(initialQuoteId);
  const [preview, setPreview] = useState<QuoteLookupResponse | null>(null);
  const [billingMode, setBillingMode] = useState<BillingMode>('seasonal');
  const [claimed, setClaimed] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quoteId = preview?.id ?? normalizeQuoteId(quoteIdInput);
  const claimPath = quoteId ? getSafeClaimPath(quoteId) : location.pathname + location.search;
  const encodedRedirect = encodeURIComponent(claimPath);
  const previewCenter = useMemo(() => getPreviewCenter(preview?.polygonSource), [preview?.polygonSource]);
  const hasPhone = hasRequiredPhone(user);
  const fullSeasonTotal = preview?.fullSeasonTotal ?? preview?.seasonalTotalMax ?? 0;
  const seasonalDiscountRate = preview?.seasonalDiscountRate ?? 0.2;
  const seasonalDiscountedTotal =
    preview?.seasonalDiscountedTotal ?? Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2));
  const seasonalSavingsTotal =
    preview?.seasonalSavingsTotal ?? Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2));

  const loadPreview = useCallback(async (nextQuoteId: string) => {
    const normalized = normalizeQuoteId(nextQuoteId);
    if (!normalized) {
      setError('Enter a Quote ID.');
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setClaimed(false);
    try {
      const response = await api.getQuotePreview(normalized);
      setPreview(response);
      setBillingMode(response.billingMode === 'per_session' ? 'per_session' : 'seasonal');
      setQuoteIdInput(response.id);
      if (quoteIdParam !== response.id) {
        navigate(getSafeClaimPath(response.id), { replace: true });
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Unable to load that quote.');
    } finally {
      setLoadingPreview(false);
    }
  }, [navigate, quoteIdParam]);

  useEffect(() => {
    if (initialQuoteId) {
      void loadPreview(initialQuoteId);
    }
  }, [initialQuoteId, loadPreview]);

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadPreview(quoteIdInput);
  };

  const claimQuote = async () => {
    if (!preview || !isSignedIn || !hasPhone) {
      return;
    }

    setClaiming(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sign in again to claim this quote.');
      }
      await api.claimQuote(preview.id, token, { legalAcceptance: { accepted: true } });
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim this quote.');
    } finally {
      setClaiming(false);
    }
  };

  const continueToPayment = async () => {
    if (!preview || !isSignedIn || !hasPhone) {
      return;
    }

    setContinuing(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sign in again to continue.');
      }
      if (!claimed) {
        await api.claimQuote(preview.id, token, { legalAcceptance: { accepted: true } });
      }
      await api.updateAccountQuoteBillingMode(preview.id, billingMode, token);
      navigate(`/dashboard/quotes/${encodeURIComponent(preview.id)}/payment`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue to payment.');
    } finally {
      setContinuing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.45fr)]">
        <section className="space-y-5">
          <div className="rounded-lg border border-stroke bg-surface px-5 py-5 shadow-soft md:px-7">
            <p className="eyebrow">Claim Quote</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Open your Autoscape quote</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-copy-muted">
                  Enter the Quote ID from Autoscape to review the approved service area and choose billing.
                </p>
              </div>
              {preview ? (
                <div className="rounded-lg border border-brand/25 bg-brand/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-brand">Quote ID</p>
                  <p className="font-display text-2xl font-bold text-ink">{preview.id}</p>
                </div>
              ) : null}
            </div>
          </div>

          <Card className="rounded-lg bg-surface p-5 md:p-6">
            <form onSubmit={handleLookup} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label>
                <span className="form-label">Quote ID</span>
                <input
                  value={quoteIdInput}
                  onChange={(event) => setQuoteIdInput(normalizeQuoteId(event.target.value))}
                  className="form-input font-semibold uppercase"
                  placeholder="Q-..."
                />
              </label>
              <Button type="submit" disabled={loadingPreview} className="self-end rounded-lg">
                {loadingPreview ? 'Loading...' : 'Preview quote'}
              </Button>
            </form>
            {error ? <p className="mt-4 status-error">{error}</p> : null}
          </Card>

          {preview ? (
            <div className="grid gap-5">
              {preview.polygonSource ? (
                <QuoteStaticPreview
                  token={MAPBOX_TOKEN}
                  center={previewCenter}
                  polygons={preview.polygonSource.polygons}
                  selectedPolygonId={preview.polygonSource.activePolygonId}
                  address={preview.address}
                  className="rounded-lg"
                />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-lg bg-surface-raised p-5">
                  <p className="text-xs font-semibold uppercase text-copy-soft">Per visit</p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{formatCurrency(preview.perSessionTotal)}</p>
                </Card>
                <Card className="rounded-lg bg-surface-raised p-5">
                  <p className="text-xs font-semibold uppercase text-copy-soft">Seasonal total</p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{formatCurrency(seasonalDiscountedTotal)}</p>
                </Card>
                <Card className="rounded-lg bg-surface-raised p-5">
                  <p className="text-xs font-semibold uppercase text-copy-soft">Area</p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{formatNumber(preview.metrics.areaM2)} m2</p>
                </Card>
                <Card className="rounded-lg bg-surface-raised p-5">
                  <p className="text-xs font-semibold uppercase text-copy-soft">Perimeter</p>
                  <p className="mt-2 font-display text-3xl font-bold text-ink">{formatNumber(preview.metrics.perimeterM)} m</p>
                </Card>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {preview ? (
            <>
              <Card className="rounded-lg bg-surface p-5">
                <p className="text-xs font-semibold uppercase text-copy-soft">Quote Summary</p>
                <div className="mt-4 space-y-3 text-sm text-copy-muted">
                  <p>
                    Address: <span className="font-semibold text-ink">{preview.address}</span>
                  </p>
                  <p>
                    Schedule: <span className="font-semibold text-ink">Weekly, {preview.sessionsMax} visits</span>
                  </p>
                  <p>
                    Full season: <span className="font-semibold text-ink">{formatCurrency(fullSeasonTotal)}</span>
                  </p>
                  <p>
                    Seasonal discount:{' '}
                    <span className="font-semibold text-ink">
                      {(seasonalDiscountRate * 100).toFixed(0)}% ({formatCurrency(seasonalSavingsTotal)} saved)
                    </span>
                  </p>
                </div>
              </Card>

              <Card className="rounded-lg bg-surface p-5">
                <p className="text-xs font-semibold uppercase text-copy-soft">Billing</p>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left ${
                      billingMode === 'seasonal' ? 'border-brand bg-brand/10' : 'border-stroke bg-surface'
                    }`}
                    onClick={() => setBillingMode('seasonal')}
                  >
                    <span className="block text-sm font-semibold text-ink">Seasonal</span>
                    <span className="mt-1 block text-sm text-copy-muted">
                      {formatCurrency(seasonalDiscountedTotal)} paid once.
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-left ${
                      billingMode === 'per_session' ? 'border-brand bg-brand/10' : 'border-stroke bg-surface'
                    }`}
                    onClick={() => setBillingMode('per_session')}
                  >
                    <span className="block text-sm font-semibold text-ink">Per visit</span>
                    <span className="mt-1 block text-sm text-copy-muted">
                      {formatCurrency(preview.perSessionTotal)} weekly, capped at {preview.sessionsMax} visits.
                    </span>
                  </button>
                </div>
              </Card>

              <Card className="rounded-lg bg-[#101713] p-5 text-white">
                {!isLoaded ? <p className="text-sm text-white/75">Checking account...</p> : null}
                {isLoaded && !isSignedIn ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-white/78">Sign up or sign in to attach this quote to your account.</p>
                    <Link to={`/sign-up?redirect_url=${encodedRedirect}`}>
                      <Button className="w-full rounded-lg">Create account</Button>
                    </Link>
                    <Link to={`/sign-in?redirect_url=${encodedRedirect}`}>
                      <Button variant="secondary" className="w-full rounded-lg">
                        Sign in
                      </Button>
                    </Link>
                  </div>
                ) : null}
                {isLoaded && isSignedIn && !hasPhone ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-white/78">Add a phone number before claiming and paying for this quote.</p>
                    <Link to={`/complete-profile?redirect_url=${encodedRedirect}`}>
                      <Button className="w-full rounded-lg">Complete profile</Button>
                    </Link>
                  </div>
                ) : null}
                {isLoaded && isSignedIn && hasPhone ? (
                  <div className="space-y-3">
                    <Button onClick={claimQuote} disabled={claiming || claimed} className="w-full rounded-lg">
                      {claimed ? 'Quote claimed' : claiming ? 'Claiming...' : 'Claim quote'}
                    </Button>
                    <Button
                      onClick={continueToPayment}
                      disabled={continuing}
                      variant={claimed ? 'primary' : 'secondary'}
                      className="w-full rounded-lg"
                    >
                      {continuing ? 'Opening payment...' : 'Continue to payment'}
                    </Button>
                  </div>
                ) : null}
                <ClaimQuoteLegalNotice />
              </Card>
            </>
          ) : (
            <Card className="rounded-lg bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Ready when you have the ID.</p>
              <p className="mt-2 text-sm leading-6 text-copy-muted">
                The Quote ID starts with Q-. The direct link from Autoscape can prefill it automatically.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
};
