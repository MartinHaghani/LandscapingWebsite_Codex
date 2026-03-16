export type ServiceFrequency = 'weekly' | 'biweekly';
export type BillingMode = 'seasonal' | 'per_session';

interface SessionWindow {
  min: number;
  max: number;
}

export interface SessionRangePricing {
  serviceFrequency: ServiceFrequency;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  fullSeasonTotal: number;
  seasonalDiscountRate: number;
  seasonalDiscountedTotal: number;
  seasonalSavingsTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
}

export const PRICING_CONSTANTS = {
  baseFee: 20,
  areaRate: 0.05,
  perimeterRate: 0.1,
  distanceRate: 1,
  minimumPerSessionPrice: 50,
  defaultSeasonalDiscountRate: 0.2
} as const;

export const SESSION_WINDOWS: Record<ServiceFrequency, SessionWindow> = {
  weekly: { min: 26, max: 26 },
  biweekly: { min: 14, max: 14 }
};

const toFiniteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const roundMoney = (value: number) => Number(toFiniteNumber(value).toFixed(2));
const roundRate = (value: number) => Number(toFiniteNumber(value).toFixed(4));

export const normalizeServiceFrequency = (value?: string | null): ServiceFrequency =>
  value === 'biweekly' ? 'biweekly' : 'weekly';

export const normalizeBillingMode = (value?: string | null): BillingMode =>
  value === 'per_session' ? 'per_session' : 'seasonal';

export const computePerSessionTotal = (
  areaM2: number,
  perimeterM: number,
  distanceToNearestStationKm: number
) => {
  const safeAreaM2 = toFiniteNumber(areaM2);
  const safePerimeterM = toFiniteNumber(perimeterM);
  const safeDistanceKm = toFiniteNumber(distanceToNearestStationKm);
  const subtotal =
    PRICING_CONSTANTS.baseFee +
    safeAreaM2 * PRICING_CONSTANTS.areaRate +
    safePerimeterM * PRICING_CONSTANTS.perimeterRate +
    safeDistanceKm * PRICING_CONSTANTS.distanceRate;
  return roundMoney(Math.max(subtotal, PRICING_CONSTANTS.minimumPerSessionPrice));
};

export const computeSessionRangePricing = (
  perSessionTotal: number,
  serviceFrequency: ServiceFrequency,
  seasonalDiscountRate = PRICING_CONSTANTS.defaultSeasonalDiscountRate
): SessionRangePricing => {
  const normalizedPerSession = Math.max(0, roundMoney(perSessionTotal));
  const sessionWindow = SESSION_WINDOWS[serviceFrequency] ?? SESSION_WINDOWS.weekly;
  const normalizedDiscountRate = roundRate(Math.min(1, Math.max(0, seasonalDiscountRate)));
  const fullSeasonTotal = roundMoney(normalizedPerSession * sessionWindow.max);
  const seasonalDiscountedTotal = roundMoney(fullSeasonTotal * (1 - normalizedDiscountRate));
  const seasonalSavingsTotal = roundMoney(fullSeasonTotal - seasonalDiscountedTotal);

  return {
    serviceFrequency,
    sessionsMin: sessionWindow.min,
    sessionsMax: sessionWindow.max,
    perSessionTotal: normalizedPerSession,
    fullSeasonTotal,
    seasonalDiscountRate: normalizedDiscountRate,
    seasonalDiscountedTotal,
    seasonalSavingsTotal,
    seasonalTotalMin: fullSeasonTotal,
    seasonalTotalMax: fullSeasonTotal
  };
};
