import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { QuoteProgressRail } from '../components/quote/QuoteProgressRail';
import { QuoteStaticPreview } from '../components/quote/QuoteStaticPreview';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { getAttributionSnapshot } from '../lib/attribution';
import { cn } from '../lib/cn';
import { formatNumber, toFt, toFt2 } from '../lib/geometry';
import { computeMultiPolygonMetrics } from '../lib/multiPolygonMetrics';
import { canSubmitQuoteDraft } from '../lib/quoteFlow';
import {
  clearQuoteDraftState,
  loadQuoteDraftState,
  saveQuoteDraftState,
  type QuoteDraftPersistedState
} from '../lib/quoteDraftPersistence';
import { getQuoteTotal, getRecommendedPlan, getSeasonalPricing, quotePricing } from '../lib/quote';
import type { BillingMode, EditablePolygon, LngLat, ServiceFrequency } from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

interface StatusMessage {
  type: 'error' | 'info';
  text: string;
}

interface QuotePlanCardProps {
  title: string;
  eyebrow: string;
  badge?: string;
  price: string;
  priceSuffix: string;
  comparisonPrice?: string;
  comparisonLabel?: string;
  highlightText?: string;
  details: string[];
  selected: boolean;
  onSelect: () => void;
}

const QuotePlanCard = ({
  title,
  eyebrow,
  badge,
  price,
  priceSuffix,
  comparisonPrice,
  comparisonLabel,
  highlightText,
  details,
  selected,
  onSelect
}: QuotePlanCardProps) => (
  <article
    className={cn(
      'rounded-[28px] border px-5 py-5 transition-all md:px-6 md:py-6',
      selected
        ? 'border-brand bg-brand/10 shadow-[0_0_0_1px_rgba(50,159,91,0.24),0_22px_50px_-32px_rgba(50,159,91,0.6)]'
        : 'border-stroke bg-surface-raised hover:border-brand/45'
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
      </div>
      <div className="flex flex-col items-end gap-2">
        {badge ? (
          <span className="rounded-full border border-brand/50 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
            {badge}
          </span>
        ) : null}
        {selected ? (
          <span className="rounded-full border border-brand/50 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
            Selected
          </span>
        ) : null}
      </div>
    </div>

    <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="flex items-end gap-2">
        <p className="text-4xl font-bold tracking-tight text-ink">{price}</p>
        <p className="pb-1 text-sm text-copy-muted">{priceSuffix}</p>
      </div>
      {comparisonPrice ? (
        <p
          className={cn(
            'pb-1 text-sm font-medium text-copy-muted',
            comparisonLabel === 'discount' && 'line-through decoration-[1.5px]'
          )}
        >
          {comparisonPrice}
        </p>
      ) : null}
    </div>

    {highlightText ? <p className="mt-2 text-sm font-semibold text-brand">{highlightText}</p> : null}

    <div className="mt-4 space-y-2 text-sm text-copy-muted">
      {details.map((detail) => (
        <p key={detail}>{detail}</p>
      ))}
    </div>

    <Button
      type="button"
      variant={selected ? 'primary' : 'secondary'}
      onClick={onSelect}
      className={cn(
        'mt-6 w-full',
        selected && 'bg-ink text-white hover:bg-ink/90'
      )}
    >
      {selected ? 'Selected Plan' : 'Select Plan'}
    </Button>
  </article>
);

interface InstantQuoteSummaryContentProps {
  selectedAddress: string;
  previewCenter: LngLat;
  previewPolygons: EditablePolygon[];
  areaValue: string;
  perimeterValue: string;
  serviceFrequency: ServiceFrequency;
  onServiceFrequencyChange: (nextFrequency: ServiceFrequency) => void;
  billingMode: BillingMode;
  onBillingModeChange: (nextMode: BillingMode) => void;
  quoteTotal: number;
  seasonalPricing: ReturnType<typeof getSeasonalPricing>;
  statusMessage: StatusMessage | null;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  submitting: boolean;
}

export const InstantQuoteSummaryContent = ({
  selectedAddress,
  previewCenter,
  previewPolygons,
  areaValue,
  perimeterValue,
  serviceFrequency,
  onServiceFrequencyChange,
  billingMode,
  onBillingModeChange,
  quoteTotal,
  seasonalPricing,
  statusMessage,
  onBack,
  onContinue,
  canContinue,
  submitting
}: InstantQuoteSummaryContentProps) => {
  const isSeasonalSelected = billingMode === 'seasonal';
  const isPerSessionSelected = billingMode === 'per_session';
  const visitsThisSeasonLabel = `${seasonalPricing.sessionsMax} visits this season`;

  return (
    <div className="mt-8">
      <Card className="rounded-[32px] bg-surface px-5 py-5 md:px-8 md:py-8">
        <div className="flex flex-col gap-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.17em] text-brand">Quote Summary</p>
              <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">Choose your billing plan</h1>

              <div className="mt-6 border-y border-stroke/80 py-5">
                <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">Service address</p>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-ink md:text-base">
                  {selectedAddress}
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">Area</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{areaValue}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">Perimeter</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{perimeterValue}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">Service frequency</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="inline-flex overflow-hidden rounded-full border border-stroke bg-surface-raised">
                    <button
                      type="button"
                      onClick={() => onServiceFrequencyChange('weekly')}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        serviceFrequency === 'weekly'
                          ? 'bg-brand text-ink'
                          : 'bg-transparent text-copy-muted'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => onServiceFrequencyChange('biweekly')}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        serviceFrequency === 'biweekly'
                          ? 'bg-brand text-ink'
                          : 'bg-transparent text-copy-muted'
                      }`}
                    >
                      Bi-weekly
                    </button>
                  </div>
                  <p className="text-sm font-medium text-ink">{visitsThisSeasonLabel}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <QuoteStaticPreview
                token={MAPBOX_TOKEN}
                center={previewCenter}
                polygons={previewPolygons}
                address={selectedAddress}
              />
              <Button type="button" variant="secondary" className="w-full" onClick={onBack}>
                Back to Map
              </Button>
            </div>
          </div>

          <div className="h-px w-full bg-stroke" />

          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.17em] text-brand">Plans</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">Choose your billing plan</h2>
            </div>
            <p className="text-sm text-copy-muted">Select the billing option that fits your property best.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <QuotePlanCard
              title="Per Season"
              eyebrow="Best value"
              badge="20% off"
              price={`$${seasonalPricing.seasonalDiscountedTotal.toFixed(2)}`}
              priceSuffix="for the season"
              comparisonPrice={`$${seasonalPricing.fullSeasonTotal.toFixed(2)}`}
              comparisonLabel="discount"
              highlightText={`You save $${seasonalPricing.seasonalSavingsTotal.toFixed(2)} this season`}
              details={[
                'Full refund up to 24h after your first session'
              ]}
              selected={isSeasonalSelected}
              onSelect={() => onBillingModeChange('seasonal')}
            />
            <QuotePlanCard
              title="Per Session"
              eyebrow="Flexible billing"
              price={`$${quoteTotal.toFixed(2)}`}
              priceSuffix="per visit"
              comparisonPrice={`Total $${seasonalPricing.fullSeasonTotal.toFixed(2)} this season`}
              details={[
                'Pay after each completed visit',
                'Cancel anytime'
              ]}
              selected={isPerSessionSelected}
              onSelect={() => onBillingModeChange('per_session')}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-stroke pt-6">
            <a
              href="/how-rate-is-calculated"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand/85"
            >
              How the rate is calculated
            </a>

            {statusMessage ? (
              <p
                className={
                  statusMessage.type === 'error'
                    ? 'text-sm text-red-700'
                    : 'text-sm text-copy-muted'
                }
              >
                {statusMessage.text}
              </p>
            ) : null}

            <Button
              type="button"
              className="min-h-[56px] w-full text-base"
              onClick={onContinue}
              disabled={!canContinue}
            >
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const InstantQuoteSummaryPage = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const attributionRef = useRef(getAttributionSnapshot());
  const restoredFromStorageRef = useRef(false);
  const [draftState, setDraftState] = useState<QuoteDraftPersistedState | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      restoredFromStorageRef.current = true;
      setLoadingDraft(false);
      return;
    }

    const restoredState = loadQuoteDraftState(window.localStorage);
    setDraftState(restoredState);
    restoredFromStorageRef.current = true;
    setLoadingDraft(false);
  }, []);

  useEffect(() => {
    if (!restoredFromStorageRef.current || !draftState || typeof window === 'undefined') {
      return;
    }

    saveQuoteDraftState(window.localStorage, draftState);
  }, [draftState]);

  const polygons = draftState?.polygonHistory.present.polygons ?? [];
  const metrics = useMemo(() => computeMultiPolygonMetrics(polygons), [polygons]);
  const recommendedPlan = useMemo(() => getRecommendedPlan(metrics.areaM2), [metrics.areaM2]);
  const safeDistanceToNearestStationKm =
    draftState && Number.isFinite(draftState.distanceToNearestStationKm)
      ? draftState.distanceToNearestStationKm
      : 0;
  const quoteTotal = useMemo(
    () => getQuoteTotal(metrics, safeDistanceToNearestStationKm),
    [metrics, safeDistanceToNearestStationKm]
  );
  const serviceFrequency = draftState?.serviceFrequency ?? 'weekly';
  const billingMode = draftState?.billingMode ?? 'seasonal';
  const unitMode = draftState?.unitMode ?? 'metric';
  const seasonalPricing = useMemo(
    () => getSeasonalPricing(quoteTotal, serviceFrequency),
    [quoteTotal, serviceFrequency]
  );
  const isDraftReady =
    draftState !== null &&
    canSubmitQuoteDraft({
      selectedAddress: draftState.selectedAddress,
      validServicePolygonCount: metrics.validServicePolygonCount,
      hasGeometry: metrics.geometry !== null,
      selfIntersecting: metrics.selfIntersecting,
      effectiveGeometryEmpty: metrics.effectiveGeometryEmpty
    });
  const canContinue = isDraftReady && !submitting;

  const areaValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.areaM2)} m2`
      : `${formatNumber(toFt2(metrics.areaM2))} ft2`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.perimeterM)} m`
      : `${formatNumber(toFt(metrics.perimeterM))} ft`;

  const updateDraftState = <Key extends keyof QuoteDraftPersistedState>(
    key: Key,
    value: QuoteDraftPersistedState[Key]
  ) => {
    setDraftState((current) => (current ? { ...current, [key]: value } : current));
    setStatusMessage(null);
  };

  const handleBackToMap = () => {
    navigate('/instant-quote');
  };

  const handleSubmitQuote = async () => {
    if (!draftState || !isDraftReady || !metrics.geometry) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const authToken = await getToken();
      const response = await api.submitQuoteDraft(
        {
          address: draftState.selectedAddress,
          location: {
            lat: draftState.center[1],
            lng: draftState.center[0]
          },
          polygon: metrics.geometry,
          polygonSource: {
            schemaVersion: 2,
            activePolygonId: draftState.polygonHistory.present.activePolygonId,
            polygons: draftState.polygonHistory.present.polygons.map((polygonState) => ({
              id: polygonState.id,
              kind: polygonState.kind,
              ringPoints: polygonState.ringPoints,
              rawStrokePoints: polygonState.rawStrokePoints
            }))
          },
          metrics: {
            areaM2: metrics.areaM2,
            perimeterM: metrics.perimeterM
          },
          plan: recommendedPlan,
          quoteTotal,
          baseTotal: quotePricing.baseFee,
          pricingVersion: 'v1',
          currency: 'CAD',
          serviceFrequency,
          billingMode,
          attribution: attributionRef.current
        },
        createIdempotencyKey(),
        authToken ?? undefined
      );

      if (typeof window !== 'undefined') {
        clearQuoteDraftState(window.localStorage);
      }

      navigate(response.nextStepUrl ?? `/quote-contact/${response.quoteId}`);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof ApiError ? error.message : 'Quote request failed.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDraft) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <Badge>Instant Quote</Badge>
        <QuoteProgressRail currentStep="review" />
        <Card className="mt-8 bg-surface">
          <p className="text-sm text-copy-muted">Loading your saved quote draft...</p>
        </Card>
      </div>
    );
  }

  if (!draftState || !isDraftReady) {
    return <Navigate to="/instant-quote" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <Badge>Instant Quote</Badge>
      <QuoteProgressRail currentStep="review" />

      <InstantQuoteSummaryContent
        selectedAddress={draftState.selectedAddress}
        previewCenter={draftState.center}
        previewPolygons={draftState.polygonHistory.present.polygons}
        areaValue={areaValue}
        perimeterValue={perimeterValue}
        serviceFrequency={serviceFrequency}
        onServiceFrequencyChange={(nextFrequency) =>
          updateDraftState('serviceFrequency', nextFrequency)
        }
        billingMode={billingMode}
        onBillingModeChange={(nextMode) => updateDraftState('billingMode', nextMode)}
        quoteTotal={quoteTotal}
        seasonalPricing={seasonalPricing}
        statusMessage={statusMessage}
        onBack={handleBackToMap}
        onContinue={handleSubmitQuote}
        canContinue={canContinue}
        submitting={submitting}
      />
    </div>
  );
};
