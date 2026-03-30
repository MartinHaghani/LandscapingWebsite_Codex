import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuoteDoneButton } from '../components/quote/QuoteDoneButton';
import { QuoteGuideModal } from '../components/quote/QuoteGuideModal';
import { QuoteMap } from '../components/quote/QuoteMap';
import { QuoteProgressRail } from '../components/quote/QuoteProgressRail';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
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
  deleteVertexOrPolygonFromEditorState,
  removePolygonFromEditorState
} from '../lib/polygonEditing';
import {
  canContinueToMapStep,
  canSubmitQuoteDraft,
  getCoverageGateDestination,
  getSubmissionStatus
} from '../lib/quoteFlow';
import {
  createQuoteGuideSessionState,
  dismissActiveQuoteGuideSession,
  getNextQuoteGuideStepIndex,
  getPreviousQuoteGuideStepIndex,
  isActiveQuoteGuideSessionDismissed,
  startNextQuoteGuideSession
} from '../lib/quoteGuide';
import {
  clearQuoteDraftState,
  loadQuoteDraftState,
  saveQuoteDraftState
} from '../lib/quoteDraftPersistence';
import type {
  BillingMode,
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
const QUOTE_GUIDE_REVEAL_DELAY_MS = 1000;

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
  const restoredFromStorageRef = useRef(false);
  const guideRevealTimeoutRef = useRef<number | null>(null);

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
  const [drawMode, setDrawMode] = useState<PolygonKind | null>(null);
  const [clearAllConfirmation, setClearAllConfirmation] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'none' });
  const [unitMode, setUnitMode] = useState<UnitMode>('metric');
  const [serviceFrequency, setServiceFrequency] = useState<ServiceFrequency>('weekly');
  const [billingMode, setBillingMode] = useState<BillingMode>('seasonal');
  const [distanceToNearestStationKm, setDistanceToNearestStationKm] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);
  const [quoteGuideSessionState, setQuoteGuideSessionState] = useState(
    createQuoteGuideSessionState
  );
  const [quoteGuideWaitingForMapReady, setQuoteGuideWaitingForMapReady] = useState(false);
  const [quoteGuideVisible, setQuoteGuideVisible] = useState(false);
  const [quoteGuideActiveStepIndex, setQuoteGuideActiveStepIndex] = useState(0);

  const editorState = polygonHistory.present;
  const polygons = editorState.polygons;
  const activePolygonId = editorState.activePolygonId;

  const metrics = useMemo(() => computeMultiPolygonMetrics(polygons), [polygons]);
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
  const canContinueToReview = canSubmitQuoteDraft({
    selectedAddress,
    validServicePolygonCount: metrics.validServicePolygonCount,
    hasGeometry: metrics.geometry !== null,
    selfIntersecting: metrics.selfIntersecting,
    effectiveGeometryEmpty: metrics.effectiveGeometryEmpty
  });

  const clearQuoteGuideRevealTimer = () => {
    if (guideRevealTimeoutRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.clearTimeout(guideRevealTimeoutRef.current);
    guideRevealTimeoutRef.current = null;
  };

  const resetQuoteGuideState = () => {
    clearQuoteGuideRevealTimer();
    setQuoteGuideSessionState(createQuoteGuideSessionState());
    setQuoteGuideWaitingForMapReady(false);
    setQuoteGuideVisible(false);
    setQuoteGuideActiveStepIndex(0);
  };

  const beginQuoteGuideSession = () => {
    clearQuoteGuideRevealTimer();
    setQuoteGuideSessionState((current) => startNextQuoteGuideSession(current));
    setQuoteGuideWaitingForMapReady(true);
    setQuoteGuideVisible(false);
    setQuoteGuideActiveStepIndex(0);
  };

  const dismissQuoteGuide = () => {
    clearQuoteGuideRevealTimer();
    setQuoteGuideSessionState((current) => dismissActiveQuoteGuideSession(current));
    setQuoteGuideWaitingForMapReady(false);
    setQuoteGuideVisible(false);
  };

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
    setBillingMode(restoredState.billingMode);
    setDistanceToNearestStationKm(restoredState.distanceToNearestStationKm);
    setUnitMode(restoredState.unitMode);
    setDrawMode(null);
    setSelection({ kind: 'none' });
    restoredFromStorageRef.current = true;
    setStatusMessage({
      type: 'info',
      text: 'Restored your saved quote draft.'
    });
  }, []);

  useEffect(() => {
    return () => {
      if (guideRevealTimeoutRef.current === null || typeof window === 'undefined') {
        return;
      }

      window.clearTimeout(guideRevealTimeoutRef.current);
      guideRevealTimeoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!quoteGuideVisible || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [quoteGuideVisible]);

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
      billingMode,
      distanceToNearestStationKm,
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
    billingMode,
    distanceToNearestStationKm,
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
    setDrawMode(null);
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setDistanceToNearestStationKm(0);
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
      resetQuoteGuideState();
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

      const nextDistanceToNearestStationKm =
        typeof coverage.distanceToNearestStationKm === 'number' &&
        Number.isFinite(coverage.distanceToNearestStationKm)
          ? coverage.distanceToNearestStationKm
          : 0;

      setDistanceToNearestStationKm(nextDistanceToNearestStationKm);
    } catch {
      navigate(getCoverageGateDestination('check-failed'));
      return;
    }

    setCurrentStep('map');
    beginQuoteGuideSession();
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await goToMapStep();
  };

  const goToAddressStep = () => {
    resetQuoteGuideState();
    setCurrentStep('address');
    setDrawMode(null);
    setClearAllConfirmation(false);
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
    setDrawMode(null);
    setClearAllConfirmation(false);
    setStatusMessage({
      type: 'info',
      text: 'All mapped polygons were cleared.'
    });
  };

  const resetQuoteDraft = () => {
    resetQuoteGuideState();
    setAddressInput('');
    setSelectedAddress('');
    setSelectedAddressKey(null);
    setSuggestions([]);
    setHighlightedSuggestionIndex(-1);
    setCenter(DEFAULT_CENTER);
    setCurrentStep('address');
    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setDrawMode(null);
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setUnitMode('metric');
    setServiceFrequency('weekly');
    setBillingMode('seasonal');
    setDistanceToNearestStationKm(0);
    polygonCounterRef.current = 0;

    if (typeof window !== 'undefined') {
      clearQuoteDraftState(window.localStorage);
    }

    setStatusMessage({
      type: 'info',
      text: 'Saved draft reset. You can start a new quote now.'
    });
  };

  const handleQuoteMapReady = () => {
    if (
      currentStep !== 'map' ||
      !quoteGuideWaitingForMapReady ||
      isActiveQuoteGuideSessionDismissed(quoteGuideSessionState) ||
      typeof window === 'undefined'
    ) {
      return;
    }

    clearQuoteGuideRevealTimer();
    guideRevealTimeoutRef.current = window.setTimeout(() => {
      setQuoteGuideVisible(true);
      guideRevealTimeoutRef.current = null;
    }, QUOTE_GUIDE_REVEAL_DELAY_MS);
    setQuoteGuideWaitingForMapReady(false);
  };

  const handleQuoteGuidePrevious = () => {
    setQuoteGuideActiveStepIndex((current) => getPreviousQuoteGuideStepIndex(current));
  };

  const handleQuoteGuideNext = () => {
    setQuoteGuideActiveStepIndex((current) => getNextQuoteGuideStepIndex(current));
  };

  const applyPolygonPointsEdit = (polygonId: string, nextPoints: LngLat[]) => {
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

    setStatusMessage(null);
  };

  const createDrawnPolygon = (
    kind: PolygonKind,
    ringPoints: LngLat[],
    rawStrokePoints: LngLat[]
  ) => {
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
    setStatusMessage(null);
  };

  const toggleDrawMode = (nextKind: PolygonKind) => {
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setStatusMessage(null);
    setDrawMode((current) => (current === nextKind ? null : nextKind));
  };

  const handleMapSelectionChange = (nextSelection: SelectionTarget) => {
    setClearAllConfirmation(false);
    setSelection(nextSelection);

    if (nextSelection.kind !== 'none') {
      setActivePolygon(nextSelection.polygonId);
    }
  };

  const handleUndo = () => {
    setPolygonHistory((current) => undoPolygonEdit(current));
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleRedo = () => {
    setPolygonHistory((current) => redoPolygonEdit(current));
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleDeleteSelection = () => {
    setClearAllConfirmation(false);
    if (selection.kind === 'none') {
      return;
    }

    if (selection.kind === 'polygon') {
      setPolygonHistory((current) => {
        return applyPolygonEdit(
          current,
          removePolygonFromEditorState(current.present, selection.polygonId)
        );
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

    setPolygonHistory((current) =>
      applyPolygonEdit(
        current,
        deleteVertexOrPolygonFromEditorState(current.present, selection.polygonId, selection.index)
      )
    );
    setSelection({ kind: 'none' });
    setStatusMessage(null);
  };

  const handleClearAll = () => {
    if (!clearAllConfirmation) {
      setClearAllConfirmation(true);
      setStatusMessage(null);
      return;
    }

    clearAllGeometry();
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
      (selection.index < 0 || selection.index >= selectedPolygon.ringPoints.length)
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

  useEffect(() => {
    if (!clearAllConfirmation) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setClearAllConfirmation(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [clearAllConfirmation]);

  const persistCurrentDraft = () => {
    if (typeof window === 'undefined') {
      return;
    }

    saveQuoteDraftState(window.localStorage, {
      addressInput,
      selectedAddress,
      selectedAddressKey,
      center,
      currentStep: 'map',
      polygonHistory,
      serviceFrequency,
      billingMode,
      distanceToNearestStationKm,
      unitMode
    });
  };

  const handleContinueToReview = () => {
    if (!canContinueToReview) {
      return;
    }

    setDrawMode(null);
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setStatusMessage(null);
    persistCurrentDraft();
    navigate('/instant-quote/summary');
  };

  const areaValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.areaM2)} m2`
      : `${formatNumber(toFt2(metrics.areaM2))} ft2`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.perimeterM)} m`
      : `${formatNumber(toFt(metrics.perimeterM))} ft`;
  const isServiceDrawMode = drawMode === 'service';
  const isObstacleDrawMode = drawMode === 'obstacle';

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-4xl">
        <Badge>Instant Quote</Badge>
        <h1 className="sr-only">Instant Quote</h1>
      </div>

      <QuoteProgressRail currentStep={currentStep} />

      {currentStep === 'address' ? (
        <div className="relative isolate z-50 mt-8 grid gap-6">
          <Card className="relative z-20 overflow-visible bg-surface">
            <form onSubmit={handleAddressSubmit} className="flex flex-col gap-3">
              <label htmlFor="address" className="form-label">
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
                    className="form-input"
                    aria-autocomplete="list"
                    aria-expanded={suggestions.length > 0}
                    aria-controls="address-suggestions"
                  />
                  {loadingSuggestions ? (
                    <p className="absolute -bottom-6 left-0 text-xs text-copy-muted">
                      Searching addresses...
                    </p>
                  ) : null}
                  {suggestions.length > 0 ? (
                    <div
                      id="address-suggestions"
                      role="listbox"
                      className="absolute left-0 top-full z-[9999] mt-2 w-full overflow-hidden rounded-xl border border-stroke bg-surface shadow-soft"
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => selectSuggestion(suggestion)}
                          onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                          className={`block w-full border-b border-stroke px-4 py-3 text-left text-sm transition-colors last:border-0 ${
                            highlightedSuggestionIndex === index
                              ? 'bg-brand/10 text-ink'
                              : 'text-copy-muted hover:bg-brand/10'
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
                  Continue to Map
                </Button>
              </div>
            </form>

            {statusMessage ? (
              <p
                className={
                  statusMessage.type === 'error'
                    ? 'mt-4 text-sm text-red-700'
                    : 'mt-4 text-sm text-copy-muted'
                }
              >
                {statusMessage.text}
              </p>
            ) : null}

            <button
              type="button"
              onClick={resetQuoteDraft}
              className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-copy-muted transition-colors hover:text-brand"
            >
              Reset Saved Draft
            </button>
          </Card>

          {!MAPBOX_TOKEN ? (
            <Card className="border-red-300/70 bg-red-50">
              <p className="text-sm text-red-700">
                `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.
              </p>
            </Card>
          ) : null}
        </div>
      ) : (
        <div ref={mapStepRef} className="mt-8 grid gap-6">
          <div className="flex items-center justify-between gap-3 rounded-full border border-stroke/80 bg-surface/70 px-4 py-2 text-sm shadow-soft">
            <p className="min-w-0 truncate text-copy-muted">{selectedAddress}</p>
            <Button
              type="button"
              variant="ghost"
              onClick={goToAddressStep}
              className="min-h-0 shrink-0 px-3 py-1.5 text-xs uppercase tracking-[0.14em]"
            >
              Change Address
            </Button>
          </div>

          {!MAPBOX_TOKEN ? (
            <Card className="border-red-300/70 bg-red-50">
              <p className="text-sm text-red-700">
                `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {metrics.selfIntersecting ? (
                <p className="status-error">
                  Overlapping boundary edges detected. Adjust vertices to continue.
                </p>
              ) : null}

              {metrics.effectiveGeometryEmpty ? (
                <p className="status-error">
                  Obstacles remove the entire service area. Adjust boundaries to continue.
                </p>
              ) : null}

              <div className="relative">
                <QuoteMap
                  token={MAPBOX_TOKEN}
                  center={center}
                  drawMode={drawMode}
                  selection={selection}
                  polygons={polygons}
                  activePolygonId={activePolygonId}
                  className="h-[68vh] min-h-[460px] md:h-[74vh] md:min-h-[620px]"
                  onPolygonDrawn={(kind, shape) => {
                    createDrawnPolygon(kind, shape.ringPoints, shape.rawStrokePoints);
                  }}
                  onPolygonRingPointsChange={(polygonId, nextPoints) => {
                    applyPolygonPointsEdit(polygonId, nextPoints);
                  }}
                  onSelectionChange={handleMapSelectionChange}
                  onMapReady={handleQuoteMapReady}
                />

                {quoteGuideVisible ? (
                  <QuoteGuideModal
                    activeStepIndex={quoteGuideActiveStepIndex}
                    onClose={dismissQuoteGuide}
                    onPrevious={handleQuoteGuidePrevious}
                    onNext={handleQuoteGuideNext}
                  />
                ) : null}

                <div className="absolute left-3 top-3 z-20 rounded-2xl border border-stroke bg-surface/95 p-2 shadow-soft backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      aria-label="Undo"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-surface text-lg text-ink transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span aria-hidden="true">&larr;</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      aria-label="Redo"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-surface text-lg text-ink transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                </div>

                <div className="absolute right-3 top-3 z-20">
                  <QuoteDoneButton
                    onClick={handleContinueToReview}
                    disabled={!canContinueToReview}
                  />
                </div>

                <div
                  className="absolute inset-x-0 top-20 z-20 px-3 md:top-3"
                  style={{ pointerEvents: 'none' }}
                >
                  <div
                    className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-stroke bg-surface/95 px-3 py-2 shadow-soft backdrop-blur-sm"
                    style={{ pointerEvents: 'auto' }}
                  >
                    <Button
                      variant={isServiceDrawMode ? 'primary' : 'secondary'}
                      onClick={() => toggleDrawMode('service')}
                      className={cn(
                        isServiceDrawMode &&
                          'border-brand bg-brand text-ink shadow-[0_0_0_2px_rgba(50,159,91,0.22)]'
                      )}
                    >
                      {isServiceDrawMode ? 'Stop drawing' : 'Draw lawn'}
                    </Button>
                    <Button
                      variant={isObstacleDrawMode ? 'primary' : 'secondary'}
                      onClick={() => toggleDrawMode('obstacle')}
                      className={cn(
                        isObstacleDrawMode
                          ? 'border-red-500 bg-red-600 text-white shadow-[0_0_0_2px_rgba(220,38,38,0.2)] hover:bg-red-700'
                          : 'border-red-300/70 text-red-700 hover:border-red-400 hover:text-red-800'
                      )}
                    >
                      {isObstacleDrawMode ? 'Stop drawing' : 'Draw obstacle'}
                    </Button>
                    <div className="mx-1 h-8 w-px bg-stroke" />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleDeleteSelection}
                        disabled={selection.kind === 'none'}
                        className={
                          selection.kind === 'none'
                            ? 'border-stroke text-copy-muted hover:border-stroke hover:text-copy-muted'
                            : 'border-red-300/70 text-red-700 hover:border-red-400 hover:text-red-800'
                        }
                      >
                        Delete
                      </Button>
                      <Button
                        variant={clearAllConfirmation ? 'primary' : 'secondary'}
                        onClick={handleClearAll}
                        disabled={polygons.length === 0}
                        className={
                          clearAllConfirmation
                            ? 'border-red-500 bg-red-600 text-white hover:border-red-500 hover:bg-red-700'
                            : 'border-red-300/70 text-red-700 hover:border-red-400 hover:text-red-800'
                        }
                      >
                        {clearAllConfirmation ? 'Confirm clear all' : 'Clear all'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-surface">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 gap-3 text-sm text-copy-muted sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-stroke bg-surface-raised px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">Area</p>
                      <p className="mt-2 text-base font-semibold text-ink">{areaValue}</p>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-surface-raised px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">
                        Perimeter
                      </p>
                      <p className="mt-2 text-base font-semibold text-ink">{perimeterValue}</p>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-surface-raised px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">
                        Lawn shapes
                      </p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {metrics.validServicePolygonCount} valid / {servicePolygons.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-stroke bg-surface-raised px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-copy-muted">
                        Obstacle shapes
                      </p>
                      <p className="mt-2 text-base font-semibold text-ink">
                        {metrics.validObstaclePolygonCount} valid / {obstaclePolygons.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex overflow-hidden rounded-full border border-stroke">
                      <button
                        type="button"
                        onClick={() => setUnitMode('metric')}
                        className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                          unitMode === 'metric'
                            ? 'bg-brand text-ink'
                            : 'bg-transparent text-copy-muted'
                        }`}
                      >
                        Metric
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitMode('imperial')}
                        className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                          unitMode === 'imperial'
                            ? 'bg-brand text-ink'
                            : 'bg-transparent text-copy-muted'
                        }`}
                      >
                        Imperial
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={resetQuoteDraft}
                      className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-copy-muted transition-colors hover:text-brand"
                    >
                      Reset Saved Draft
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 text-sm text-copy-muted md:flex-row md:items-center md:justify-between">
                  <p>Status: {submissionStatus}</p>
                  <p>Draft progress is auto-saved in this browser.</p>
                </div>

                {statusMessage ? (
                  <p
                    className={
                      statusMessage.type === 'error'
                        ? 'mt-4 text-sm text-red-700'
                        : 'mt-4 text-sm text-copy-muted'
                    }
                  >
                    {statusMessage.text}
                  </p>
                ) : null}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
