const SUBMIT_LEAD_CONVERSION_SEND_TO = 'AW-17991079326/FqIMCOHXqYIcEJ6r6IJD';
const CONVERSION_CALLBACK_TIMEOUT_MS = 1000;

interface GoogleAdsConversionParams {
  send_to: string;
  value: number;
  currency: 'CAD';
  transaction_id?: string;
  event_callback: () => void;
}

type GoogleAdsGtag = (
  command: 'event',
  eventName: 'conversion',
  params: GoogleAdsConversionParams
) => void;

type SubmitLeadConversionReporter = (
  transactionId: string | undefined,
  callback: () => void
) => void;

interface GoogleAdsTarget {
  gtag?: GoogleAdsGtag;
  gtag_report_submit_lead_conversion?: SubmitLeadConversionReporter;
}

const getGoogleAdsTarget = (): GoogleAdsTarget | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as GoogleAdsTarget;
};

const getTransactionId = (quoteId?: string) => {
  const trimmedQuoteId = quoteId?.trim();
  return trimmedQuoteId ? trimmedQuoteId.slice(0, 64) : undefined;
};

export const trackSubmitLeadConversion = (
  quoteId?: string,
  target: GoogleAdsTarget | undefined = getGoogleAdsTarget()
) =>
  new Promise<void>((resolve) => {
    const hasSubmitLeadReporter =
      typeof target?.gtag_report_submit_lead_conversion === 'function';
    const hasGoogleTag = typeof target?.gtag === 'function';

    if (!hasSubmitLeadReporter && !hasGoogleTag) {
      resolve();
      return;
    }

    let settled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
      resolve();
    };

    timeoutId = globalThis.setTimeout(finish, CONVERSION_CALLBACK_TIMEOUT_MS);

    try {
      const transactionId = getTransactionId(quoteId);

      if (hasSubmitLeadReporter) {
        target.gtag_report_submit_lead_conversion?.(transactionId, finish);
        return;
      }

      const conversionParams: GoogleAdsConversionParams = {
        send_to: SUBMIT_LEAD_CONVERSION_SEND_TO,
        value: 1.0,
        currency: 'CAD',
        event_callback: finish
      };

      if (transactionId) {
        conversionParams.transaction_id = transactionId;
      }

      target.gtag?.('event', 'conversion', conversionParams);
    } catch {
      finish();
    }
  });
