import type { ContactPayload, ContactResponse, QuotePayload, QuoteResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  const json = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new ApiError(json.error ?? 'Request failed.', response.status);
  }

  return json as T;
};

export const api = {
  submitQuote(payload: QuotePayload) {
    return request<QuoteResponse>('/api/quote', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  submitContact(payload: ContactPayload) {
    return request<ContactResponse>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getQuote(id: string) {
    return request<QuotePayload & { id: string; createdAt: string }>(`/api/quote/${id}`);
  }
};

export { ApiError };
