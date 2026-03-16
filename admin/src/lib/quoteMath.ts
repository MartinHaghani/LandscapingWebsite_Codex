export type ServiceFrequency = 'weekly' | 'biweekly';

const toFiniteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const BASE_FEE = 20;
const AREA_RATE = 0.05;
const PERIMETER_RATE = 0.1;
const DISTANCE_RATE = 1;
const MINIMUM_PER_SESSION = 50;

const SESSION_WINDOWS: Record<ServiceFrequency, { min: number; max: number }> = {
  weekly: { min: 26, max: 26 },
  biweekly: { min: 14, max: 14 }
};

export const getRecommendedPlan = (areaM2: number) => {
  if (areaM2 < 450) return 'Starter Autonomy Plan';
  if (areaM2 < 1200) return 'Precision Weekly Plan';
  return 'Estate Coverage Plan';
};

export const getCalculatedPerSession = (
  areaM2: number,
  perimeterM: number,
  distanceToNearestStationKm = 0
) => {
  const safeAreaM2 = toFiniteNumber(areaM2);
  const safePerimeterM = toFiniteNumber(perimeterM);
  const safeDistanceKm = toFiniteNumber(distanceToNearestStationKm);
  const subtotal =
    BASE_FEE +
    safeAreaM2 * AREA_RATE +
    safePerimeterM * PERIMETER_RATE +
    safeDistanceKm * DISTANCE_RATE;
  return Number(Math.max(subtotal, MINIMUM_PER_SESSION).toFixed(2));
};

export const getSessionWindow = (serviceFrequency: ServiceFrequency) =>
  SESSION_WINDOWS[serviceFrequency] ?? SESSION_WINDOWS.weekly;

export const getSeasonalTotalRange = (perSessionTotal: number, serviceFrequency: ServiceFrequency) => {
  const sessions = getSessionWindow(serviceFrequency);
  const normalizedPerSession = Math.max(0, toFiniteNumber(perSessionTotal));

  return {
    sessionsMin: sessions.min,
    sessionsMax: sessions.max,
    seasonalTotalMin: Number((normalizedPerSession * sessions.min).toFixed(2)),
    seasonalTotalMax: Number((normalizedPerSession * sessions.max).toFixed(2))
  };
};
