import type { QuoteMetrics } from '../types';

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

export const quotePricing = {
  baseFee: BASE_FEE,
  areaRate: AREA_RATE,
  perimeterRate: PERIMETER_RATE
};
