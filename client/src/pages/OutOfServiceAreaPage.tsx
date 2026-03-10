import { Link, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ServiceAreaMap } from '../components/service/ServiceAreaMap';
import { api, ApiError, createIdempotencyKey } from '../lib/api';
import type { OutOfServiceAreaRouteState, ServiceAreaResponse } from '../types';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

const isValidState = (value: unknown): value is OutOfServiceAreaRouteState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeState = value as { address?: unknown; location?: unknown };

  return (
    typeof maybeState.address === 'string' &&
    Array.isArray(maybeState.location) &&
    maybeState.location.length === 2 &&
    typeof maybeState.location[0] === 'number' &&
    typeof maybeState.location[1] === 'number'
  );
};

export const OutOfServiceAreaPage = () => {
  const location = useLocation();
  const [serviceArea, setServiceArea] = useState<ServiceAreaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const state = isValidState(location.state) ? location.state : null;

  useEffect(() => {
    if (!state) {
      return;
    }

    let mounted = true;

    const loadServiceArea = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await api.getServiceArea();
        if (!mounted) {
          return;
        }

        setServiceArea(response);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setLoadError(error instanceof ApiError ? error.message : 'Unable to load the service area map right now.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadServiceArea();

    const requestCoverageExpansion = async () => {
      try {
        const keyBase = `${state.address}|${state.location[0].toFixed(5)}|${state.location[1].toFixed(5)}`;
        const deterministicKey =
          typeof window !== 'undefined'
            ? `out-of-area-${Array.from(new TextEncoder().encode(keyBase))
                .map((value) => value.toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 64)}`
            : createIdempotencyKey();

        await api.requestServiceArea(
          {
            addressText: state.address,
            lat: state.location[1],
            lng: state.location[0],
            source: 'out_of_area_page',
            isInServiceAreaAtCapture: false
          },
          deterministicKey
        );

        if (mounted) {
          setRequestStatus('saved');
        }
      } catch {
        if (mounted) {
          setRequestStatus('error');
        }
      }
    };

    void requestCoverageExpansion();

    return () => {
      mounted = false;
    };
  }, [state]);

  if (!state) {
    return <Navigate to="/instant-quote" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-8 md:py-20">
      <Card className="space-y-7 border-white/20 bg-black/70 p-7 md:p-10">
        <div className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.15em] text-brand">Service Availability</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-white md:text-6xl">
            Sorry, we are not in your area yet.
          </h1>
          <p className="mt-4 text-base text-white/75 md:text-lg">
            The address you entered is currently outside our active service area. We are expanding quickly and would
            still love to hear from you.
          </p>
          <p className="mt-2 text-sm text-white/65">Entered address: {state.address}</p>
        </div>

        {!MAPBOX_TOKEN ? (
          <p className="rounded-xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            `VITE_MAPBOX_TOKEN` is missing, so the map preview is unavailable.
          </p>
        ) : loadError ? (
          <p className="rounded-xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">{loadError}</p>
        ) : !serviceArea ? (
          <div className="flex h-[440px] items-center justify-center rounded-2xl border border-white/15 bg-black/45 text-sm text-white/65 md:h-[360px]">
            Loading coverage map...
          </div>
        ) : (
          <ServiceAreaMap
            token={MAPBOX_TOKEN}
            serviceArea={serviceArea}
            showOverlay={true}
            highlightedLocation={state.location}
            highlightedLabel="Your entered address"
          />
        )}

        {loading ? <p className="text-sm text-white/65">Loading coverage map...</p> : null}
        {requestStatus === 'saved' ? (
          <p className="text-sm text-white/65">We logged this location to help prioritize future expansion.</p>
        ) : null}
        {requestStatus === 'error' ? (
          <p className="text-sm text-red-300">We could not log this location right now, but you can still request service expansion.</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/instant-quote" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full sm:w-auto">
              Try a different address
            </Button>
          </Link>
          <Link to="/service-area-requested" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Request area to be added</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
