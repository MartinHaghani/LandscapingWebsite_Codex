import { useEffect, useMemo, useState } from 'react';
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
    points: polygon.points.map(([lng, lat]) => [lng, lat] as [number, number])
  })),
  activePolygonId:
    polygonSource.activePolygonId && polygonSource.polygons.some((item) => item.id === polygonSource.activePolygonId)
      ? polygonSource.activePolygonId
      : polygonSource.polygons[0]?.id ?? null
});

const fromEditorState = (state: PolygonEditorState): AdminPolygonSource => ({
  schemaVersion: 1,
  activePolygonId: state.activePolygonId,
  polygons: state.polygons.map((polygon) => ({
    id: polygon.id,
    kind: polygon.kind,
    points: polygon.points.map(([lng, lat]) => [lng, lat] as [number, number])
  }))
});

const getCenterFromPolygons = (polygons: EditablePolygon[]): LngLat => {
  const points = polygons.flatMap((polygon) => polygon.points);
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

export const QuoteEditorPage = ({ getToken, quoteId, onBack }: QuoteEditorPageProps) => {
  const [loading, setLoading] = useState(true);
  const [savingVersion, setSavingVersion] = useState(false);
  const [submittingVersion, setSubmittingVersion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdminQuoteEditorResponse | null>(null);

  const [polygonHistory, setPolygonHistory] = useState(() => createPolygonHistory(EMPTY_EDITOR_STATE));
  const [selection, setSelection] = useState<SelectionTarget>({ kind: 'none' });
  const [drawing, setDrawing] = useState(false);
  const [unitMode, setUnitMode] = useState<'metric' | 'imperial'>('metric');
  const [center, setCenter] = useState<LngLat>([-79.51962, 43.844147]);
  const [serviceFrequency, setServiceFrequency] = useState<'weekly' | 'biweekly'>('weekly');
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
    () => getCalculatedPerSession(metrics.areaM2, metrics.perimeterM),
    [metrics.areaM2, metrics.perimeterM]
  );
  const calculatedSeasonalRange = useMemo(
    () => getSeasonalTotalRange(calculatedPerSessionTotal, serviceFrequency),
    [calculatedPerSessionTotal, serviceFrequency]
  );
  const actualPerSessionTotal = Number(perSessionTotalText);
  const actualSeasonalRange = useMemo(
    () =>
      Number.isFinite(actualPerSessionTotal)
        ? getSeasonalTotalRange(actualPerSessionTotal, serviceFrequency)
        : getSeasonalTotalRange(0, serviceFrequency),
    [actualPerSessionTotal, serviceFrequency]
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

  const loadEditor = async (options?: { message?: string; keepSelectedVersion?: number | null }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getQuoteEditor(getToken, quoteId);
      setEditor(response);
      const initialState = toEditorState(response.polygonSource);
      setPolygonHistory(createPolygonHistory(initialState));
      setSelection({ kind: 'none' });
      setDrawing(false);
      setCenter(getCenterFromPolygons(initialState.polygons));
      setServiceFrequency(response.editable.serviceFrequency);
      setPerSessionTotalText(String(response.editable.perSessionTotal));
      setFinalTotalText(String(response.editable.finalTotal));
      setOverrideReason(response.editable.overrideReason ?? '');
      setSelectedVersionNumber(options?.keepSelectedVersion ?? response.versions[0]?.versionNumber ?? null);
      setInfo(options?.message ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load quote editor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEditor();
  }, [quoteId]);

  const setActivePolygon = (nextPolygonId: string | null) => {
    setPolygonHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        activePolygonId: nextPolygonId
      }
    }));
  };

  useEffect(() => {
    if (activePolygonId === null && polygons.length > 0) {
      setActivePolygon(polygons[0].id);
      return;
    }

    if (activePolygonId && !polygons.some((polygon) => polygon.id === activePolygonId)) {
      setActivePolygon(polygons[0]?.id ?? null);
    }
  }, [activePolygonId, polygons]);

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
  };

  const addPolygonByKind = (kind: PolygonKind) => {
    const polygonId = createPolygonId();

    setPolygonHistory((current) =>
      applyPolygonEdit(current, {
        polygons: [...current.present.polygons, { id: polygonId, kind, points: [] }],
        activePolygonId: polygonId
      })
    );

    setSelection({ kind: 'polygon', polygonId });
    setDrawing(true);
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
        serviceFrequency,
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
      await adminApi.submitQuoteVersion(getToken, quoteId, selectedVersionNumber);
      await loadEditor({
        message: `Submitted version ${selectedVersionNumber}. Quote is now Verified (Awaiting Payment).`,
        keepSelectedVersion: selectedVersionNumber
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit selected version.');
    } finally {
      setSubmittingVersion(false);
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
    setSelection({ kind: 'none' });
    setDrawing(false);
    setCenter(getCenterFromPolygons(nextState.polygons));
    setServiceFrequency(version.serviceFrequency);
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
      : `${activePolygon.kind === 'service' ? 'Service' : 'Obstacle'} (${activePolygon.points.length} points)`;

  const areaValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.areaM2)} m2`
      : `${formatNumber(toFt2(metrics.areaM2))} ft2`;
  const perimeterValue =
    unitMode === 'metric'
      ? `${formatNumber(metrics.perimeterM)} m`
      : `${formatNumber(toFt(metrics.perimeterM))} ft`;

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

      {editor?.polygonSourceFallback ? (
        <p className="error-banner">
          This quote did not store source polygons. Editor loaded a derived service polygon fallback.
        </p>
      ) : null}

      {error ? <p className="error-banner">{error}</p> : null}
      {info ? <p className="hint">{info}</p> : null}

      {loading ? <p className="hint">Loading quote editor...</p> : null}

      {!loading ? (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)' }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button"
                onClick={() => setDrawing((current) => !current)}
                disabled={activePolygonId === null}
              >
                {drawing ? 'Stop Drawing' : 'Start Drawing'}
              </button>
              <button type="button" className="button" onClick={() => addPolygonByKind('service')}>
                Add Polygon
              </button>
              <button type="button" className="button" onClick={() => addPolygonByKind('obstacle')}>
                Add Obstacle
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setPolygonHistory(createPolygonHistory(EMPTY_EDITOR_STATE));
                  setSelection({ kind: 'none' });
                  setDrawing(false);
                }}
                disabled={polygons.length === 0}
              >
                Clear All
              </button>
              <button type="button" className="button" onClick={() => setPolygonHistory((current) => undoPolygonEdit(current))} disabled={!canUndo}>
                Undo
              </button>
              <button type="button" className="button" onClick={() => setPolygonHistory((current) => redoPolygonEdit(current))} disabled={!canRedo}>
                Redo
              </button>
              <button type="button" className="button" onClick={handleDeleteSelection} disabled={selection.kind === 'none'}>
                Delete
              </button>
            </div>

            <QuoteEditorMap
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
              onSelectionChange={(nextSelection) => {
                setSelection(nextSelection);
                if (nextSelection.kind !== 'none') {
                  setActivePolygon(nextSelection.polygonId);
                }
              }}
            />
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

              {metrics.selfIntersecting ? (
                <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>
                  Polygon self-intersection detected. Fix geometry before saving.
                </p>
              ) : null}
              {metrics.effectiveGeometryEmpty ? (
                <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>
                  Obstacles remove entire service area. Fix geometry before saving.
                </p>
              ) : null}
            </article>

            <article className="metric-card">
              <p className="metric-label">Calculated Quote (Read-only)</p>
              <p className="hint">Per-session: ${calculatedPerSessionTotal.toFixed(2)}</p>
              <p className="hint">
                Seasonal: ${calculatedSeasonalRange.seasonalTotalMin.toFixed(2)} - $
                {calculatedSeasonalRange.seasonalTotalMax.toFixed(2)}
              </p>
              <p className="hint">
                Sessions: {calculatedSeasonalRange.sessionsMin}-{calculatedSeasonalRange.sessionsMax}
              </p>
            </article>

            <article className="metric-card">
              <p className="metric-label">Actual Quote (Editable)</p>
              <label>
                Service frequency
                <select
                  value={serviceFrequency}
                  onChange={(event) =>
                    setServiceFrequency(event.target.value === 'biweekly' ? 'biweekly' : 'weekly')
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </label>
              <label>
                Per-session total (CAD)
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
                      Per-session: ${version.perSessionTotal.toFixed(2)} | Final: ${version.finalTotal.toFixed(2)}
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
