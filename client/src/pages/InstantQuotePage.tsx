import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuoteMap } from '../components/quote/QuoteMap';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import { getAttributionSnapshot } from '../lib/attribution';
import { fetchAddressSuggestions } from '../lib/geocoding';
import { formatNumber, toFt, toFt2 } from '../lib/geometry';
import { computeMultiPolygonMetrics } from '../lib/multiPolygonMetrics';
import {
  applyPolygonEdit,
  createPolygonHistory,
  redoPolygonEdit,
  undoPolygonEdit
} from '../lib/polygonHistory';
import {
  canContinueToMapStep,
  getCoverageGateDestination,
  getSubmissionStatus
} from '../lib/quoteFlow';
import {
  getQuoteTotal,
  getRecommendedPlan,
  getSeasonalTotalRange,
  quotePricing
} from '../lib/quote';
import {
  clearQuoteDraftState,
  loadQuoteDraftState,
  saveQuoteDraftState
} from '../lib/quoteDraftPersistence';
import type {
  LngLat,
  MapboxSuggestion,
  OutOfServiceAreaRouteState,
  PolygonEditorState,
  PolygonKind,
  ServiceFrequency,
  SelectionTarget
} from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER: LngLat = [-96.797, 32.7767];

type UnitMode = 'metric' | 'imperial';
type QuoteStep = 'address' | 'map';

const EMPTY_EDITOR_STATE: PolygonEditorState = {
  polygons: [],
  activePolygonId: null
};

const getAddressKey = (suggestion: MapboxSuggestion) => {
  const id = suggestion.id.trim();
  if (id.length > 0) {
    return id;
  }

  return suggestion.place_name.trim().toLowerCase();
};

const createPolygonId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `polygon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const InstantQuotePage = () => {
  const navigate = useNavigate();
  const polygonCounterRef = useRef(0);
  const mapStepRef = useRef<HTMLDivElement | null>(null);
  const attributionRef = useRef(getAttributionSnapshot());
  const restoredFromStorageRef = useRef(false);

  const [addressInput, setAddressInput] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedAddressKey, setSelectedAddressKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [center, setCenter] = useState<LngLat>(DEFAULT_CENTER);
  const [currentStep, setCurrentStep] = useState<QuoteStep>('address');
  const [polygonHistory, setPolygonHistory] = useState(() =>
    createPolygonHistory(EMPTY_EDITOR_STATE)
  );
  const [drawing, setDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'none' });
  const [unitMode, setUnitMode] = useState<UnitMode>('metric');
  const [serviceFrequency, setServiceFrequency] = useState<ServiceFrequency>('weekly');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  const editorState = polygonHistory.present;
  const polygons = editorState.polygons;
  const activePolygonId = editorState.activePolygonId;
  const activePolygon = polygons.find((polygon) => polygon.id === activePolygonId) ?? null;

  const metrics = useMemo(() => computeMultiPolygonMetrics(polygons), [polygons]);
  const recommendedPlan = useMemo(() => getRecommendedPlan(metrics.areaM2), [metrics.areaM2]);
  const quoteTotal = useMemo(() => getQuoteTotal(metrics), [metrics]);
  const seasonalRange = useMemo(
    () => getSeasonalTotalRange(quoteTotal, serviceFrequency),
    [quoteTotal, serviceFrequency]
  );
  const canUndo = polygonHistory.past.length > 0;
  const canRedo = polygonHistory.future.length > 0;
  const canContinueToMap = canContinueToMapStep({
    selectedAddress,
    addressInput
  });
  const servicePolygons = polygons.filter((polygon) => polygon.kind === 'service');
  const obstaclePolygons = polygons.filter((polygon) => polygon.kind === 'obstacle');
  const submissionStatus = getSubmissionStatus({
    selectedAddress,
    validServicePolygonCount: metrics.validServicePolygonCount,
    selfIntersecting: metrics.selfIntersecting,
    effectiveGeometryEmpty: metrics.effectiveGeometryEmpty
  });

  const canSubmit =
    selectedAddress.trim().length > 0 &&
    metrics.validServicePolygonCount > 0 &&
    metrics.geometry !== null &&
    !metrics.selfIntersecting &&
    !metrics.effectiveGeometryEmpty &&
    !submitting;

  const activePolygonSummary =
    activePolygon === null
      ? 'None selected'
      : `${activePolygon.kind === 'service' ? 'Service' : 'Obstacle'} (${activePolygon.points.length} points)`;

  useEffect(() => {
    const trimmed = addressInput.trim();

    if (trimmed.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const nextSuggestions = await fetchAddressSuggestions({
          query: trimmed,
          token: MAPBOX_TOKEN,
          limit: 5,
          types: 'address,place'
        });
        setSuggestions(nextSuggestions);
        setHighlightedSuggestionIndex((current) =>
          nextSuggestions.length === 0 ? -1 : Math.min(current, nextSuggestions.length - 1)
        );
      } catch {
        setSuggestions([]);
        setHighlightedSuggestionIndex(-1);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [addressInput]);

  useEffect(() => {
    if (suggestions.length === 0) {
      setHighlightedSuggestionIndex(-1);
      return;
    }

    setHighlightedSuggestionIndex((current) => {
      if (current < 0) {
        return current;
      }
      return Math.min(current, suggestions.length - 1);
    });
  }, [suggestions]);

  useEffect(() => {
    if (currentStep !== 'map') {
      return;
    }

    mapStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentStep]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      restoredFromStorageRef.current = true;
      return;
    }

    const restoredState = loadQuoteDraftState(window.localStorage);
    if (!restoredState) {
      restoredFromStorageRef.current = true;
      return;
    }

    setAddressInput(restoredState.addressInput);
    setSelectedAddress(restoredState.selectedAddress);
    setSelectedAddressKey(restoredState.selectedAddressKey);
    setCenter(restoredState.center);
    setCurrentStep(restoredState.currentStep);
    setPolygonHistory(restoredState.polygonHistory);
    setServiceFrequency(restoredState.serviceFrequency);
    setUnitMode(restoredState.unitMode);
    setDrawing(false);
    setSelection({ kind: 'none' });
    restoredFromStorageRef.current = true;
    setStatusMessage({
      type: 'info',
      text: 'Restored your saved quote draft.'
    });
  }, []);

  useEffect(() => {
    if (!restoredFromStorageRef.current || typeof window === 'undefined') {
      return;
    }

    saveQuoteDraftState(window.localStorage, {
      addressInput,
      selectedAddress,
      selectedAddressKey,
      center,
      currentStep,
      polygonHistory,
      serviceFrequency,
      unitMode
    });
  }, [
    addressInput,
    selectedAddress,
    selectedAddressKey,
    center,
    currentStep,
    polygonHistory,
    serviceFrequency,
    unitMode
  ]);

  const setActivePolygon = (nextPolygonId: string | null) => {
    setPolygonHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        activePolygonId: nextPolygonId
      }
    }));
  };

  const clearEditorForNewAddress = () => {
    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setDrawing(false);
    setSelection({ kind: 'none' });
  };

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    const nextAddressKey = getAddressKey(suggestion);
    const isDifferentAddress = selectedAddressKey !== null && selectedAddressKey !== nextAddressKey;

    setAddressInput(suggestion.place_name);
    setSelectedAddress(suggestion.place_name);
    setSelectedAddressKey(nextAddressKey);
    setCenter(suggestion.center);
    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);
    setStatusMessage(null);

    if (isDifferentAddress) {
      clearEditorForNewAddress();
    }
  };

  const resolveAddressSelection = async (): Promise<{ address: string; center: LngLat } | null> => {
    if (selectedAddress.trim().length > 0) {
      return {
        address: selectedAddress,
        center
      };
    }

    if (!MAPBOX_TOKEN) {
      setStatusMessage({
        type: 'error',
        text: '`VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.'
      });
      return null;
    }

    const query = addressInput.trim();
    if (query.length < 3) {
      setStatusMessage({
        type: 'error',
        text: 'Enter at least 3 characters so we can find your address.'
      });
      return null;
    }

    setLoadingSuggestions(true);
    try {
      const fallbackSuggestions =
        suggestions.length > 0
          ? suggestions
          : await fetchAddressSuggestions({
              query,
              token: MAPBOX_TOKEN,
              limit: 5,
              types: 'address,place'
            });
      if (!fallbackSuggestions[0]) {
        setStatusMessage({ type: 'error', text: 'Address not found. Try a more specific search.' });
        return null;
      }

      const selectedSuggestion = fallbackSuggestions[0];
      selectSuggestion(selectedSuggestion);
      return {
        address: selectedSuggestion.place_name,
        center: selectedSuggestion.center
      };
    } catch {
      setStatusMessage({ type: 'error', text: 'Unable to fetch address suggestions right now.' });
      return null;
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const goToMapStep = async () => {
    if (!canContinueToMap) {
      return;
    }

    const resolvedAddress = await resolveAddressSelection();
    if (!resolvedAddress) {
      return;
    }

    try {
      const coverage = await api.checkServiceArea({
        lat: resolvedAddress.center[1],
        lng: resolvedAddress.center[0]
      });

      if (!coverage.inServiceArea) {
        navigate(getCoverageGateDestination('out-of-area'), {
          state: {
            address: resolvedAddress.address,
            location: resolvedAddress.center
          } satisfies OutOfServiceAreaRouteState
        });
        return;
      }
    } catch {
      navigate(getCoverageGateDestination('check-failed'));
      return;
    }

    setCurrentStep('map');
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await goToMapStep();
  };

  const goToAddressStep = () => {
    setCurrentStep('address');
    setDrawing(false);
    setSelection({ kind: 'none' });
  };

  const handleAddressInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSuggestionIndex((current) => Math.max(current - 1, -1));
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSuggestions([]);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    if (
      event.key === 'Enter' &&
      highlightedSuggestionIndex >= 0 &&
      suggestions[highlightedSuggestionIndex]
    ) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedSuggestionIndex]);
    }
  };

  const clearAllGeometry = () => {
    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setSelection({ kind: 'none' });
    setDrawing(false);
    setStatusMessage({
      type: 'info',
      text: 'All mapped polygons were cleared.'
    });
  };

  const resetQuoteDraft = () => {
    setAddressInput('');
    setSelectedAddress('');
    setSelectedAddressKey(null);
    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);
    setCenter(DEFAULT_CENTER);
    setCurrentStep('address');
    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setDrawing(false);
    setSelection({ kind: 'none' });
    setUnitMode('metric');
    setServiceFrequency('weekly');
    polygonCounterRef.current = 0;

    if (typeof window !== 'undefined') {
      clearQuoteDraftState(window.localStorage);
    }

    setStatusMessage({
      type: 'info',
      text: 'Saved draft reset. You can start a new quote now.'
    });
  };

  const applyPolygonPointsEdit = (polygonId: string, nextPoints: LngLat[]) => {
    setPolygonHistory((current) => {
      const nextPolygons = current.present.polygons.map((polygon) =>
        polygon.id === polygonId ? { ...polygon, points: nextPoints } : polygon
      );

      return applyPolygonEdit(current, {
        polygons: nextPolygons,
        activePolygonId: current.present.activePolygonId
      });
    });

    setStatusMessage(null);
  };

  const addPolygonByKind = (kind: PolygonKind) => {
    polygonCounterRef.current += 1;
    const polygonId = `${createPolygonId()}-${polygonCounterRef.current}`;

    setPolygonHistory((current) =>
      applyPolygonEdit(current, {
        polygons: [...current.present.polygons, { id: polygonId, kind, points: [] }],
        activePolygonId: polygonId
      })
    );

    setSelection({ kind: 'polygon', polygonId });
    setDrawing(true);
    setStatusMessage(null);
  };

  const addServicePolygon = () => addPolygonByKind('service');
  const addObstaclePolygon = () => addPolygonByKind('obstacle');

  const handleMapSelectionChange = (nextSelection: SelectionTarget) => {
    setSelection(nextSelection);

    if (nextSelection.kind !== 'none') {
      setActivePolygon(nextSelection.polygonId);
    }
  };

  const handleUndo = () => {
    setPolygonHistory((current) => undoPolygonEdit(current));
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleRedo = () => {
    setPolygonHistory((current) => redoPolygonEdit(current));
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleDeleteSelection = () => {
    if (selection.kind === 'none') {
      return;
    }

    if (selection.kind === 'polygon') {
      setPolygonHistory((current) => {
        const nextPolygons = current.present.polygons.filter(
          (polygon) => polygon.id !== selection.polygonId
        );
        const nextActivePolygonId = nextPolygons.some(
          (polygon) => polygon.id === current.present.activePolygonId
        )
          ? current.present.activePolygonId
          : (nextPolygons[0]?.id ?? null);

        return applyPolygonEdit(current, {
          polygons: nextPolygons,
          activePolygonId: nextActivePolygonId
        });
      });
      setSelection({ kind: 'none' });
      setStatusMessage(null);
      return;
    }

    const selectedPolygon = polygons.find((polygon) => polygon.id === selection.polygonId);
    if (!selectedPolygon) {
      setSelection({ kind: 'none' });
      return;
    }

    applyPolygonPointsEdit(
      selection.polygonId,
      selectedPolygon.points.filter((_, index) => index !== selection.index)
    );
    setSelection({ kind: 'none' });
  };

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
      (selection.index < 0 || selection.index >= selectedPolygon.points.length)
    ) {
      setSelection({ kind: 'none' });
    }
  }, [polygons, selection]);

  useEffect(() => {
    if (activePolygonId === null && polygons.length > 0) {
      setActivePolygon(polygons[0].id);
      return;
    }

    if (activePolygonId && !polygons.some((polygon) => polygon.id === activePolygonId)) {
      setActivePolygon(polygons[0]?.id ?? null);
    }
  }, [activePolygonId, polygons]);

  const handleSubmitQuote = async () => {
    if (!canSubmit || !metrics.geometry) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await api.submitQuoteDraft(
        {
          address: selectedAddress,
          location: {
            lat: center[1],
            lng: center[0]
          },
          polygon: metrics.geometry,
          polygonSource: {
            schemaVersion: 1,
            activePolygonId: editorState.activePolygonId,
            polygons: editorState.polygons.map((polygonState) => ({
              id: polygonState.id,
              kind: polygonState.kind,
              points: polygonState.points
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
          attribution: attributionRef.current
        },
        createIdempotencyKey()
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

  const areaValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.areaM2)} m2`
      : `${formatNumber(toFt2(metrics.areaM2))} ft2`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.perimeterM)} m`
      : `${formatNumber(toFt(metrics.perimeterM))} ft`;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-12 md:px-8 md:py-16">
      <SectionTitle
        badge="Instant Quote"
        title="Map your property and generate a quote instantly"
        description="No sign-up required to build your draft quote."
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card
          className={`border transition-all ${
            currentStep === 'address'
              ? 'border-brand bg-brand/20 ring-2 ring-brand/90'
              : 'border-white/15 bg-black/35 text-white/65'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-white/70">Step 1</p>
          <p className="mt-2 text-lg font-semibold text-white">Enter address</p>
          <p className="mt-1 text-sm text-white/70">
            Select a property address to lock the map center.
          </p>
        </Card>
        <Card
          className={`border transition-all ${
            currentStep === 'map'
              ? 'border-brand bg-brand/20 ring-2 ring-brand/90'
              : 'border-white/15 bg-black/35 text-white/65'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-white/70">Step 2</p>
          <p className="mt-2 text-lg font-semibold text-white">Map your lawn</p>
          <p className="mt-1 text-sm text-white/70">
            Draw service polygons and obstacles, then request your quote.
          </p>
        </Card>
      </div>

      {currentStep === 'address' ? (
        <div className="relative isolate z-50 mt-8 grid gap-6">
          <Card className="relative z-20 overflow-visible bg-black/65">
            <form onSubmit={handleAddressSubmit} className="flex flex-col gap-3">
              <label htmlFor="address" className="block text-sm text-white/80">
                Enter your address
              </label>
              <div className="flex items-start gap-3">
                <div className="relative z-30 flex-1">
                  <input
                    id="address"
                    value={addressInput}
                    onChange={(event) => {
                      setAddressInput(event.target.value);
                      setSelectedAddress('');
                      setSelectedAddressKey(null);
                      setHighlightedSuggestionIndex(-1);
                    }}
                    onKeyDown={handleAddressInputKeyDown}
                    placeholder="123 Greenway Blvd, Vaughan, ON"
                    className="w-full rounded-xl border border-white/20 bg-black/60 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
                    aria-autocomplete="list"
                    aria-expanded={suggestions.length > 0}
                    aria-controls="address-suggestions"
                  />
                  {loadingSuggestions ? (
                    <p className="absolute -bottom-6 left-0 text-xs text-white/60">
                      Searching addresses...
                    </p>
                  ) : null}
                  {suggestions.length > 0 ? (
                    <div
                      id="address-suggestions"
                      role="listbox"
                      className="absolute left-0 top-full z-[9999] mt-2 w-full overflow-hidden rounded-xl border border-white/20 bg-black/95 shadow-soft"
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => selectSuggestion(suggestion)}
                          onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                          className={`block w-full border-b border-white/10 px-4 py-3 text-left text-sm transition-colors last:border-0 ${
                            highlightedSuggestionIndex === index
                              ? 'bg-white/15 text-white'
                              : 'text-white/85 hover:bg-white/10'
                          }`}
                          role="option"
                          aria-selected={highlightedSuggestionIndex === index}
                        >
                          {suggestion.place_name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="submit"
                  disabled={!canContinueToMap}
                  className="shrink-0 whitespace-nowrap px-5 py-3"
                >
                  Continue to Step 2
                </Button>
              </div>
            </form>

            {statusMessage ? (
              <p
                className={
                  statusMessage.type === 'error'
                    ? 'mt-4 text-sm text-red-300'
                    : 'mt-4 text-sm text-white/75'
                }
              >
                {statusMessage.text}
              </p>
            ) : null}

            <button
              type="button"
              onClick={resetQuoteDraft}
              className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-white/55 transition-colors hover:text-brand"
            >
              Reset Saved Draft
            </button>
          </Card>

          {!MAPBOX_TOKEN ? (
            <Card className="border-red-300/40 bg-red-950/30">
              <p className="text-sm text-red-200">
                `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.
              </p>
            </Card>
          ) : null}
        </div>
      ) : (
        <div ref={mapStepRef} className="mt-8 grid gap-6">
          <Card className="flex flex-col gap-4 bg-black/65 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-brand">
                Step 2: Map your lawn
              </p>
              <p className="mt-2 text-sm text-white/78">Address locked to map center:</p>
              <p className="mt-1 text-base text-white">{selectedAddress}</p>
            </div>
            <Button type="button" variant="secondary" onClick={goToAddressStep}>
              Change Address
            </Button>
          </Card>

          {!MAPBOX_TOKEN ? (
            <Card className="border-red-300/40 bg-red-950/30">
              <p className="text-sm text-red-200">
                `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="space-y-4">
                <Card className="bg-black/45">
                  <p className="text-sm text-white/78">
                    Click to add points around the area you want serviced. Drag any vertex at any
                    time to refine the boundary, then use on-map tools to add service polygons, add
                    obstacles, undo, redo, or delete selected geometry.
                  </p>

                  {metrics.selfIntersecting ? (
                    <p className="mt-4 rounded-lg border border-red-300/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                      Overlapping boundary edges detected. Adjust vertices to continue.
                    </p>
                  ) : null}

                  {metrics.effectiveGeometryEmpty ? (
                    <p className="mt-4 rounded-lg border border-red-300/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                      Obstacles remove the entire service area. Adjust boundaries to continue.
                    </p>
                  ) : null}
                </Card>

                <div className="relative">
                  <QuoteMap
                    token={MAPBOX_TOKEN}
                    center={center}
                    drawing={drawing}
                    selection={selection}
                    polygons={polygons}
                    activePolygonId={activePolygonId}
                    onPointAdd={(polygonId, point) => {
                      const targetPolygon = polygons.find((polygon) => polygon.id === polygonId);
                      if (!targetPolygon) {
                        return;
                      }

                      applyPolygonPointsEdit(polygonId, [...targetPolygon.points, point]);

                      if (selection.kind === 'none') {
                        setSelection({ kind: 'polygon', polygonId });
                      }
                    }}
                    onPolygonPointsChange={(polygonId, nextPoints) => {
                      applyPolygonPointsEdit(polygonId, nextPoints);
                    }}
                    onSelectionChange={handleMapSelectionChange}
                  />

                  <div
                    className="absolute z-20 w-full px-3"
                    style={{
                      top: '0.75rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      className="mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/20 bg-black/80 px-3 py-2 shadow-soft backdrop-blur-sm"
                      style={{
                        width: 'max-content',
                        maxWidth: '100%',
                        pointerEvents: 'auto'
                      }}
                    >
                      <Button
                        variant={drawing ? 'secondary' : 'primary'}
                        onClick={() => setDrawing((current) => !current)}
                        disabled={activePolygonId === null}
                      >
                        {drawing ? 'Stop Drawing' : 'Start Drawing'}
                      </Button>
                      <Button variant="secondary" onClick={addServicePolygon}>
                        Add Polygon
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={addObstaclePolygon}
                        className="border-red-300/50 text-red-100 hover:border-red-300/80 hover:text-red-50"
                      >
                        Add Obstacle
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={clearAllGeometry}
                        disabled={polygons.length === 0}
                      >
                        Clear All
                      </Button>
                      <Button variant="secondary" onClick={handleUndo} disabled={!canUndo}>
                        Undo
                      </Button>
                      <Button variant="secondary" onClick={handleRedo} disabled={!canRedo}>
                        Redo
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleDeleteSelection}
                        disabled={selection.kind === 'none'}
                        className={
                          selection.kind === 'none'
                            ? 'border-white/20 text-white/40 hover:border-white/20 hover:text-white/40'
                            : 'border-red-300/40 text-red-200 hover:border-red-300/60 hover:text-red-100'
                        }
                      >
                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-300/40 bg-red-500/20 text-xs font-bold leading-none text-red-200">
                          X
                        </span>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="h-fit bg-black/70 xl:sticky xl:top-24">
                <p className="text-xs uppercase tracking-[0.17em] text-brand">Quote Summary</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Recommended Plan</h3>
                <p className="mt-2 text-sm text-white/72">{recommendedPlan}</p>

                <div className="mt-5 inline-flex overflow-hidden rounded-full border border-white/20">
                  <button
                    type="button"
                    onClick={() => setUnitMode('metric')}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                      unitMode === 'metric' ? 'bg-brand text-black' : 'bg-transparent text-white/75'
                    }`}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('imperial')}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                      unitMode === 'imperial'
                        ? 'bg-brand text-black'
                        : 'bg-transparent text-white/75'
                    }`}
                  >
                    Imperial
                  </button>
                </div>

                <div className="mt-6 space-y-3 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span>Area</span>
                    <span>{areaValue}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Perimeter</span>
                    <span>{perimeterValue}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Base fee</span>
                    <span>${quotePricing.baseFee.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/65">
                    Service frequency
                  </p>
                  <div className="mt-2 inline-flex overflow-hidden rounded-full border border-white/20">
                    <button
                      type="button"
                      onClick={() => setServiceFrequency('weekly')}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        serviceFrequency === 'weekly'
                          ? 'bg-brand text-black'
                          : 'bg-transparent text-white/75'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceFrequency('biweekly')}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                        serviceFrequency === 'biweekly'
                          ? 'bg-brand text-black'
                          : 'bg-transparent text-white/75'
                      }`}
                    >
                      Bi-weekly
                    </button>
                  </div>
                </div>

                <a
                  href="/how-rate-is-calculated"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-brand underline underline-offset-4 hover:text-brand/85"
                >
                  How the rate is calculated
                </a>

                <div className="mt-6 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-brand">Per Session</p>
                  <p className="mt-1 text-3xl font-bold text-white">${quoteTotal.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-white/80">
                    Estimated seasonal total: ${seasonalRange.seasonalTotalMin.toFixed(2)} - $
                    {seasonalRange.seasonalTotalMax.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {seasonalRange.sessionsMin}-{seasonalRange.sessionsMax} sessions
                  </p>
                </div>

                <div className="mt-6 space-y-3 text-sm text-white/72">
                  <p>Address: {selectedAddress}</p>
                  <p>Cadence: {serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'}</p>
                  <p>
                    Service polygons: {metrics.validServicePolygonCount} valid /{' '}
                    {servicePolygons.length} total
                  </p>
                  <p>
                    Obstacle polygons: {metrics.validObstaclePolygonCount} valid /{' '}
                    {obstaclePolygons.length} total
                  </p>
                  <p>Active polygon: {activePolygonSummary}</p>
                  <p>Submission status: {submissionStatus}</p>
                </div>

                <p className="mt-4 text-xs text-white/55">
                  Draft progress is auto-saved in this browser.
                </p>
                <button
                  type="button"
                  onClick={resetQuoteDraft}
                  className="mt-2 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-white/55 transition-colors hover:text-brand"
                >
                  Reset Saved Draft
                </button>

                {statusMessage ? (
                  <p
                    className={
                      statusMessage.type === 'error'
                        ? 'mt-4 text-sm text-red-300'
                        : 'mt-4 text-sm text-white/75'
                    }
                  >
                    {statusMessage.text}
                  </p>
                ) : null}

                <Button className="mt-6 w-full" onClick={handleSubmitQuote} disabled={!canSubmit}>
                  {submitting ? 'Saving Quote Draft...' : 'Continue to Contact Details'}
                </Button>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
