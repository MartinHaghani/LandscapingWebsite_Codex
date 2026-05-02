import { useEffect, useMemo, useRef, useState } from 'react';
import { QuoteEditorMap } from '../components/QuoteEditorMap';
import {
  adminApi,
  type AdminPolygonSource,
  type AuthTokenProvider
} from '../lib/api';
import { fetchAddressSuggestions, type MapboxSuggestion } from '../lib/geocoding';
import { computeMultiPolygonMetrics } from '../lib/multiPolygonMetrics';
import {
  applyPolygonEdit,
  createPolygonHistory,
  redoPolygonEdit,
  undoPolygonEdit
} from '../lib/polygonHistory';
import {
  deleteVertexOrPolygonFromEditorState,
  removePolygonFromEditorState
} from '../lib/polygonEditing';
import { formatNumber, toFt, toFt2 } from '../lib/quoteEditorGeometry';
import {
  getCalculatedPerSession,
  getRecommendedPlan
} from '../lib/quoteMath';
import type {
  EditablePolygon,
  LngLat,
  PolygonEditorState,
  PolygonKind,
  SelectionTarget
} from '../lib/quoteEditorTypes';

interface QuoteCreatorPageProps {
  getToken: AuthTokenProvider;
  onBack: () => void;
  onOpenQuote: (quoteId: string) => void;
}

const EMPTY_EDITOR_STATE: PolygonEditorState = {
  polygons: [],
  activePolygonId: null
};

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;
const PUBLIC_APP_BASE_URL = (import.meta.env?.VITE_PUBLIC_APP_BASE_URL ?? window.location.origin).replace(/\/$/, '');
const SERVICE_FREQUENCY = 'weekly' as const;
const SEASONAL_VISITS = 20;

const createPolygonId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `polygon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const fromEditorState = (state: PolygonEditorState): AdminPolygonSource => ({
  schemaVersion: 2,
  activePolygonId: state.activePolygonId,
  polygons: state.polygons.map((polygon) => ({
    id: polygon.id,
    kind: polygon.kind,
    ringPoints: polygon.ringPoints.map(([lng, lat]) => [lng, lat] as [number, number]),
    rawStrokePoints:
      polygon.rawStrokePoints?.map(([lng, lat]) => [lng, lat] as [number, number]) ?? null
  }))
});

const formatCurrency = (value: number, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const roundMoney = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const clampRate = (value: number) => Number(Math.min(0.5, Math.max(0, Number.isFinite(value) ? value : 0)).toFixed(4));
const parsePercentText = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampRate(parsed / 100) : fallback;
};
const parseMoneyText = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const computeDiscountPricing = ({
  calculatedPerSessionTotal,
  globalDiscountRate,
  seasonalDiscountRate,
  overrideEnabled,
  overrideEditMode,
  perVisitOverrideText,
  seasonalOverrideText
}: {
  calculatedPerSessionTotal: number;
  globalDiscountRate: number;
  seasonalDiscountRate: number;
  overrideEnabled: boolean;
  overrideEditMode: 'per_session' | 'seasonal';
  perVisitOverrideText: string;
  seasonalOverrideText: string;
}) => {
  let basePerSessionTotal = calculatedPerSessionTotal;
  const globalMultiplier = 1 - globalDiscountRate;
  const seasonalMultiplier = 1 - seasonalDiscountRate;

  if (overrideEnabled) {
    if (overrideEditMode === 'seasonal') {
      const seasonalTotal = parseMoneyText(seasonalOverrideText);
      if (seasonalTotal !== null) {
        basePerSessionTotal = roundMoney(seasonalTotal / (SEASONAL_VISITS * globalMultiplier * seasonalMultiplier));
      }
    } else {
      const perVisitTotal = parseMoneyText(perVisitOverrideText);
      if (perVisitTotal !== null) {
        basePerSessionTotal = roundMoney(perVisitTotal / globalMultiplier);
      }
    }
  }

  const perSessionTotal = roundMoney(basePerSessionTotal * globalMultiplier);
  const fullSeasonTotal = roundMoney(perSessionTotal * SEASONAL_VISITS);
  const seasonalDiscountedTotal = roundMoney(fullSeasonTotal * seasonalMultiplier);

  return {
    basePerSessionTotal,
    perSessionTotal,
    fullSeasonTotal,
    seasonalDiscountedTotal,
    seasonalSavingsTotal: roundMoney(fullSeasonTotal - seasonalDiscountedTotal)
  };
};

const summarizeActivePolygon = (polygon: EditablePolygon | null) => {
  if (!polygon) {
    return 'None selected';
  }

  return `${polygon.kind === 'service' ? 'Lawn' : 'Obstacle'} (${polygon.ringPoints.length} vertices)`;
};

export const QuoteCreatorPage = ({ getToken, onBack, onOpenQuote }: QuoteCreatorPageProps) => {
  const polygonCounterRef = useRef(0);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteIdExpiresAt, setQuoteIdExpiresAt] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState<LngLat>([-79.51962, 43.844147]);
  const [distanceToNearestStationKm, setDistanceToNearestStationKm] = useState(0);
  const [serviceAreaWarning, setServiceAreaWarning] = useState<string | null>(null);
  const [polygonHistory, setPolygonHistory] = useState(() => createPolygonHistory(EMPTY_EDITOR_STATE));
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'none' });
  const [drawMode, setDrawMode] = useState<PolygonKind | null>(null);
  const [clearAllConfirmation, setClearAllConfirmation] = useState(false);
  const [unitMode, setUnitMode] = useState<'metric' | 'imperial'>('metric');
  const [globalDiscountRateText, setGlobalDiscountRateText] = useState('0');
  const [seasonalDiscountRateText, setSeasonalDiscountRateText] = useState('20');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideEditMode, setOverrideEditMode] = useState<'per_session' | 'seasonal'>('per_session');
  const [perVisitOverrideText, setPerVisitOverrideText] = useState('');
  const [seasonalOverrideText, setSeasonalOverrideText] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [billingMode, setBillingMode] = useState<'seasonal' | 'per_session'>('seasonal');
  const [saving, setSaving] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editorState = polygonHistory.present;
  const polygons = editorState.polygons;
  const activePolygonId = editorState.activePolygonId;
  const activePolygon = polygons.find((polygon) => polygon.id === activePolygonId) ?? null;
  const metrics = useMemo(() => computeMultiPolygonMetrics(polygons), [polygons]);
  const globalDiscountRate = useMemo(
    () => parsePercentText(globalDiscountRateText, 0),
    [globalDiscountRateText]
  );
  const seasonalDiscountRate = useMemo(
    () => parsePercentText(seasonalDiscountRateText, 0.2),
    [seasonalDiscountRateText]
  );
  const calculatedPerSessionTotal = useMemo(
    () => getCalculatedPerSession(metrics.areaM2, metrics.perimeterM, distanceToNearestStationKm),
    [metrics.areaM2, metrics.perimeterM, distanceToNearestStationKm]
  );
  const pricing = useMemo(
    () =>
      computeDiscountPricing({
        calculatedPerSessionTotal,
        globalDiscountRate,
        seasonalDiscountRate,
        overrideEnabled,
        overrideEditMode,
        perVisitOverrideText,
        seasonalOverrideText
      }),
    [
      calculatedPerSessionTotal,
      globalDiscountRate,
      seasonalDiscountRate,
      overrideEnabled,
      overrideEditMode,
      perVisitOverrideText,
      seasonalOverrideText
    ]
  );
  const activeOverrideInputValid =
    !overrideEnabled ||
    (overrideEditMode === 'seasonal'
      ? parseMoneyText(seasonalOverrideText) !== null
      : parseMoneyText(perVisitOverrideText) !== null);
  const canUndo = polygonHistory.past.length > 0;
  const canRedo = polygonHistory.future.length > 0;
  const genericClaimLink = `${PUBLIC_APP_BASE_URL}/claim-quote`;
  const directClaimLink = quoteId ? `${genericClaimLink}?quoteId=${encodeURIComponent(quoteId)}` : genericClaimLink;
  const areaValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.areaM2)} m2`
      : `${formatNumber(toFt2(metrics.areaM2))} ft2`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.perimeterM)} m`
      : `${formatNumber(toFt(metrics.perimeterM))} ft`;
  const validationMessages = [
    metrics.validServicePolygonCount === 0 ? 'Draw at least one lawn boundary.' : null,
    metrics.selfIntersecting ? 'Boundary edges cross. Adjust vertices before saving.' : null,
    metrics.effectiveGeometryEmpty ? 'Obstacles remove the entire lawn area.' : null,
    !location ? 'Select an address suggestion so the quote has a mapped location.' : null,
    !metrics.geometry ? 'The quote needs a valid measured service geometry.' : null,
    !activeOverrideInputValid ? 'Override price must be a valid non-negative amount.' : null
  ].filter(Boolean);
  const canSave =
    Boolean(quoteId) &&
    Boolean(location) &&
    metrics.validServicePolygonCount > 0 &&
    !metrics.selfIntersecting &&
    !metrics.effectiveGeometryEmpty &&
    Boolean(metrics.geometry) &&
    activeOverrideInputValid &&
    !saving &&
    !savedQuoteId;

  useEffect(() => {
    let cancelled = false;

    const reserveId = async () => {
      setError(null);
      try {
        const response = await adminApi.reserveQuoteId(getToken);
        if (cancelled) {
          return;
        }
        setQuoteId(response.quoteId);
        setQuoteIdExpiresAt(response.expiresAt);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to reserve a quote ID.');
        }
      }
    };

    void reserveId();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || addressQuery.trim().length < 2 || savedQuoteId) {
      setAddressSuggestions([]);
      return;
    }

    let cancelled = false;
    setSuggestionsLoading(true);
    const timeout = window.setTimeout(() => {
      fetchAddressSuggestions({
        query: addressQuery,
        token: MAPBOX_TOKEN,
        proximity: center
      })
        .then((suggestions) => {
          if (!cancelled) {
            setAddressSuggestions(suggestions);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAddressSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSuggestionsLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [addressQuery, center, savedQuoteId]);

  useEffect(() => {
    if (!clearAllConfirmation) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setClearAllConfirmation(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [clearAllConfirmation]);

  useEffect(() => {
    if (activePolygonId === null && polygons.length > 0) {
      setPolygonHistory((current) => ({
        ...current,
        present: {
          ...current.present,
          activePolygonId: polygons[0]?.id ?? null
        }
      }));
      return;
    }

    if (activePolygonId && !polygons.some((polygon) => polygon.id === activePolygonId)) {
      setPolygonHistory((current) => ({
        ...current,
        present: {
          ...current.present,
          activePolygonId: polygons[0]?.id ?? null
        }
      }));
    }
  }, [activePolygonId, polygons]);

  useEffect(() => {
    if (selection.kind === 'none') {
      return;
    }

    const selectedPolygon = polygons.find((polygon) => polygon.id === selection.polygonId);
    if (!selectedPolygon) {
      setSelection({ kind: 'none' });
      return;
    }

    if (
      selection.kind === 'vertex' &&
      (selection.index < 0 || selection.index >= selectedPolygon.ringPoints.length)
    ) {
      setSelection({ kind: 'none' });
    }
  }, [polygons, selection]);

  const createDrawnPolygon = (kind: PolygonKind, ringPoints: LngLat[], rawStrokePoints: LngLat[]) => {
    polygonCounterRef.current += 1;
    const polygonId = `${createPolygonId()}-${polygonCounterRef.current}`;

    setPolygonHistory((current) =>
      applyPolygonEdit(current, {
        polygons: [
          ...current.present.polygons,
          { id: polygonId, kind, ringPoints, rawStrokePoints }
        ],
        activePolygonId: polygonId
      })
    );

    setSelection({ kind: 'polygon', polygonId });
    setDrawMode(null);
    setClearAllConfirmation(false);
    setError(null);
  };

  const toggleDrawMode = (nextKind: PolygonKind) => {
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setDrawMode((current) => (current === nextKind ? null : nextKind));
    setError(null);
  };

  const handleMapSelectionChange = (nextSelection: SelectionTarget) => {
    setClearAllConfirmation(false);
    setSelection(nextSelection);
    if (nextSelection.kind !== 'none') {
      setPolygonHistory((current) => ({
        ...current,
        present: {
          ...current.present,
          activePolygonId: nextSelection.polygonId
        }
      }));
    }
  };

  const handleUndo = () => {
    setPolygonHistory((current) => undoPolygonEdit(current));
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setError(null);
  };

  const handleRedo = () => {
    setPolygonHistory((current) => redoPolygonEdit(current));
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setError(null);
  };

  const handleDeleteSelection = () => {
    setClearAllConfirmation(false);
    if (selection.kind === 'none') {
      return;
    }

    if (selection.kind === 'polygon') {
      setPolygonHistory((current) => applyPolygonEdit(current, removePolygonFromEditorState(current.present, selection.polygonId)));
      setSelection({ kind: 'none' });
      return;
    }

    setPolygonHistory((current) =>
      applyPolygonEdit(
        current,
        deleteVertexOrPolygonFromEditorState(current.present, selection.polygonId, selection.index)
      )
    );
    setSelection({ kind: 'none' });
  };

  const handleClearAll = () => {
    if (!clearAllConfirmation) {
      setClearAllConfirmation(true);
      return;
    }

    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setSelection({ kind: 'none' });
    setDrawMode(null);
    setClearAllConfirmation(false);
  };

  const selectAddress = async (suggestion: MapboxSuggestion) => {
    const [lng, lat] = suggestion.center;
    setAddressQuery(suggestion.place_name);
    setAddressSuggestions([]);
    setLocation({ lat, lng });
    setCenter([lng, lat]);
    setServiceAreaWarning(null);
    setDistanceToNearestStationKm(0);

    try {
      const response = await adminApi.checkServiceArea(getToken, { lat, lng });
      setDistanceToNearestStationKm(response.distanceToNearestStationKm ?? 0);
      if (!response.inServiceArea) {
        setServiceAreaWarning('This address appears outside the current service area. Admin creation is allowed, but review before handing off payment.');
      }
    } catch {
      setServiceAreaWarning('Service-area check failed. Admin creation is allowed, but review coverage before handing off payment.');
    }
  };

  const copyText = async (label: string, value: string) => {
    setCopyStatus(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setError(`Unable to copy ${label.toLowerCase()}.`);
    }
  };

  const toggleOverride = () => {
    if (!overrideEnabled) {
      setPerVisitOverrideText(pricing.perSessionTotal.toFixed(2));
      setSeasonalOverrideText(pricing.seasonalDiscountedTotal.toFixed(2));
      setOverrideEditMode('per_session');
    }
    setOverrideEnabled((current) => !current);
  };

  const saveQuote = async () => {
    if (!canSave || !quoteId || !location || !metrics.geometry) {
      return;
    }

    setSaving(true);
    setError(null);
    setCopyStatus(null);

    try {
      const response = await adminApi.createAdminQuote(getToken, {
        quoteId,
        address: addressQuery.trim(),
        location,
        polygon: metrics.geometry,
        polygonSource: fromEditorState(editorState),
        billingMode,
        globalDiscountRate,
        seasonalDiscountRate,
        priceOverrideEnabled: overrideEnabled,
        overrideBasePerSessionTotal: overrideEnabled ? pricing.basePerSessionTotal : undefined,
        overrideReason: overrideReason.trim() || undefined,
        serviceFrequency: SERVICE_FREQUENCY,
        pricingVersion: 'v1',
        currency: 'CAD'
      });

      setSavedQuoteId(response.quoteId);
      setQuoteId(response.quoteId);
      setCopyStatus(`Saved ${response.quoteId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create admin quote.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="quote-creator-page">
      <header className="quote-creator-topbar">
        <div className="quote-creator-id-block">
          <button type="button" className="button quiet" onClick={onBack}>
            Back
          </button>
          <div>
            <p className="metric-label">Reserved Quote ID</p>
            <h2>{quoteId ?? 'Reserving...'}</h2>
            {quoteIdExpiresAt && !savedQuoteId ? (
              <p className="hint">Reservation expires {new Date(quoteIdExpiresAt).toLocaleTimeString()}.</p>
            ) : null}
          </div>
        </div>

        <div className="quote-creator-link-actions">
          <button type="button" className="button" disabled={!quoteId} onClick={() => quoteId && copyText('Quote ID', quoteId)}>
            Copy ID
          </button>
          <button type="button" className="button" onClick={() => copyText('Generic link', genericClaimLink)}>
            Copy generic link
          </button>
          <button type="button" className="button" disabled={!quoteId} onClick={() => copyText('Direct link', directClaimLink)}>
            Copy direct link
          </button>
          {savedQuoteId ? (
            <button type="button" className="button primary" onClick={() => onOpenQuote(savedQuoteId)}>
              Open editor
            </button>
          ) : (
            <button type="button" className="button primary" onClick={saveQuote} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save quote'}
            </button>
          )}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {copyStatus ? <p className="quote-creator-success">{copyStatus}</p> : null}
      {serviceAreaWarning ? <p className="quote-creator-warning">{serviceAreaWarning}</p> : null}

      <div className="quote-creator-workbench">
        <div className="quote-creator-map-column">
          <section className="quote-creator-address-panel">
            <label>
              Service address
              <div className="quote-creator-address-input-wrap">
                <input
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setLocation(null);
                    setSavedQuoteId(null);
                  }}
                  placeholder="Start typing an address"
                  disabled={Boolean(savedQuoteId)}
                />
                {addressSuggestions.length > 0 || suggestionsLoading ? (
                  <div className="quote-creator-suggestions">
                    {suggestionsLoading ? <p className="hint">Searching...</p> : null}
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => void selectAddress(suggestion)}
                      >
                        {suggestion.place_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
          </section>

          {validationMessages.length > 0 ? (
            <div className="quote-creator-validation-list">
              {validationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}

          {!MAPBOX_TOKEN ? (
            <p className="error-banner">`VITE_MAPBOX_TOKEN` is missing. Add it to `admin/.env` to draw quote geometry.</p>
          ) : (
            <div className="quote-editor-map-stage">
              <QuoteEditorMap
                token={MAPBOX_TOKEN}
                center={center}
                drawMode={drawMode}
                selection={selection}
                polygons={polygons}
                activePolygonId={activePolygonId}
                onPolygonDrawn={(kind, shape) => {
                  createDrawnPolygon(kind, shape.ringPoints, shape.rawStrokePoints);
                }}
                onPolygonRingPointsChange={(polygonId, nextPoints) => {
                  setPolygonHistory((current) => {
                    const nextPolygons = current.present.polygons.map((polygon) =>
                      polygon.id === polygonId
                        ? { ...polygon, ringPoints: nextPoints, rawStrokePoints: null }
                        : polygon
                    );

                    return applyPolygonEdit(current, {
                      polygons: nextPolygons,
                      activePolygonId: current.present.activePolygonId
                    });
                  });
                }}
                onSelectionChange={handleMapSelectionChange}
              />

              <div className="quote-editor-map-undo-cluster">
                <button type="button" className="quote-editor-map-icon-button" onClick={handleUndo} disabled={!canUndo} aria-label="Undo">
                  <span aria-hidden="true">&larr;</span>
                </button>
                <button type="button" className="quote-editor-map-icon-button" onClick={handleRedo} disabled={!canRedo} aria-label="Redo">
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>

              <div className="quote-editor-map-toolbar-rail">
                <div className="quote-editor-map-toolbar">
                  <button
                    type="button"
                    className={`quote-editor-map-tool-button ${drawMode === 'service' ? 'is-service-active' : ''}`}
                    onClick={() => toggleDrawMode('service')}
                  >
                    {drawMode === 'service' ? 'Stop drawing' : 'Draw lawn'}
                  </button>
                  <button
                    type="button"
                    className={`quote-editor-map-tool-button is-danger-tool ${drawMode === 'obstacle' ? 'is-obstacle-active' : ''}`}
                    onClick={() => toggleDrawMode('obstacle')}
                  >
                    {drawMode === 'obstacle' ? 'Stop drawing' : 'Draw obstacle'}
                  </button>
                  <div className="quote-editor-map-toolbar-divider" aria-hidden="true" />
                  <div className="quote-editor-map-danger-group">
                    <button
                      type="button"
                      className="quote-editor-map-tool-button is-danger-tool"
                      onClick={handleDeleteSelection}
                      disabled={selection.kind === 'none'}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className={`quote-editor-map-tool-button is-danger-tool ${clearAllConfirmation ? 'is-obstacle-active' : ''}`}
                      onClick={handleClearAll}
                      disabled={polygons.length === 0}
                    >
                      {clearAllConfirmation ? 'Confirm clear all' : 'Clear all'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="quote-creator-side-panel">
          <section className="quote-creator-stat-group">
            <div className="quote-creator-panel-heading">
              <p className="metric-label">Geometry</p>
              <button type="button" className="button quiet" onClick={() => setUnitMode((current) => (current === 'metric' ? 'imperial' : 'metric'))}>
                {unitMode === 'metric' ? 'Metric' : 'Imperial'}
              </button>
            </div>
            <dl className="quote-creator-stat-list">
              <div>
                <dt>Area</dt>
                <dd>{areaValue}</dd>
              </div>
              <div>
                <dt>Perimeter</dt>
                <dd>{perimeterValue}</dd>
              </div>
              <div>
                <dt>Lawn zones</dt>
                <dd>{metrics.validServicePolygonCount} / {metrics.servicePolygonCount}</dd>
              </div>
              <div>
                <dt>Obstacles</dt>
                <dd>{metrics.validObstaclePolygonCount} / {metrics.obstaclePolygonCount}</dd>
              </div>
              <div>
                <dt>Vertices</dt>
                <dd>{metrics.vertexCount}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{summarizeActivePolygon(activePolygon)}</dd>
              </div>
            </dl>
          </section>

          <section className="quote-creator-stat-group">
            <p className="metric-label">Pricing</p>
            <dl className="quote-creator-stat-list quote-creator-price-list">
              <div>
                <dt>Calculated per visit</dt>
                <dd>{formatCurrency(calculatedPerSessionTotal)}</dd>
              </div>
              <div>
                <dt>Per-visit price</dt>
                <dd>{formatCurrency(pricing.perSessionTotal)}</dd>
              </div>
              <div>
                <dt>Global discount</dt>
                <dd>{(globalDiscountRate * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Full season</dt>
                <dd>{formatCurrency(pricing.fullSeasonTotal)}</dd>
              </div>
              <div>
                <dt>Seasonal discount</dt>
                <dd>{(seasonalDiscountRate * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Discounted seasonal total</dt>
                <dd>{formatCurrency(pricing.seasonalDiscountedTotal)}</dd>
              </div>
            </dl>

            <div className="quote-creator-controls-grid">
              <label>
                Global discount (%)
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={globalDiscountRateText}
                  onChange={(event) => setGlobalDiscountRateText(event.target.value)}
                />
              </label>
              <label>
                Seasonal discount (%)
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={seasonalDiscountRateText}
                  onChange={(event) => setSeasonalDiscountRateText(event.target.value)}
                />
              </label>
            </div>

            <div className="quote-creator-billing-toggle" role="group" aria-label="Default billing mode">
              <button
                type="button"
                className={billingMode === 'seasonal' ? 'active' : ''}
                onClick={() => setBillingMode('seasonal')}
              >
                Seasonal
              </button>
              <button
                type="button"
                className={billingMode === 'per_session' ? 'active' : ''}
                onClick={() => setBillingMode('per_session')}
              >
                Per visit
              </button>
            </div>
          </section>

          <section className="quote-creator-stat-group">
            <div className="quote-creator-panel-heading">
              <p className="metric-label">Admin Override</p>
              <button type="button" className={`button quiet ${overrideEnabled ? 'is-active' : ''}`} onClick={toggleOverride}>
                {overrideEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            {overrideEnabled ? (
              <>
                <div className="quote-creator-controls-grid">
                  <label>
                    Per-visit price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={overrideEditMode === 'per_session' ? perVisitOverrideText : pricing.perSessionTotal.toFixed(2)}
                      onFocus={() => {
                        setOverrideEditMode('per_session');
                        setPerVisitOverrideText(pricing.perSessionTotal.toFixed(2));
                      }}
                      onChange={(event) => {
                        setOverrideEditMode('per_session');
                        setPerVisitOverrideText(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    Discounted seasonal
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={overrideEditMode === 'seasonal' ? seasonalOverrideText : pricing.seasonalDiscountedTotal.toFixed(2)}
                      onFocus={() => {
                        setOverrideEditMode('seasonal');
                        setSeasonalOverrideText(pricing.seasonalDiscountedTotal.toFixed(2));
                      }}
                      onChange={(event) => {
                        setOverrideEditMode('seasonal');
                        setSeasonalOverrideText(event.target.value);
                      }}
                    />
                  </label>
                </div>
                <label>
                  Override reason
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Optional internal context"
                  />
                </label>
              </>
            ) : (
              <p className="hint">Override mode lets you edit either the per-visit price or discounted seasonal total. The other value recalculates from 20 visits and active discounts.</p>
            )}
          </section>

          <section className="quote-creator-stat-group quote-creator-id-card">
            <p className="metric-label">Customer handoff</p>
            <p className="quote-creator-big-id">{quoteId ?? 'ABC123'}</p>
            <p className="hint">Give the customer the Quote ID or direct claim link. The quote is anonymous until they claim it.</p>
            <div className="quote-creator-copy-grid">
              <button type="button" className="button" disabled={!quoteId} onClick={() => quoteId && copyText('Quote ID', quoteId)}>
                Copy ID
              </button>
              <button type="button" className="button" onClick={() => copyText('Generic link', genericClaimLink)}>
                Copy link
              </button>
              <button type="button" className="button" disabled={!quoteId} onClick={() => copyText('Direct link', directClaimLink)}>
                Copy direct
              </button>
            </div>
          </section>

          <section className="quote-creator-action-strip">
            <div>
              <p className="metric-label">Recommended plan</p>
              <strong>{getRecommendedPlan(metrics.areaM2)}</strong>
            </div>
            <button type="button" className="button primary" onClick={saveQuote} disabled={!canSave}>
              {saving ? 'Saving...' : savedQuoteId ? 'Saved' : 'Save quote'}
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
};
