import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ServiceAreaResponse } from '../../types';
import { api, ApiError } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

const LazyServiceAreaMap = lazy(() =>
  import('./ServiceAreaMap').then((module) => ({
    default: module.ServiceAreaMap
  }))
);

export const ServiceAreaSection = () => {
  const [serviceArea, setServiceArea] = useState<ServiceAreaResponse | null>(null);
  const [loadingMapData, setLoadingMapData] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadServiceArea = async () => {
      setLoadingMapData(true);
      setLoadingError(null);

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

        setLoadingError(error instanceof ApiError ? error.message : 'Unable to load service coverage right now.');
      } finally {
        if (mounted) {
          setLoadingMapData(false);
        }
      }
    };

    void loadServiceArea();

    return () => {
      mounted = false;
    };
  }, []);

  const servedRegions = useMemo(() => serviceArea?.metadata.servedRegions ?? ['Vaughan, Ontario'], [serviceArea]);

  return (
    <section className="mt-10" aria-labelledby="service-area-title">
      <Card className="space-y-6 border-white/20 bg-black/65">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h3 id="service-area-title" className="text-2xl font-semibold text-white md:text-3xl">
              Service Area
            </h3>
            <p className="mt-2 text-sm text-white/75 md:text-base">
              We currently service properties within the highlighted regions.
            </p>
          </div>

          <Link to="/instant-quote" className="w-full md:w-auto">
            <Button className="w-full px-8 py-4 text-base font-bold md:w-auto">Check my address</Button>
          </Link>
        </div>

        {loadingError ? (
          <p className="rounded-xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {loadingError}
          </p>
        ) : null}

        {!MAPBOX_TOKEN ? (
          <p className="rounded-xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            `VITE_MAPBOX_TOKEN` is missing. Add your Mapbox public token in `client/.env` to enable the service area
            map.
          </p>
        ) : null}

        <div>
          {MAPBOX_TOKEN && !loadingError ? (
            <Suspense
              fallback={
                <div className="flex h-[440px] items-center justify-center rounded-2xl border border-white/15 bg-black/45 text-sm text-white/65 md:h-[360px]">
                  Loading service area map...
                </div>
              }
            >
              <LazyServiceAreaMap token={MAPBOX_TOKEN} serviceArea={serviceArea} showOverlay={true} />
            </Suspense>
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-2xl border border-white/15 bg-black/45 text-sm text-white/65">
              Interactive map unavailable. Use Instant Quote for service-area confirmation.
            </div>
          )}
        </div>

        {loadingMapData ? <p className="text-sm text-white/65">Loading service coverage metadata...</p> : null}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">High-level regions served</p>
          <div className="flex flex-wrap gap-2">
            {servedRegions.map((region) => (
              <span
                key={region}
                className="rounded-full border border-white/25 bg-black/45 px-3 py-1 text-xs text-white/75"
              >
                {region}
              </span>
            ))}
          </div>
        </div>

        {serviceArea?.metadata.disclaimer ? <p className="text-xs text-white/55">{serviceArea.metadata.disclaimer}</p> : null}
      </Card>
    </section>
  );
};
