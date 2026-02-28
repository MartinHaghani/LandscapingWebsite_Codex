import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuoteMap } from '../components/quote/QuoteMap';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionTitle } from '../components/ui/SectionTitle';
import { StatsBar } from '../components/ui/StatsBar';
import { api, ApiError } from '../lib/api';
import { closeRing, computeMetrics, formatNumber, toFt, toFt2 } from '../lib/geometry';
import { getQuoteTotal, getRecommendedPlan, quotePricing } from '../lib/quote';
import type { LngLat, MapboxSuggestion } from '../types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER: LngLat = [-96.797, 32.7767];

type UnitMode = 'metric' | 'imperial';

const fetchAddressSuggestions = async (query: string) => {
  if (!MAPBOX_TOKEN) {
    return [] as MapboxSuggestion[];
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?autocomplete=true&types=address,place&limit=5&access_token=${MAPBOX_TOKEN}`
  );

  const data = (await response.json()) as {
    features?: Array<{ id: string; place_name: string; center: [number, number] }>;
  };

  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    place_name: feature.place_name,
    center: feature.center
  }));
};

export const InstantQuotePage = () => {
  const navigate = useNavigate();

  const [addressInput, setAddressInput] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [center, setCenter] = useState<LngLat>(DEFAULT_CENTER);
  const [points, setPoints] = useState<LngLat[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [unitMode, setUnitMode] = useState<UnitMode>('metric');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const metrics = useMemo(() => computeMetrics(points), [points]);
  const recommendedPlan = useMemo(() => getRecommendedPlan(metrics.areaM2), [metrics.areaM2]);
  const quoteTotal = useMemo(() => getQuoteTotal(metrics), [metrics]);

  const canSubmit =
    selectedAddress.trim().length > 0 && points.length >= 3 && !metrics.selfIntersecting && !submitting;

  useEffect(() => {
    const trimmed = addressInput.trim();

    if (trimmed.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const nextSuggestions = await fetchAddressSuggestions(trimmed);
        setSuggestions(nextSuggestions);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [addressInput]);

  const selectSuggestion = (suggestion: MapboxSuggestion) => {
    setAddressInput(suggestion.place_name);
    setSelectedAddress(suggestion.place_name);
    setCenter(suggestion.center);
    setSuggestions([]);
    setStatusMessage(null);
  };

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (suggestions[0]) {
      selectSuggestion(suggestions[0]);
      return;
    }

    const fallbackQuery = addressInput.trim();
    if (fallbackQuery.length < 3) {
      return;
    }

    try {
      const fallbackSuggestions = await fetchAddressSuggestions(fallbackQuery);
      if (!fallbackSuggestions[0]) {
        setStatusMessage({ type: 'error', text: 'Address not found. Try a more specific search.' });
        return;
      }

      selectSuggestion(fallbackSuggestions[0]);
    } catch {
      setStatusMessage({ type: 'error', text: 'Unable to fetch address suggestions right now.' });
    }
  };

  const handleSubmitQuote = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await api.submitQuote({
        address: selectedAddress,
        location: {
          lat: center[1],
          lng: center[0]
        },
        polygon: {
          type: 'Polygon',
          coordinates: [closeRing(points)]
        },
        metrics: {
          areaM2: metrics.areaM2,
          perimeterM: metrics.perimeterM
        },
        plan: recommendedPlan,
        quoteTotal
      });

      navigate(`/quote-confirmation/${response.quoteId}`);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof ApiError ? error.message : 'Quote request failed.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const areaValue = unitMode === 'metric' ? `${formatNumber(metrics.areaM2)} m²` : `${formatNumber(toFt2(metrics.areaM2))} ft²`;
  const perimeterValue =
    unitMode === 'metric' ? `${formatNumber(metrics.perimeterM)} m` : `${formatNumber(toFt(metrics.perimeterM))} ft`;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-12 md:px-8 md:py-16">
      <SectionTitle
        badge="Instant Quote"
        title="Map your property and generate a quote instantly"
        description="Step A: Search your address. Step B: Draw your service boundary. Step C: Request a deterministic instant quote."
      />

      <div className="relative isolate z-50 mt-8 grid gap-6">
        <Card className="relative z-20 overflow-visible bg-black/65">
          <form onSubmit={handleAddressSubmit} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="relative z-30 flex-1">
              <label htmlFor="address" className="mb-2 block text-sm text-white/80">
                Enter your address
              </label>
              <input
                id="address"
                value={addressInput}
                onChange={(event) => {
                  setAddressInput(event.target.value);
                  setSelectedAddress('');
                }}
                placeholder="Placeholder: 123 Future Lawn Ave, Smart City"
                className="w-full rounded-xl border border-white/20 bg-black/60 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
              />
              {loadingSuggestions ? (
                <p className="absolute -bottom-6 left-0 text-xs text-white/60">Searching addresses...</p>
              ) : null}
              {suggestions.length > 0 ? (
                <div className="absolute left-0 top-full z-[9999] mt-2 w-full overflow-hidden rounded-xl border border-white/20 bg-black/95 shadow-soft">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="block w-full border-b border-white/10 px-4 py-3 text-left text-sm text-white/85 transition-colors last:border-0 hover:bg-white/10"
                    >
                      {suggestion.place_name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <Button type="submit" className="md:mb-0.5 md:self-end">
              Center Map
            </Button>
          </form>
        </Card>

        <div className="relative z-0">
          <StatsBar
            items={[
              { label: 'Area', value: areaValue },
              { label: 'Perimeter', value: perimeterValue },
              { label: 'Vertices', value: String(metrics.vertexCount) }
            ]}
          />
        </div>
      </div>

      {!MAPBOX_TOKEN ? (
        <Card className="mt-8 border-red-300/40 bg-red-950/30">
          <p className="text-sm text-red-200">
            `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token to `client/.env`.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <Card className="bg-black/45">
              <p className="text-sm text-white/78">
                Click to add points around the area you want serviced. Toggle edit mode to drag vertices.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant={drawing ? 'secondary' : 'primary'}
                  onClick={() => {
                    setDrawing((current) => !current);
                    if (!drawing) {
                      setEditMode(false);
                    }
                  }}
                >
                  {drawing ? 'Stop Drawing' : 'Start Drawing'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPoints((current) => current.slice(0, -1))}
                  disabled={points.length === 0}
                >
                  Undo Last Point
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPoints([]);
                    setDrawing(false);
                    setEditMode(false);
                  }}
                  disabled={points.length === 0}
                >
                  Clear Polygon
                </Button>
                <Button
                  variant={editMode ? 'primary' : 'secondary'}
                  onClick={() => {
                    setEditMode((current) => !current);
                    setDrawing(false);
                  }}
                  disabled={points.length < 1}
                >
                  {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
                </Button>
                <div className="ml-auto flex overflow-hidden rounded-full border border-white/20">
                  <button
                    type="button"
                    onClick={() => setUnitMode('metric')}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      unitMode === 'metric' ? 'bg-brand text-black' : 'bg-transparent text-white/75'
                    }`}
                  >
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('imperial')}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      unitMode === 'imperial' ? 'bg-brand text-black' : 'bg-transparent text-white/75'
                    }`}
                  >
                    Imperial
                  </button>
                </div>
              </div>

              {metrics.selfIntersecting ? (
                <p className="mt-4 rounded-lg border border-red-300/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  Polygon self-intersects. Adjust vertices before requesting your quote.
                </p>
              ) : null}
            </Card>

            <QuoteMap
              token={MAPBOX_TOKEN}
              center={center}
              drawing={drawing}
              editMode={editMode}
              points={points}
              onPointAdd={(point) => {
                setPoints((current) => [...current, point]);
                setStatusMessage(null);
              }}
              onPointsChange={(nextPoints) => {
                setPoints(nextPoints);
                setStatusMessage(null);
              }}
            />
          </div>

          <Card className="h-fit bg-black/70 xl:sticky xl:top-24">
            <p className="text-xs uppercase tracking-[0.17em] text-brand">Quote Summary</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Recommended Plan</h3>
            <p className="mt-2 text-sm text-white/72">{recommendedPlan}</p>

            <div className="mt-6 space-y-3 text-sm text-white/80">
              <div className="flex items-center justify-between">
                <span>Area</span>
                <span>{formatNumber(metrics.areaM2)} m²</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Perimeter</span>
                <span>{formatNumber(metrics.perimeterM)} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Base fee</span>
                <span>${quotePricing.baseFee.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Area rate</span>
                <span>${quotePricing.areaRate.toFixed(3)}/m²</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Perimeter rate</span>
                <span>${quotePricing.perimeterRate.toFixed(2)}/m</span>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-brand">Instant Quote</p>
              <p className="mt-1 text-3xl font-bold text-white">${quoteTotal.toFixed(2)}</p>
            </div>

            <div className="mt-6 space-y-3 text-sm text-white/72">
              <p>Address: {selectedAddress || 'Select a suggested address to lock the property center.'}</p>
              <p>Polygon points: {points.length}</p>
              <p>
                Submission status:{' '}
                {points.length < 3
                  ? 'Add at least 3 points.'
                  : metrics.selfIntersecting
                    ? 'Fix self-intersection.'
                    : selectedAddress
                      ? 'Ready to submit.'
                      : 'Select an address.'}
              </p>
            </div>

            {statusMessage ? (
              <p className={statusMessage.type === 'error' ? 'mt-4 text-sm text-red-300' : 'mt-4 text-sm text-white/75'}>
                {statusMessage.text}
              </p>
            ) : null}

            <Button className="mt-6 w-full" onClick={handleSubmitQuote} disabled={!canSubmit}>
              {submitting ? 'Submitting Quote...' : 'Request This Quote'}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
