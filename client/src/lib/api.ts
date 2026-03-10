import type {
  AttributionPayload,
  ContactPayload,
  ContactResponse,
  QuoteContactPayload,
  QuoteContactResponse,
  QuoteLookupResponse,
  QuotePayload,
  QuoteResponse,
  ServiceAreaCheckResponse,
  ServiceAreaRequestPayload,
  ServiceAreaRequestResponse,
  ServiceAreaResponse
} from '../types';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:4000';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
}

export const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

const request = async <T>(path: string, init?: RequestOptions): Promise<T> => {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (init?.idempotencyKey) {
    headers.set('Idempotency-Key', init.idempotencyKey);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    ...init
  });

  const json = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new ApiError(json.error ?? 'Request failed.', response.status);
  }

  return json as T;
};

export const api = {
  submitQuoteDraft(payload: QuotePayload, idempotencyKey: string) {
    return request<QuoteResponse>('/api/quote/draft', {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(payload)
    });
  },
  submitQuote(payload: QuotePayload, idempotencyKey: string) {
    return request<QuoteResponse>('/api/quote', {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(payload)
    });
  },
  submitQuoteContact(quoteId: string, payload: QuoteContactPayload, idempotencyKey: string) {
    return request<QuoteContactResponse>(`/api/quote/${encodeURIComponent(quoteId)}/contact`, {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(payload)
    });
  },
  submitContact(payload: ContactPayload, idempotencyKey: string) {
    return request<ContactResponse>('/api/contact', {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(payload)
    });
  },
  getServiceArea() {
    return request<ServiceAreaResponse>('/api/service-area');
  },
  checkServiceArea(payload: { lat: number; lng: number }) {
    return request<ServiceAreaCheckResponse>('/api/service-area/check', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  requestServiceArea(payload: ServiceAreaRequestPayload, idempotencyKey: string) {
    return request<ServiceAreaRequestResponse>('/api/service-area/request', {
      method: 'POST',
      idempotencyKey,
      body: JSON.stringify(payload)
    });
  },
  getQuote(id: string) {
    return request<QuoteLookupResponse>(`/api/quote/${id}`);
  },
  getAttributionFromUrl(location: Pick<Window['location'], 'search' | 'pathname'>): AttributionPayload {
    const params = new URLSearchParams(location.search);

    const attribution: AttributionPayload = {
      gclid: params.get('gclid') ?? undefined,
      gbraid: params.get('gbraid') ?? undefined,
      wbraid: params.get('wbraid') ?? undefined,
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
      utmTerm: params.get('utm_term') ?? undefined,
      utmContent: params.get('utm_content') ?? undefined,
      landingPath: location.pathname,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      deviceType: typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : undefined
    };

    return attribution;
  }
};

export { ApiError };
