import { useAuth, useUser } from '@clerk/clerk-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { QuotePlanCard } from '../components/quote/QuotePlanCard';
import { QuoteStaticPreview } from '../components/quote/QuoteStaticPreview';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { hasRequiredPhone } from '../lib/accountProfile';
import { api } from '../lib/api';
import { formatNumber } from '../lib/geometry';
import { legalAcceptancePayload } from '../lib/legalAcceptance';
import {
  formatEasyQuoteCode,
  normalizeEasyQuoteCodeInput,
  normalizeQuoteIdForLookup
} from '../lib/quoteId';
import type { BillingMode, LngLat, QuoteLookupResponse, QuotePolygonSource } from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;
const EASY_CODE_LENGTH = 6;

const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const getBillingModeFromParam = (value: string | null): BillingMode | null =>
  value === 'seasonal' || value === 'per_session' ? value : null;

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

const getSafeClaimPath = (quoteId: string, billingMode: BillingMode, continueCheckout = false) => {
  const params = new URLSearchParams({
    quoteId,
    billing: billingMode
  });

  if (continueCheckout) {
    params.set('continue', 'checkout');
  }

  return `/claim-quote?${params.toString()}`;
};

export const ClaimQuoteLegalNotice = () => (
  <p className="text-xs leading-6 text-copy-muted">
    By continuing, you agree to the{' '}
    <Link to="/legal/terms-of-service" className="font-semibold text-brand underline underline-offset-4">
      Terms
    </Link>
    , acknowledge the{' '}
    <Link to="/legal/privacy-policy" className="font-semibold text-brand underline underline-offset-4">
      Privacy Policy
    </Link>
    , and accept the{' '}
    <Link
      to="/legal/refund-cancellation-payment-policy"
      className="font-semibold text-brand underline underline-offset-4"
    >
      Payment Policy
    </Link>
    .
  </p>
);

interface QuoteCodeInputProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const QuoteCodeInput = ({ value, disabled = false, onChange }: QuoteCodeInputProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const characters = Array.from({ length: EASY_CODE_LENGTH }, (_, index) => value[index] ?? '');

  const focusInput = (index: number) => {
    window.requestAnimationFrame(() => {
      inputRefs.current[index]?.focus();
      inputRefs.current[index]?.select();
    });
  };

  const setCharacters = (nextCharacters: string[]) => {
    onChange(nextCharacters.join('').slice(0, EASY_CODE_LENGTH));
  };

  const fillFromIndex = (startIndex: number, rawValue: string) => {
    const normalized = normalizeEasyQuoteCodeInput(rawValue);
    if (!normalized) {
      return;
    }

    const nextCharacters = [...characters];
    const effectiveStart = normalized.length >= EASY_CODE_LENGTH ? 0 : startIndex;
    normalized.split('').forEach((character, offset) => {
      const nextIndex = effectiveStart + offset;
      if (nextIndex < EASY_CODE_LENGTH) {
        nextCharacters[nextIndex] = character;
      }
    });
    setCharacters(nextCharacters);
    focusInput(Math.min(effectiveStart + normalized.length, EASY_CODE_LENGTH - 1));
  };

  const clearIndex = (index: number) => {
    const nextCharacters = [...characters];
    nextCharacters[index] = '';
    setCharacters(nextCharacters);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (!nextValue) {
      clearIndex(index);
      return;
    }

    fillFromIndex(index, nextValue);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (characters[index]) {
        clearIndex(index);
        return;
      }

      const previousIndex = Math.max(index - 1, 0);
      clearIndex(previousIndex);
      focusInput(previousIndex);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      clearIndex(index);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusInput(Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusInput(Math.min(index + 1, EASY_CODE_LENGTH - 1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusInput(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusInput(EASY_CODE_LENGTH - 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillFromIndex(index, event.clipboardData.getData('text'));
  };

  return (
    <div>
      <label className="form-label" htmlFor="quote-code-0">
        Quote ID
      </label>
      <div className="mt-2 flex items-center justify-center gap-3 sm:justify-start">
        {[0, 1].map((groupIndex) => (
          <div key={groupIndex} className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((groupOffset) => {
              const index = groupIndex * 3 + groupOffset;
              return (
                <input
                  key={index}
                  ref={(node) => {
                    inputRefs.current[index] = node;
                  }}
                  id={`quote-code-${index}`}
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Quote ID character ${index + 1}`}
                  value={characters[index]}
                  disabled={disabled}
                  maxLength={1}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => handleChange(index, event)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={(event) => handlePaste(index, event)}
                  className="h-14 w-12 rounded-lg border border-stroke bg-surface text-center font-display text-2xl font-bold uppercase text-ink shadow-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16 sm:w-14 sm:text-3xl"
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-copy-soft">
        Enter the six-character code from Autoscape, shown like {formatEasyQuoteCode('ABC123')}.
      </p>
    </div>
  );
};

export const ClaimQuotePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const quoteIdParam = searchParams.get('quoteId');
  const initialQuoteId = normalizeQuoteIdForLookup(quoteIdParam ?? '');
  const billingParam = getBillingModeFromParam(searchParams.get('billing'));
  const shouldAutoCheckout = searchParams.get('continue') === 'checkout';
  const [quoteIdInput, setQuoteIdInput] = useState(
    initialQuoteId.length === EASY_CODE_LENGTH ? normalizeEasyQuoteCodeInput(initialQuoteId) : ''
  );
  const [preview, setPreview] = useState<QuoteLookupResponse | null>(null);
  const [billingMode, setBillingMode] = useState<BillingMode>(billingParam ?? 'seasonal');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoCheckoutStartedRef = useRef(false);

  const quoteId = preview?.id ?? normalizeQuoteIdForLookup(quoteIdInput);
  const redirectPath = preview
    ? getSafeClaimPath(preview.id, billingMode, true)
    : location.pathname + location.search;
  const encodedRedirect = encodeURIComponent(redirectPath);
  const previewCenter = useMemo(() => getPreviewCenter(preview?.polygonSource), [preview?.polygonSource]);
  const hasPhone = hasRequiredPhone(user);
  const fullSeasonTotal = preview?.fullSeasonTotal ?? preview?.seasonalTotalMax ?? 0;
  const seasonalDiscountRate = preview?.seasonalDiscountRate ?? 0.2;
  const seasonalDiscountedTotal =
    preview?.seasonalDiscountedTotal ?? Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2));
  const seasonalSavingsTotal =
    preview?.seasonalSavingsTotal ?? Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2));
  const visitsThisSeasonLabel = `${preview?.sessionsMax ?? 20} visits this season`;
  const seasonalPrice = formatCurrency(seasonalDiscountedTotal);
  const perVisitPrice = formatCurrency(preview?.perSessionTotal ?? 0);
  const regularSeasonPrice = formatCurrency(fullSeasonTotal);
  const savingsPrice = formatCurrency(seasonalSavingsTotal);

  const loadPreview = useCallback(
    async (nextQuoteId: string) => {
      const normalized = normalizeQuoteIdForLookup(nextQuoteId);
      if (!normalized) {
        setError('Enter your six-character Quote ID.');
        return;
      }

      setLoadingPreview(true);
      setError(null);
      try {
        const response = await api.getQuotePreview(normalized);
        const nextBillingMode =
          billingParam ?? (response.billingMode === 'per_session' ? 'per_session' : 'seasonal');
        const nextPath = getSafeClaimPath(response.id, nextBillingMode, shouldAutoCheckout);

        setPreview(response);
        setBillingMode(nextBillingMode);
        setQuoteIdInput(response.id.length === EASY_CODE_LENGTH ? normalizeEasyQuoteCodeInput(response.id) : '');

        if (`${location.pathname}${location.search}` !== nextPath) {
          navigate(nextPath, { replace: true });
        }
      } catch (err) {
        setPreview(null);
        setError(err instanceof Error ? err.message : 'Unable to load that quote.');
      } finally {
        setLoadingPreview(false);
      }
    },
    [billingParam, location.pathname, location.search, navigate, shouldAutoCheckout]
  );

  const startCheckout = useCallback(async () => {
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

      await api.claimQuote(preview.id, token, { legalAcceptance: legalAcceptancePayload });
      await api.updateAccountQuoteBillingMode(preview.id, billingMode, token);
      const result = await api.createAccountQuoteCheckout(preview.id, token, {
        legalAcceptance: legalAcceptancePayload
      });
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open Stripe Checkout.');
      autoCheckoutStartedRef.current = false;
    } finally {
      setContinuing(false);
    }
  }, [billingMode, getToken, hasPhone, isSignedIn, preview]);

  useEffect(() => {
    if (initialQuoteId) {
      void loadPreview(initialQuoteId);
    }
  }, [initialQuoteId, loadPreview]);

  useEffect(() => {
    if (!shouldAutoCheckout) {
      autoCheckoutStartedRef.current = false;
      return;
    }

    if (
      autoCheckoutStartedRef.current ||
      !preview ||
      !isLoaded ||
      !isSignedIn ||
      !hasPhone ||
      continuing
    ) {
      return;
    }

    autoCheckoutStartedRef.current = true;
    void startCheckout();
  }, [continuing, hasPhone, isLoaded, isSignedIn, preview, shouldAutoCheckout, startCheckout]);

  const handleBillingModeChange = (nextMode: BillingMode) => {
    setBillingMode(nextMode);
    if (preview) {
      navigate(getSafeClaimPath(preview.id, nextMode, shouldAutoCheckout), { replace: true });
    }
  };

  const handleContinue = async () => {
    if (!preview) {
      await loadPreview(quoteIdInput);
      return;
    }

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      navigate(`/sign-up?redirect_url=${encodedRedirect}`);
      return;
    }

    if (!hasPhone) {
      navigate(`/complete-profile?redirect_url=${encodedRedirect}`);
      return;
    }

    await startCheckout();
  };

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleContinue();
  };

  const continueDisabled =
    loadingPreview ||
    continuing ||
    (!preview && quoteIdInput.length < EASY_CODE_LENGTH) ||
    (preview !== null && !isLoaded);
  const continueLabel = loadingPreview
    ? 'Loading...'
    : continuing
      ? 'Opening Stripe...'
      : 'Continue';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <section className="space-y-7">
        <div className="rounded-lg border border-stroke bg-surface px-5 py-5 shadow-soft md:px-7">
          <p className="eyebrow">Claim Quote</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Open your Autoscape quote</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-copy-muted">
                Review the approved service area, choose billing, and continue to secure payment.
              </p>
            </div>
            {preview ? (
              <div className="rounded-lg border border-brand/25 bg-brand/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-brand">Quote ID</p>
                <p className="font-display text-2xl font-bold text-ink">
                  {quoteId.length === EASY_CODE_LENGTH ? formatEasyQuoteCode(quoteId) : quoteId}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {!preview ? (
          <Card className="mx-auto max-w-xl rounded-lg bg-surface p-5 md:p-6">
            <form onSubmit={handleCodeSubmit} className="space-y-5">
              <QuoteCodeInput
                value={quoteIdInput}
                disabled={loadingPreview}
                onChange={(nextValue) => {
                  setQuoteIdInput(nextValue);
                  setError(null);
                }}
              />
              {error ? <p className="status-error">{error}</p> : null}
              <div className="space-y-3">
                <Button type="submit" disabled={continueDisabled} className="min-h-[56px] w-full text-base">
                  {continueLabel}
                </Button>
                <ClaimQuoteLegalNotice />
              </div>
            </form>
          </Card>
        ) : (
          <div className="space-y-7">
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <div className="space-y-5">
                <Card className="rounded-lg bg-surface p-5 md:p-6">
                  <p className="text-xs font-semibold uppercase text-brand">Quote summary</p>
                  <h2 className="mt-2 text-3xl font-semibold text-ink">Your approved quote is ready</h2>
                  <div className="mt-5 grid gap-4 text-sm text-copy-muted sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-copy-soft">Service address</p>
                      <p className="mt-1 font-medium leading-6 text-ink">{preview.address}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-copy-soft">Schedule</p>
                      <p className="mt-1 font-medium text-ink">Weekly, {preview.sessionsMax} visits</p>
                    </div>
                    <div>
                      <p className="font-semibold text-copy-soft">Area</p>
                      <p className="mt-1 font-medium text-ink">{formatNumber(preview.metrics.areaM2)} m2</p>
                    </div>
                    <div>
                      <p className="font-semibold text-copy-soft">Perimeter</p>
                      <p className="mt-1 font-medium text-ink">{formatNumber(preview.metrics.perimeterM)} m</p>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="rounded-lg bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">Season plan</p>
                    <p className="mt-2 font-display text-3xl font-bold text-ink">{seasonalPrice}</p>
                    <p className="mt-1 text-sm text-copy-muted">
                      after {(seasonalDiscountRate * 100).toFixed(0)}% savings
                    </p>
                  </Card>
                  <Card className="rounded-lg bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">Per visit</p>
                    <p className="mt-2 font-display text-3xl font-bold text-ink">{perVisitPrice}</p>
                    <p className="mt-1 text-sm text-copy-muted">weekly service</p>
                  </Card>
                  <Card className="rounded-lg bg-surface-raised p-5">
                    <p className="text-xs font-semibold uppercase text-copy-soft">Season savings</p>
                    <p className="mt-2 font-display text-3xl font-bold text-brand">{savingsPrice}</p>
                    <p className="mt-1 text-sm text-copy-muted">{visitsThisSeasonLabel}</p>
                  </Card>
                </div>
              </div>

              {preview.polygonSource ? (
                <QuoteStaticPreview
                  token={MAPBOX_TOKEN}
                  center={previewCenter}
                  polygons={preview.polygonSource.polygons}
                  selectedPolygonId={preview.polygonSource.activePolygonId}
                  address={preview.address}
                  className="min-h-[220px] rounded-lg sm:min-h-[240px] lg:min-h-[300px]"
                />
              ) : (
                <Card className="flex min-h-[220px] items-center justify-center rounded-lg bg-surface p-6 text-center text-sm text-copy-muted">
                  Map preview unavailable.
                </Card>
              )}
            </section>

            <section className="space-y-5 border-t border-stroke pt-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-brand">Plans</p>
                  <h2 className="mt-2 text-3xl font-semibold text-ink">Choose how to pay</h2>
                </div>
                <p className="max-w-xl text-sm text-copy-muted">Select one billing option.</p>
              </div>

              <div role="radiogroup" aria-label="Billing plan" className="grid gap-4 lg:grid-cols-2">
                <QuotePlanCard
                  title="Per Season"
                  eyebrow="Best value"
                  badge="Recommended"
                  price={seasonalPrice}
                  priceSuffix="/ season"
                  comparisonPrice={regularSeasonPrice}
                  comparisonLabel="regular season price"
                  savingsText={`Save ${savingsPrice}`}
                  details={[
                    'Full refund up to 24h after your first visit',
                    `${visitsThisSeasonLabel} included in this estimate`
                  ]}
                  selected={billingMode === 'seasonal'}
                  onSelect={() => handleBillingModeChange('seasonal')}
                />
                <QuotePlanCard
                  title="Per Visit"
                  eyebrow="Flexible billing"
                  price={perVisitPrice}
                  priceSuffix="/ visit"
                  comparisonPrice={regularSeasonPrice}
                  comparisonLabel="full season if paid per visit"
                  details={['Pay after each completed visit', 'Cancel anytime']}
                  selected={billingMode === 'per_session'}
                  onSelect={() => handleBillingModeChange('per_session')}
                />
              </div>

              {error ? <p className="status-error">{error}</p> : null}

              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={() => {
                    void handleContinue();
                  }}
                  disabled={continueDisabled}
                  className="min-h-[56px] w-full text-base shadow-[0_18px_36px_-28px_rgba(50,159,91,0.95)]"
                >
                  {continueLabel}
                </Button>
                <ClaimQuoteLegalNotice />
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
};
