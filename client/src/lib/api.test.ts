import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('api request errors', () => {
  it('surfaces a clear API reachability error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;

    try {
      await api.getServiceArea();
      throw new Error('Expected api.getServiceArea() to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        message:
          'Unable to reach the API at http://localhost:4000. Check that the backend is running and this frontend origin is allowed.',
        status: 0
      });
    }
  });
});
