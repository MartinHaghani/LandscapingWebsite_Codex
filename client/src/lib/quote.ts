import type { BillingMode, QuoteMetrics, ServiceFrequency } from '../types';

const toFiniteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const roundMoney = (value: number) => Number(toFiniteNumber(value).toFixed(2));
const clampRate = (value: number) =>
  Number(Math.min(1, Math.max(0, toFiniteNumber(value))).toFixed(4));

export const quotePricing = {
  baseFee: 20,
  areaRate: 0.05,
  perimeterRate: 0.1,
  distanceRate: 1,
  minimumPerSessionPrice: 45,
  defaultSeasonalDiscountRate: 0.2
} as const;

const WEEKLY_SESSION_WINDOW = { min: 20, max: 20 } as const;

export const getRecommendedPlan = (areaM2: number) => {
  if (areaM2 < 450) return 'Starter Autonomy Plan';
  if (areaM2 < 1200) return 'Precision Weekly Plan';
  return 'Estate Coverage Plan';
};

export const getSessionWindow = (_serviceFrequency: ServiceFrequency = 'weekly') =>
  WEEKLY_SESSION_WINDOW;

export const getQuoteTotal = (
  metrics: Pick<QuoteMetrics, 'areaM2' | 'perimeterM'>,
  distanceToNearestStationKm: number
) => {
  const areaM2 = toFiniteNumber(metrics.areaM2);
  const perimeterM = toFiniteNumber(metrics.perimeterM);
  const distanceKm = toFiniteNumber(distanceToNearestStationKm);
  const subtotal =
    quotePricing.baseFee +
    areaM2 * quotePricing.areaRate +
    perimeterM * quotePricing.perimeterRate +
    distanceKm * quotePricing.distanceRate;

  return roundMoney(Math.max(subtotal, quotePricing.minimumPerSessionPrice));
};

export const getSeasonalTotalRange = (
  perSessionTotal: number,
  serviceFrequency: ServiceFrequency = 'weekly'
) => {
  const sessions = getSessionWindow(serviceFrequency);
  const normalizedPerSessionTotal = Math.max(0, roundMoney(perSessionTotal));
  const fullSeasonTotal = roundMoney(normalizedPerSessionTotal * sessions.max);

  return {
    sessionsMin: sessions.min,
    sessionsMax: sessions.max,
    seasonalTotalMin: fullSeasonTotal,
    seasonalTotalMax: fullSeasonTotal
  };
};

export const getSeasonalPricing = (
  perSessionTotal: number,
  serviceFrequency: ServiceFrequency = 'weekly',
  seasonalDiscountRate = quotePricing.defaultSeasonalDiscountRate
) => {
  const sessionWindow = getSessionWindow(serviceFrequency);
  const normalizedPerSessionTotal = Math.max(0, roundMoney(perSessionTotal));
  const fullSeasonTotal = roundMoney(normalizedPerSessionTotal * sessionWindow.max);
  const normalizedDiscountRate = clampRate(seasonalDiscountRate);
  const seasonalDiscountedTotal = roundMoney(fullSeasonTotal * (1 - normalizedDiscountRate));
  const seasonalSavingsTotal = roundMoney(fullSeasonTotal - seasonalDiscountedTotal);

  return {
    sessionsMin: sessionWindow.min,
    sessionsMax: sessionWindow.max,
    fullSeasonTotal,
    seasonalDiscountRate: normalizedDiscountRate,
    seasonalDiscountedTotal,
    seasonalSavingsTotal,
    seasonalTotalMin: fullSeasonTotal,
    seasonalTotalMax: fullSeasonTotal
  };
};

export const normalizeBillingMode = (value?: string | null): BillingMode =>
  value === 'per_session' ? 'per_session' : 'seasonal';
