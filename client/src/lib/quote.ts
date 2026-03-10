import type { QuoteMetrics } from '../types';
import type { ServiceFrequency } from '../types';

const BASE_FEE = 49;
const AREA_RATE = 0.085;
const PERIMETER_RATE = 0.38;

export const getRecommendedPlan = (areaM2: number) => {
  if (areaM2 < 450) return 'Starter Autonomy Plan';
  if (areaM2 < 1200) return 'Precision Weekly Plan';
  return 'Estate Coverage Plan';
};

export const getQuoteTotal = (metrics: Pick<QuoteMetrics, 'areaM2' | 'perimeterM'>) => {
  const subtotal = BASE_FEE + metrics.areaM2 * AREA_RATE + metrics.perimeterM * PERIMETER_RATE;
  return Number(subtotal.toFixed(2));
};

const SESSION_WINDOWS: Record<ServiceFrequency, { min: number; max: number }> = {
  weekly: { min: 26, max: 30 },
  biweekly: { min: 13, max: 15 }
};

export const getSessionWindow = (serviceFrequency: ServiceFrequency) =>
  SESSION_WINDOWS[serviceFrequency] ?? SESSION_WINDOWS.weekly;

export const getSeasonalTotalRange = (perSessionTotal: number, serviceFrequency: ServiceFrequency) => {
  const sessions = getSessionWindow(serviceFrequency);

  return {
    sessionsMin: sessions.min,
    sessionsMax: sessions.max,
    seasonalTotalMin: Number((perSessionTotal * sessions.min).toFixed(2)),
    seasonalTotalMax: Number((perSessionTotal * sessions.max).toFixed(2))
  };
};

export const quotePricing = {
  baseFee: BASE_FEE,
  areaRate: AREA_RATE,
  perimeterRate: PERIMETER_RATE
};
