export type ServiceFrequency = 'weekly' | 'biweekly';

interface SessionWindow {
  min: number;
  max: number;
}

export interface SessionRangePricing {
  serviceFrequency: ServiceFrequency;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
}

export const SESSION_WINDOWS: Record<ServiceFrequency, SessionWindow> = {
  weekly: { min: 26, max: 30 },
  biweekly: { min: 13, max: 15 }
};

const roundMoney = (value: number) => Number(value.toFixed(2));

export const normalizeServiceFrequency = (value?: string | null): ServiceFrequency =>
  value === 'biweekly' ? 'biweekly' : 'weekly';

export const computeSessionRangePricing = (
  perSessionTotal: number,
  serviceFrequency: ServiceFrequency
): SessionRangePricing => {
  const normalizedPerSession = roundMoney(perSessionTotal);
  const sessionWindow = SESSION_WINDOWS[serviceFrequency] ?? SESSION_WINDOWS.weekly;

  return {
    serviceFrequency,
    sessionsMin: sessionWindow.min,
    sessionsMax: sessionWindow.max,
    perSessionTotal: normalizedPerSession,
    seasonalTotalMin: roundMoney(normalizedPerSession * sessionWindow.min),
    seasonalTotalMax: roundMoney(normalizedPerSession * sessionWindow.max)
  };
};
