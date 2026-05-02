const SUBMIT_LEAD_CONVERSION_SEND_TO = 'AW-17991079326/FqIMCOHXqYIcEJ6r6IJD';
const TRACKED_SUBMIT_LEAD_CONVERSIONS_KEY = 'autoscape.googleAds.submitLeadConversions.v1';
const MAX_TRACKED_CONVERSION_IDS = 100;

interface GoogleAdsConversionParams {
  send_to: string;
  value: number;
  currency: 'CAD';
}

type GoogleAdsGtag = (
  command: 'event',
  eventName: 'conversion',
  params: GoogleAdsConversionParams
) => void;

type ConversionStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface GoogleAdsTarget {
  gtag?: GoogleAdsGtag;
  localStorage?: ConversionStorage;
}

const getGoogleAdsTarget = (): GoogleAdsTarget | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as GoogleAdsTarget;
};

const getConversionQuoteId = (quoteId?: string) => {
  const trimmedQuoteId = quoteId?.trim();
  return trimmedQuoteId ? trimmedQuoteId.slice(0, 64) : undefined;
};

const readTrackedQuoteIds = (storage?: ConversionStorage) => {
  if (!storage) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(storage.getItem(TRACKED_SUBMIT_LEAD_CONVERSIONS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
};

const writeTrackedQuoteIds = (storage: ConversionStorage | undefined, quoteIds: Set<string>) => {
  if (!storage) {
    return;
  }

  try {
    const cappedIds = [...quoteIds].slice(-MAX_TRACKED_CONVERSION_IDS);
    storage.setItem(TRACKED_SUBMIT_LEAD_CONVERSIONS_KEY, JSON.stringify(cappedIds));
  } catch {
    // Storage may be unavailable in private browsing modes; conversion tracking should still proceed.
  }
};

export const trackSubmitLeadConversion = (
  quoteId?: string,
  target: GoogleAdsTarget | undefined = getGoogleAdsTarget()
) =>
  new Promise<void>((resolve) => {
    const hasGoogleTag = typeof target?.gtag === 'function';

    if (!hasGoogleTag) {
      resolve();
      return;
    }

    try {
      const conversionQuoteId = getConversionQuoteId(quoteId);
      const trackedQuoteIds = readTrackedQuoteIds(target?.localStorage);
      if (conversionQuoteId && trackedQuoteIds.has(conversionQuoteId)) {
        resolve();
        return;
      }

      const conversionParams: GoogleAdsConversionParams = {
        send_to: SUBMIT_LEAD_CONVERSION_SEND_TO,
        value: 1.0,
        currency: 'CAD'
      };

      target.gtag?.('event', 'conversion', conversionParams);
      if (conversionQuoteId) {
        trackedQuoteIds.add(conversionQuoteId);
        writeTrackedQuoteIds(target?.localStorage, trackedQuoteIds);
      }
    } catch {
      // Google Ads failures must never block the quote confirmation experience.
    }

    resolve();
  });
