import type { BillingMode, QuoteLookupResponse } from '../types';

const toMoney = (value: number | undefined, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const toRate = (value: number | undefined, fallback = 0.2) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

export interface NormalizedAccountQuote extends QuoteLookupResponse {
  billingMode: BillingMode;
  fullSeasonTotal: number;
  seasonalDiscountedTotal: number;
  seasonalSavingsTotal: number;
  seasonalDiscountRate: number;
  customerStatus: string;
  verifiedAt: string | null;
  paymentPageUrl: string | null;
  approvedQuotePreviewImageUrl: string | null;
}

export const normalizeAccountQuote = (result: QuoteLookupResponse): NormalizedAccountQuote => {
  const perSessionTotal = toMoney(result.perSessionTotal);
  const fullSeasonTotal = toMoney(result.fullSeasonTotal, toMoney(result.seasonalTotalMax));
  const seasonalDiscountRate = toRate(result.seasonalDiscountRate);
  const seasonalDiscountedTotal = toMoney(
    result.seasonalDiscountedTotal,
    Number((fullSeasonTotal * (1 - seasonalDiscountRate)).toFixed(2))
  );
  const seasonalSavingsTotal = toMoney(
    result.seasonalSavingsTotal,
    Number((fullSeasonTotal - seasonalDiscountedTotal).toFixed(2))
  );

  return {
    ...result,
    billingMode: result.billingMode === 'per_session' ? 'per_session' : 'seasonal',
    perSessionTotal,
    seasonalTotalMin: toMoney(result.seasonalTotalMin, fullSeasonTotal),
    seasonalTotalMax: toMoney(result.seasonalTotalMax, fullSeasonTotal),
    fullSeasonTotal,
    seasonalDiscountRate,
    seasonalDiscountedTotal,
    seasonalSavingsTotal,
    customerStatus: result.customerStatus ?? 'pending',
    verifiedAt: result.verifiedAt ?? null,
    paymentPageUrl: result.paymentPageUrl ?? null,
    approvedQuotePreviewImageUrl: result.approvedQuotePreviewImageUrl ?? null
  };
};
