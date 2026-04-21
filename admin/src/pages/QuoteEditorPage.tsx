import { useEffect, useMemo, useRef, useState } from 'react';
import { QuoteEditorMap } from '../components/QuoteEditorMap';
import {
  adminApi,
  type AdminPolygonSource,
  type AdminQuoteEditorResponse,
  type AuthTokenProvider
} from '../lib/api';
import { formatNumber, toFt, toFt2 } from '../lib/quoteEditorGeometry';
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
import type {
  EditablePolygon,
  LngLat,
  PolygonEditorState,
  PolygonKind,
  SelectionTarget
} from '../lib/quoteEditorTypes';
import { getCalculatedPerSession, getRecommendedPlan, getSeasonalTotalRange } from '../lib/quoteMath';

interface QuoteEditorPageProps {
  getToken: AuthTokenProvider;
  quoteId: string;
  onBack: () => void;
}

const EMPTY_EDITOR_STATE: PolygonEditorState = {
  polygons: [],
  activePolygonId: null
};
const SERVICE_FREQUENCY = 'weekly' as const;

const createPolygonId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `polygon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toEditorState = (polygonSource: AdminPolygonSource): PolygonEditorState => ({
  polygons: polygonSource.polygons.map((polygon) => ({
    id: polygon.id,
    kind: polygon.kind,
    ringPoints: polygon.ringPoints.map(([lng, lat]) => [lng, lat] as [number, number]),
    rawStrokePoints:
      polygon.rawStrokePoints?.map(([lng, lat]) => [lng, lat] as [number, number]) ?? null
  })),
  activePolygonId:
    polygonSource.activePolygonId && polygonSource.polygons.some((item) => item.id === polygonSource.activePolygonId)
      ? polygonSource.activePolygonId
      : polygonSource.polygons[0]?.id ?? null
});

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

const getCenterFromPolygons = (polygons: EditablePolygon[]): LngLat => {
  const points = polygons.flatMap((polygon) => polygon.ringPoints);
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

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');

const activeDrawButtonStyle = (kind: PolygonKind) =>
  kind === 'service'
    ? {
        borderColor: 'rgba(37,118,68,0.95)',
        background: 'rgba(50,159,91,0.92)',
        color: '#ffffff',
        boxShadow: '0 0 0 2px rgba(50,159,91,0.2)'
      }
    : {
        borderColor: 'rgba(185,28,28,0.95)',
        background: 'rgba(220,38,38,0.92)',
        color: '#ffffff',
        boxShadow: '0 0 0 2px rgba(220,38,38,0.18)'
      };

const inactiveObstacleButtonStyle = {
  borderColor: 'rgba(220,38,38,0.28)',
  color: 'var(--danger)'
};

export const QuoteEditorPage = ({ getToken, quoteId, onBack }: QuoteEditorPageProps) => {
  const polygonCounterRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [savingVersion, setSavingVersion] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [resendingApprovedEmail, setResendingApprovedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdminQuoteEditorResponse | null>(null);
  const [polygonHistory, setPolygonHistory] = useState(() => createPolygonHistory(EMPTY_EDITOR_STATE));
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'none' });
  const [drawMode, setDrawMode] = useState<PolygonKind | null>(null);
  const [clearAllConfirmation, setClearAllConfirmation] = useState(false);
  const [unitMode, setUnitMode] = useState<'metric' | 'imperial'>('metric');
  const [center, setCenter] = useState<LngLat>([-79.51962, 43.844147]);
  const [distanceToNearestStationKm, setDistanceToNearestStationKm] = useState(0);
  const [perSessionTotalText, setPerSessionTotalText] = useState('0');
  const [finalTotalText, setFinalTotalText] = useState('0');
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);

  const editorState = polygonHistory.present;
  const polygons = editorState.polygons;
  const activePolygonId = editorState.activePolygonId;
  const activePolygon = polygons.find((polygon) => polygon.id === activePolygonId) ?? null;
  const metrics = useMemo(() => computeMultiPolygonMetrics(polygons), [polygons]);
  const calculatedPerSessionTotal = useMemo(
    () => getCalculatedPerSession(metrics.areaM2, metrics.perimeterM, distanceToNearestStationKm),
    [metrics.areaM2, metrics.perimeterM, distanceToNearestStationKm]
  );
  const calculatedSeasonalRange = useMemo(
    () => getSeasonalTotalRange(calculatedPerSessionTotal, SERVICE_FREQUENCY),
    [calculatedPerSessionTotal]
  );
  const actualPerSessionTotal = Number(perSessionTotalText);
  const actualSeasonalRange = useMemo(
    () =>
      Number.isFinite(actualPerSessionTotal)
        ? getSeasonalTotalRange(actualPerSessionTotal, SERVICE_FREQUENCY)
        : getSeasonalTotalRange(0, SERVICE_FREQUENCY),
    [actualPerSessionTotal]
  );
  const canUndo = polygonHistory.past.length > 0;
  const canRedo = polygonHistory.future.length > 0;

  const canSaveVersion =
    !loading &&
    !savingVersion &&
    metrics.validServicePolygonCount > 0 &&
    !metrics.selfIntersecting &&
    !metrics.effectiveGeometryEmpty &&
    Number.isFinite(actualPerSessionTotal) &&
    actualPerSessionTotal >= 0 &&
    Number.isFinite(Number(finalTotalText)) &&
    Number(finalTotalText) >= 0;

  const canSubmitSelectedVersion =
    !loading &&
    !submittingVersion &&
    selectedVersionNumber !== null &&
    (editor?.status === 'in_review' || editor?.status === 'submitted');
  const canResendApprovedEmail =
    !loading &&
    !resendingApprovedEmail &&
    editor?.status === 'verified' &&
    editor?.customerStatus === 'awaiting_payment';

  const loadEditor = async (options?: { message?: string; keepSelectedVersion?: number | null }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getQuoteEditor(getToken, quoteId);
      setEditor(response);
      const initialState = toEditorState(response.polygonSource);
      setPolygonHistory(createPolygonHistory(initialState));
      const defaultPolygonId = initialState.activePolygonId ?? initialState.polygons[0]?.id ?? null;
      setSelection(
        defaultPolygonId
          ? {
              kind: 'polygon',
              polygonId: defaultPolygonId
            }
          : { kind: 'none' }
      );
      setDrawMode(null);
      setClearAllConfirmation(false);
      setCenter(getCenterFromPolygons(initialState.polygons));
      setDistanceToNearestStationKm(response.calculated.distanceToNearestStationKm ?? 0);
      setPerSessionTotalText(String(response.editable.perSessionTotal));
      setFinalTotalText(String(response.editable.finalTotal));
      setOverrideReason(response.editable.overrideReason ?? '');
      setSelectedVersionNumber(options?.keepSelectedVersion ?? response.versions[0]?.versionNumber ?? null);
      setInfo(options?.message ?? null);
    } catch (err) {
      setEditor(null);
      setInfo(null);
      setError(err instanceof Error ? err.message : 'Unable to load quote editor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEditor();
  }, [quoteId]);

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

  useEffect(() => {
    if (!clearAllConfirmation) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setClearAllConfirmation(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [clearAllConfirmation]);

  const setActivePolygon = (nextPolygonId: string | null) => {
    setPolygonHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        activePolygonId: nextPolygonId
      }
    }));
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
  };

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
    setInfo(null);
  };

  const toggleDrawMode = (nextKind: PolygonKind) => {
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setError(null);
    setInfo(null);
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
    setError(null);
    setInfo(null);
  };

  const handleRedo = () => {
    setPolygonHistory((current) => redoPolygonEdit(current));
    setClearAllConfirmation(false);
    setSelection({ kind: 'none' });
    setError(null);
    setInfo(null);
  };

  const handleDeleteSelection = () => {
    setClearAllConfirmation(false);
    if (selection.kind === 'none') {
      return;
    }

    if (selection.kind === 'polygon') {
      setPolygonHistory((current) => {
        return applyPolygonEdit(current, removePolygonFromEditorState(current.present, selection.polygonId));
      });
      setSelection({ kind: 'none' });
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
  };

  const clearAllGeometry = () => {
    setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
    setSelection({ kind: 'none' });
    setDrawMode(null);
    setClearAllConfirmation(false);
    setInfo('All mapped polygons were cleared from the editor.');
    setError(null);
  };

  const handleClearAll = () => {
    if (!clearAllConfirmation) {
      setClearAllConfirmation(true);
      setError(null);
      setInfo(null);
      return;
    }

    clearAllGeometry();
  };

  const saveVersion = async () => {
    if (!canSaveVersion) {
      return;
    }

    setSavingVersion(true);
    setError(null);
    setInfo(null);

    try {
      const response = await adminApi.createQuoteVersion(getToken, quoteId, {
        polygonSource: fromEditorState(editorState),
        serviceFrequency: SERVICE_FREQUENCY,
        perSessionTotal: Number(perSessionTotalText),
        finalTotal: Number(finalTotalText),
        overrideReason: overrideReason.trim() || undefined
      });

      await loadEditor({
        message: `Saved version ${response.version}.`,
        keepSelectedVersion: response.version
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save version.');
    } finally {
      setSavingVersion(false);
    }
  };

  const submitSelectedVersion = async () => {
    if (!canSubmitSelectedVersion || selectedVersionNumber === null) {
      return;
    }

    setSubmittingVersion(true);
    setError(null);
    setInfo(null);
    try {
      const response = await adminApi.submitQuoteVersion(getToken, quoteId, selectedVersionNumber);
      const emailMessage =
        response.approvedQuoteEmail?.deliveryStatus === 'failed'
          ? ` Approved quote email failed: ${response.approvedQuoteEmail.errorMessage ?? 'unknown error'}.`
          : ' Approved quote email sent.';
      await loadEditor({
        message: `Submitted version ${selectedVersionNumber}. Quote is now Verified (Awaiting Payment).${emailMessage}`,
        keepSelectedVersion: selectedVersionNumber
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit selected version.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  const resendApprovedQuoteEmail = async () => {
    if (!canResendApprovedEmail) {
      return;
    }

    setResendingApprovedEmail(true);
    setError(null);
    setInfo(null);
    try {
      const response = await adminApi.resendApprovedQuoteEmail(getToken, quoteId);
      const emailMessage =
        response.approvedQuoteEmail?.deliveryStatus === 'failed'
          ? `Resend recorded as failed: ${response.approvedQuoteEmail.errorMessage ?? 'unknown error'}.`
          : 'Approved quote email resent.';
      await loadEditor({
        message: emailMessage,
        keepSelectedVersion: selectedVersionNumber
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend approved quote email.');
    } finally {
      setResendingApprovedEmail(false);
    }
  };

  const loadVersionIntoEditor = (versionNumber: number) => {
    const version = editor?.versions.find((item) => item.versionNumber === versionNumber);
    if (!version) {
      return;
    }

    if (!version.polygonSource) {
      setError('Selected version has no polygon source payload to load.');
      return;
    }

    const nextState = toEditorState(version.polygonSource);
    setPolygonHistory(createPolygonHistory(nextState));
    const defaultPolygonId = nextState.activePolygonId ?? nextState.polygons[0]?.id ?? null;
    setSelection(
      defaultPolygonId
        ? {
            kind: 'polygon',
            polygonId: defaultPolygonId
          }
        : { kind: 'none' }
    );
    setDrawMode(null);
    setClearAllConfirmation(false);
    setCenter(getCenterFromPolygons(nextState.polygons));
    setPerSessionTotalText(String(version.perSessionTotal));
    setFinalTotalText(String(version.finalTotal));
    setOverrideReason(version.overrideReason ?? '');
    setSelectedVersionNumber(version.versionNumber);
    setInfo(`Loaded version ${version.versionNumber} into editor.`);
    setError(null);
  };

  const activePolygonSummary =
    activePolygon === null
      ? 'None selected'
      : `${activePolygon.kind === 'service' ? 'Service' : 'Obstacle'} (${activePolygon.ringPoints.length} points)`;

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

  if (!loading && !editor) {
    return (
      <section className="panel" style={{ gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2>Quote Editor: {quoteId}</h2>
            <p className="hint">Unable to load quote data for this ID.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button type="button" className="button" onClick={onBack}>
              Back to Quotes
            </button>
          </div>
        </div>

        {error ? <p className="error-banner">{error}</p> : null}
        <p className="hint">
          If the server is running without a database (`DATABASE_URL` not set), quotes are in-memory and are cleared on
          server restart.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" style={{ gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h2>Quote Editor: {quoteId}</h2>
          <p className="hint">
            Status: {editor?.status ?? '...'} | Customer: {editor?.customerStatus ?? '...'} | Created:{' '}
            {formatDate(editor?.createdAt ?? null)} | Submitted: {formatDate(editor?.submittedAt ?? null)}
          </p>
          <p className="hint">
            Lead: {editor?.lead.name ?? 'N/A'} | {editor?.lead.email ?? 'N/A'} | {editor?.lead.phone ?? 'N/A'}
          </p>
          <p className="hint">Address: {editor?.addressText ?? 'Loading...'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <button type="button" className="button" onClick={onBack}>
            Back to Quotes
          </button>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="hint">{info}</p> : null}

      {loading ? <p className="hint">Loading quote editor...</p> : null}

      {!loading ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)' }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {metrics.selfIntersecting ? (
              <p className="error-banner">Overlapping boundary edges detected. Adjust vertices before saving.</p>
            ) : null}
            {metrics.effectiveGeometryEmpty ? (
              <p className="error-banner">Obstacles remove the entire service area. Adjust boundaries before saving.</p>
            ) : null}

            <div style={{ position: 'relative' }}>
              <QuoteEditorMap
                center={center}
                drawMode={drawMode}
                selection={selection}
                polygons={polygons}
                activePolygonId={activePolygonId}
                onPolygonDrawn={(kind, shape) => {
                  createDrawnPolygon(kind, shape.ringPoints, shape.rawStrokePoints);
                }}
                onPolygonRingPointsChange={(polygonId, nextPoints) => {
                  applyPolygonPointsEdit(polygonId, nextPoints);
                }}
                onSelectionChange={handleMapSelectionChange}
              />

              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '1rem',
                  zIndex: 20,
                  display: 'flex',
                  gap: '0.45rem',
                  padding: '0.45rem',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(14,20,17,0.86)',
                  boxShadow: '0 14px 28px rgba(0,0,0,0.26)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  aria-label="Undo"
                  style={{ minWidth: '2.6rem', minHeight: '2.6rem', padding: '0.35rem 0.55rem' }}
                >
                  <span aria-hidden="true">&larr;</span>
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  aria-label="Redo"
                  style={{ minWidth: '2.6rem', minHeight: '2.6rem', padding: '0.35rem 0.55rem' }}
                >
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </div>

              <div
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  display: 'flex',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: 'calc(100% - 7.5rem)',
                  padding: '0.6rem 0.7rem',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(11,17,14,0.88)',
                  boxShadow: '0 18px 32px rgba(0,0,0,0.24)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <button
                  type="button"
                  className="button"
                  onClick={() => toggleDrawMode('service')}
                  style={isServiceDrawMode ? activeDrawButtonStyle('service') : undefined}
                >
                  {isServiceDrawMode ? 'Stop drawing' : 'Draw lawn'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => toggleDrawMode('obstacle')}
                  style={isObstacleDrawMode ? activeDrawButtonStyle('obstacle') : inactiveObstacleButtonStyle}
                >
                  {isObstacleDrawMode ? 'Stop drawing' : 'Draw obstacle'}
                </button>
                <div
                  aria-hidden="true"
                  style={{ width: '1px', height: '2rem', background: 'rgba(255,255,255,0.14)' }}
                />
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button"
                    onClick={handleDeleteSelection}
                    disabled={selection.kind === 'none'}
                    style={selection.kind === 'none' ? undefined : inactiveObstacleButtonStyle}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={handleClearAll}
                    disabled={polygons.length === 0}
                    style={clearAllConfirmation ? activeDrawButtonStyle('obstacle') : inactiveObstacleButtonStyle}
                  >
                    {clearAllConfirmation ? 'Confirm clear all' : 'Clear all'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <article className="metric-card">
              <p className="metric-label">Map Stats</p>
              <p className="hint">Area: {areaValue}</p>
              <p className="hint">Perimeter: {perimeterValue}</p>
              <p className="hint">
                Service polygons: {metrics.validServicePolygonCount} valid / {metrics.servicePolygonCount}
              </p>
              <p className="hint">
                Obstacle polygons: {metrics.validObstaclePolygonCount} valid / {metrics.obstaclePolygonCount}
              </p>
              <p className="hint">Active polygon: {activePolygonSummary}</p>
              <p className="hint">Recommended plan: {getRecommendedPlan(metrics.areaM2)}</p>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="button"
                  onClick={() => setUnitMode((current) => (current === 'metric' ? 'imperial' : 'metric'))}
                >
                  Units: {unitMode === 'metric' ? 'Metric' : 'Imperial'}
                </button>
              </div>
            </article>

            <article className="metric-card">
              <p className="metric-label">Calculated Quote (Read-only)</p>
              <p className="hint">Per visit: ${calculatedPerSessionTotal.toFixed(2)}</p>
              <p className="hint">
                Seasonal: ${calculatedSeasonalRange.seasonalTotalMin.toFixed(2)} - $
                {calculatedSeasonalRange.seasonalTotalMax.toFixed(2)}
              </p>
              <p className="hint">
                Visits: {calculatedSeasonalRange.sessionsMax}, May to September
              </p>
            </article>

            <article className="metric-card">
              <p className="metric-label">Actual Quote (Editable)</p>
              <p className="hint">Season schedule: weekly, 20 visits from May to September.</p>
              <label>
                Per-visit total (CAD)
                <input
                  value={perSessionTotalText}
                  onChange={(event) => setPerSessionTotalText(event.target.value)}
                />
              </label>
              <label>
                Final total (CAD)
                <input
                  value={finalTotalText}
                  onChange={(event) => setFinalTotalText(event.target.value)}
                />
              </label>
              <label>
                Revision reason (optional)
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                />
              </label>
              <p className="hint">
                Actual seasonal: ${actualSeasonalRange.seasonalTotalMin.toFixed(2)} - $
                {actualSeasonalRange.seasonalTotalMax.toFixed(2)}
              </p>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button type="button" className="button primary" onClick={saveVersion} disabled={!canSaveVersion}>
                  {savingVersion ? 'Saving Version...' : 'Save New Version'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={submitSelectedVersion}
                  disabled={!canSubmitSelectedVersion}
                >
                  {submittingVersion ? 'Submitting...' : 'Submit Selected Version'}
                </button>
              </div>
            </article>

            <article className="metric-card">
              <p className="metric-label">Approved Quote Email</p>
              {editor?.approvedQuoteEmail ? (
                <>
                  <p className="hint">
                    Last attempt: {editor.approvedQuoteEmail.status} via {editor.approvedQuoteEmail.provider} on{' '}
                    {new Date(editor.approvedQuoteEmail.createdAt).toLocaleString()}
                  </p>
                  <p className="hint">Trigger: {editor.approvedQuoteEmail.triggerSource}</p>
                  <p className="hint">Recipient: {editor.approvedQuoteEmail.recipientEmail ?? 'N/A'}</p>
                  <p className="hint">
                    Approved version: v{editor.approvedQuoteEmail.approvedVersionNumber}
                  </p>
                  {editor.approvedQuoteEmail.errorMessage ? (
                    <p className="hint" style={{ color: 'var(--danger)' }}>
                      Error: {editor.approvedQuoteEmail.errorMessage}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {editor.approvedQuoteEmail.previewImageUrl ? (
                      <a className="button" href={editor.approvedQuoteEmail.previewImageUrl} target="_blank" rel="noreferrer">
                        Open Preview
                      </a>
                    ) : null}
                    {editor.approvedQuoteEmail.paymentPageUrl ? (
                      <a className="button" href={editor.approvedQuoteEmail.paymentPageUrl} target="_blank" rel="noreferrer">
                        Open Payment Page
                      </a>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="hint">No approved quote email attempt has been recorded yet.</p>
              )}

              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="button"
                  onClick={resendApprovedQuoteEmail}
                  disabled={!canResendApprovedEmail}
                >
                  {resendingApprovedEmail ? 'Resending...' : 'Resend Approved Email'}
                </button>
              </div>
            </article>

            <article className="metric-card">
              <p className="metric-label">Version History</p>
              <div style={{ display: 'grid', gap: '0.45rem', maxHeight: '280px', overflow: 'auto', marginTop: '0.55rem' }}>
                {(editor?.versions ?? []).map((version) => (
                  <div
                    key={version.versionNumber}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.55rem',
                      background:
                        selectedVersionNumber === version.versionNumber
                          ? 'rgba(50, 159, 91, 0.12)'
                          : 'var(--surface-muted)'
                    }}
                  >
                    <p className="hint">
                      v{version.versionNumber} | {version.actorType} | {new Date(version.changedAt).toLocaleString()}
                    </p>
                    <p className="hint">
                      Per visit: ${version.perSessionTotal.toFixed(2)} | Final: ${version.finalTotal.toFixed(2)}
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="button"
                        onClick={() => setSelectedVersionNumber(version.versionNumber)}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() => loadVersionIntoEditor(version.versionNumber)}
                        disabled={!version.polygonSource}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
};
