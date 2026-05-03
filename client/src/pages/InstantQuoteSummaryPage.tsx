import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LegalAgreementCheckbox, LegalDocumentLinks } from '../components/legal/LegalAgreementCheckbox';
import { QuotePlanCard } from '../components/quote/QuotePlanCard';
import { QuoteStaticPreview } from '../components/quote/QuoteStaticPreview';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { trackAnalyticsEvent } from '../lib/analytics';
import { getAttributionSnapshot } from '../lib/attribution';
import { toFt, toFt2 } from '../lib/geometry';
import { trackSubmitLeadConversion } from '../lib/googleAds';
import { legalAcceptancePayload, legalDocumentSlugs } from '../lib/legalAcceptance';
import { computeMultiPolygonMetrics } from '../lib/multiPolygonMetrics';
import { canSubmitQuoteDraft } from '../lib/quoteFlow';
import {
  clearQuoteDraftState,
  loadQuoteDraftState,
  saveQuoteDraftState,
  type QuoteDraftPersistedState
} from '../lib/quoteDraftPersistence';
import { getQuoteTotal, getRecommendedPlan, getSeasonalPricing, quotePricing } from '../lib/quote';
import type { BillingMode, EditablePolygon, LngLat } from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

interface StatusMessage {
  type: 'error' | 'info';
  text: string;
}

const EMPTY_POLYGONS: EditablePolygon[] = [];

const formatWholeNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'narrowSymbol'
  }).format(value);

interface InstantQuoteSummaryContentProps {
  selectedAddress: string;
  previewCenter: LngLat;
  previewPolygons: EditablePolygon[];
  areaValue: string;
  perimeterValue: string;
  billingMode: BillingMode;
  onBillingModeChange: (nextMode: BillingMode) => void;
  quoteTotal: number;
  seasonalPricing: ReturnType<typeof getSeasonalPricing>;
  statusMessage: StatusMessage | null;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  submitting: boolean;
  legalAccepted: boolean;
  onLegalAcceptedChange: (accepted: boolean) => void;
}

export const InstantQuoteSummaryContent = ({
  selectedAddress,
  previewCenter,
  previewPolygons,
  areaValue,
  perimeterValue,
  billingMode,
  onBillingModeChange,
  quoteTotal,
  seasonalPricing,
  statusMessage,
  onBack,
  onContinue,
  canContinue,
  submitting,
  legalAccepted,
  onLegalAcceptedChange
}: InstantQuoteSummaryContentProps) => {
  const isSeasonalSelected = billingMode === 'seasonal';
  const isPerSessionSelected = billingMode === 'per_session';
  const visitsThisSeasonLabel = `${seasonalPricing.sessionsMax} visits this season`;
  const seasonalPrice = formatCurrency(seasonalPricing.seasonalDiscountedTotal);
  const perVisitPrice = formatCurrency(quoteTotal);
  const regularSeasonPrice = formatCurrency(seasonalPricing.fullSeasonTotal);
  const savingsPrice = formatCurrency(seasonalPricing.seasonalSavingsTotal);
  const seasonDatesLabel = 'May to September';

  return (
    <div className="space-y-7">
      <Button
        type="button"
        variant="secondary"
        className="min-h-10 px-4 py-2 text-sm"
        onClick={onBack}
      >
        Back to Map
      </Button>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-brand">Quote summary</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink md:text-5xl">
              Your lawn quote is ready
            </h1>
            <div className="mt-4">
              <p className="text-sm font-semibold text-copy-muted">Service address</p>
              <p className="mt-2 max-w-3xl text-base font-medium leading-7 text-ink">
                {selectedAddress}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-lg border border-stroke bg-surface px-4 py-3.5">
              <p className="text-sm font-semibold text-copy-muted">Season plan</p>
              <p className="mt-2 font-display text-3xl font-bold text-ink">{seasonalPrice}</p>
              <p className="mt-1 text-sm text-copy-muted">after 20% savings</p>
            </article>
            <article className="rounded-lg border border-stroke bg-surface px-4 py-3.5">
              <p className="text-sm font-semibold text-copy-muted">Per visit</p>
              <p className="mt-2 font-display text-3xl font-bold text-ink">{perVisitPrice}</p>
              <p className="mt-1 text-sm text-copy-muted">weekly service</p>
            </article>
            <article className="rounded-lg border border-stroke bg-surface px-4 py-3.5">
              <p className="text-sm font-semibold text-copy-muted">Season savings</p>
              <p className="mt-2 font-display text-3xl font-bold text-brand">{savingsPrice}</p>
              <p className="mt-1 text-sm text-copy-muted">{visitsThisSeasonLabel}</p>
            </article>
          </div>

          <div className="rounded-lg border border-stroke bg-surface px-4 py-3.5 md:px-5">
            <p className="text-sm font-semibold text-copy-muted">Season schedule</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-copy-soft">Cadence</p>
                <p className="mt-1 font-semibold text-ink">Weekly visits</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-copy-soft">Season</p>
                <p className="mt-1 font-semibold text-ink">{seasonDatesLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-copy-soft">Total</p>
                <p className="mt-1 font-semibold text-ink">{seasonalPricing.sessionsMax} visits</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-2">
          <QuoteStaticPreview
            token={MAPBOX_TOKEN}
            center={previewCenter}
            polygons={previewPolygons}
            address={selectedAddress}
            className="rounded-lg min-h-[260px] sm:min-h-[300px] lg:min-h-[340px] xl:min-h-[360px] 2xl:min-h-[380px]"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-medium leading-5 text-copy-soft">
            <span>
              Area: {areaValue}
            </span>
            <span>
              Perimeter: {perimeterValue}
            </span>
          </div>
        </aside>
      </section>

      <section className="space-y-5 border-t border-stroke pt-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-brand">Plans</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Choose how to pay</h2>
          </div>
          <p className="max-w-xl text-sm text-copy-muted">Select one billing option.</p>
        </div>

        <div
          role="radiogroup"
          aria-label="Billing plan"
          className="grid gap-4 lg:grid-cols-2"
        >
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
            selected={isSeasonalSelected}
            onSelect={() => onBillingModeChange('seasonal')}
          />
          <QuotePlanCard
            title="Per Visit"
            eyebrow="Flexible billing"
            price={perVisitPrice}
            priceSuffix="/ visit"
            comparisonPrice={regularSeasonPrice}
            comparisonLabel="full season if paid per visit"
            details={[
              'Pay after each completed visit',
              'Cancel anytime'
            ]}
            selected={isPerSessionSelected}
            onSelect={() => onBillingModeChange('per_session')}
          />
        </div>

        <div className="flex flex-col gap-4">
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

          <LegalAgreementCheckbox
            id="quote-summary-legal-acceptance"
            checked={legalAccepted}
            onChange={onLegalAcceptedChange}
            documentSlugs={legalDocumentSlugs.quoteSubmit}
          >
            I have read and agree to the <LegalDocumentLinks documentSlugs={legalDocumentSlugs.quoteSubmit} />.
          </LegalAgreementCheckbox>

          <Button
            type="button"
            className="min-h-[56px] w-full text-base shadow-[0_18px_36px_-28px_rgba(50,159,91,0.95)]"
            onClick={onContinue}
            disabled={!canContinue}
          >
            {submitting ? 'Submitting...' : 'Submit Quote'}
          </Button>
        </div>
      </section>
    </div>
  );
};

export const InstantQuoteSummaryPage = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const attributionRef = useRef(getAttributionSnapshot());
  const restoredFromStorageRef = useRef(false);
  const summaryViewedTrackedRef = useRef(false);
  const [draftState, setDraftState] = useState<QuoteDraftPersistedState | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
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

  const polygons = draftState?.polygonHistory.present.polygons ?? EMPTY_POLYGONS;
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
  const billingMode = draftState?.billingMode ?? 'seasonal';
  const unitMode = draftState?.unitMode ?? 'metric';
  const seasonalPricing = useMemo(
    () => getSeasonalPricing(quoteTotal, 'weekly'),
    [quoteTotal]
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
  const canContinue = isDraftReady && !submitting && legalAccepted;

  const areaValue =
    unitMode === 'metric'
      ? `${formatWholeNumber(metrics.areaM2)} m²`
      : `${formatWholeNumber(toFt2(metrics.areaM2))} ft²`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatWholeNumber(metrics.perimeterM)} m`
      : `${formatWholeNumber(toFt(metrics.perimeterM))} ft`;

  const updateDraftState = <Key extends keyof QuoteDraftPersistedState>(
    key: Key,
    value: QuoteDraftPersistedState[Key]
  ) => {
    if (key === 'billingMode') {
      trackAnalyticsEvent('quote.billing_mode_selected', {
        step: 'summary',
        properties: {
          billingMode: String(value)
        }
      });
    }
    setDraftState((current) => (current ? { ...current, [key]: value } : current));
    setStatusMessage(null);
  };

  useEffect(() => {
    if (!isDraftReady || summaryViewedTrackedRef.current) {
      return;
    }

    summaryViewedTrackedRef.current = true;
    trackAnalyticsEvent('quote.summary_viewed', {
      step: 'summary',
      properties: {
        billingMode,
        servicePolygonCount: metrics.validServicePolygonCount,
        quoteValueBucket:
          quoteTotal < 60 ? 'under_60' : quoteTotal < 90 ? '60_90' : quoteTotal < 130 ? '90_130' : '130_plus'
      }
    });
  }, [billingMode, isDraftReady, metrics.validServicePolygonCount, quoteTotal]);

  const handleBackToMap = () => {
    navigate('/instant-quote');
  };

  const handleSubmitQuote = async () => {
    if (!draftState || !isDraftReady || !metrics.geometry) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    trackAnalyticsEvent('quote.submit_clicked', {
      step: 'summary',
      properties: {
        billingMode,
        servicePolygonCount: metrics.validServicePolygonCount,
        quoteValueBucket:
          quoteTotal < 60 ? 'under_60' : quoteTotal < 90 ? '60_90' : quoteTotal < 130 ? '90_130' : '130_plus'
      }
    });

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
          serviceFrequency: 'weekly',
          billingMode,
          attribution: attributionRef.current,
          legalAcceptance: legalAcceptancePayload
        },
        createIdempotencyKey(),
        authToken ?? undefined
      );

      if (typeof window !== 'undefined') {
        clearQuoteDraftState(window.localStorage);
      }

      trackAnalyticsEvent('quote.draft_created', {
        step: 'summary',
        quoteId: response.quoteId,
        properties: {
          billingMode,
          quoteValueBucket:
            quoteTotal < 60 ? 'under_60' : quoteTotal < 90 ? '60_90' : quoteTotal < 130 ? '90_130' : '130_plus'
        }
      });
      await trackSubmitLeadConversion(response.quoteId);
      navigate(response.nextStepUrl ?? `/quote-confirmation/${response.quoteId}`);
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
        <Button
          type="button"
          variant="secondary"
          className="min-h-10 px-4 py-2 text-sm"
          onClick={handleBackToMap}
        >
          Back to Map
        </Button>
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
      <InstantQuoteSummaryContent
        selectedAddress={draftState.selectedAddress}
        previewCenter={draftState.center}
        previewPolygons={draftState.polygonHistory.present.polygons}
        areaValue={areaValue}
        perimeterValue={perimeterValue}
        billingMode={billingMode}
        onBillingModeChange={(nextMode) => updateDraftState('billingMode', nextMode)}
        quoteTotal={quoteTotal}
        seasonalPricing={seasonalPricing}
        statusMessage={statusMessage}
        onBack={handleBackToMap}
        onContinue={handleSubmitQuote}
        canContinue={canContinue}
        submitting={submitting}
        legalAccepted={legalAccepted}
        onLegalAcceptedChange={setLegalAccepted}
      />
    </div>
  );
};
