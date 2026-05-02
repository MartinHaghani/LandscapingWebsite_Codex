export type ServiceFrequency = 'weekly';
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
  minimumPerSessionPrice: 45,
  defaultSeasonalDiscountRate: 0.2,
  defaultGlobalDiscountRate: 0,
  maxAdminDiscountRate: 0.5
} as const;

export const SESSION_WINDOWS: Record<ServiceFrequency, SessionWindow> = {
  weekly: { min: 20, max: 20 }
};

const toFiniteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;
const roundMoney = (value: number) => Number(toFiniteNumber(value).toFixed(2));
const roundRate = (value: number) => Number(toFiniteNumber(value).toFixed(4));
const clampRate = (value: number, max = 1) => roundRate(Math.min(max, Math.max(0, value)));

export const normalizeServiceFrequency = (_value?: string | null): ServiceFrequency => 'weekly';

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
  serviceFrequency: ServiceFrequency = 'weekly',
  seasonalDiscountRate: number = PRICING_CONSTANTS.defaultSeasonalDiscountRate
): SessionRangePricing => {
  const normalizedPerSession = Math.max(0, roundMoney(perSessionTotal));
  const sessionWindow = SESSION_WINDOWS[serviceFrequency] ?? SESSION_WINDOWS.weekly;
  const normalizedDiscountRate = clampRate(seasonalDiscountRate);
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

export const normalizeAdminDiscountRate = (value: number | undefined | null, fallback: number = 0) =>
  clampRate(toFiniteNumber(value ?? fallback, fallback), PRICING_CONSTANTS.maxAdminDiscountRate);

export const computeDiscountedQuotePricing = ({
  calculatedPerSessionTotal,
  serviceFrequency = 'weekly',
  globalDiscountRate = PRICING_CONSTANTS.defaultGlobalDiscountRate,
  seasonalDiscountRate = PRICING_CONSTANTS.defaultSeasonalDiscountRate,
  priceOverrideEnabled = false,
  overrideBasePerSessionTotal
}: {
  calculatedPerSessionTotal: number;
  serviceFrequency?: ServiceFrequency;
  globalDiscountRate?: number | null;
  seasonalDiscountRate?: number | null;
  priceOverrideEnabled?: boolean;
  overrideBasePerSessionTotal?: number | null;
}) => {
  const normalizedGlobalDiscountRate = normalizeAdminDiscountRate(
    globalDiscountRate,
    PRICING_CONSTANTS.defaultGlobalDiscountRate
  );
  const normalizedSeasonalDiscountRate = normalizeAdminDiscountRate(
    seasonalDiscountRate,
    PRICING_CONSTANTS.defaultSeasonalDiscountRate
  );
  const basePerSessionTotal =
    priceOverrideEnabled && typeof overrideBasePerSessionTotal === 'number'
      ? Math.max(0, roundMoney(overrideBasePerSessionTotal))
      : Math.max(0, roundMoney(calculatedPerSessionTotal));
  const discountedPerSessionTotal = roundMoney(basePerSessionTotal * (1 - normalizedGlobalDiscountRate));
  const sessionPricing = computeSessionRangePricing(
    discountedPerSessionTotal,
    serviceFrequency,
    normalizedSeasonalDiscountRate
  );

  return {
    ...sessionPricing,
    basePerSessionTotal,
    globalDiscountRate: normalizedGlobalDiscountRate,
    seasonalDiscountRate: normalizedSeasonalDiscountRate,
    priceOverrideEnabled,
    overrideBasePerSessionTotal: priceOverrideEnabled ? basePerSessionTotal : null
  };
};
