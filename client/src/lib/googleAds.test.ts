import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackSubmitLeadConversion } from './googleAds';

afterEach(() => {
  vi.useRealTimers();
});

describe('trackSubmitLeadConversion', () => {
  it('resolves without sending when the Google tag is unavailable', async () => {
    await expect(trackSubmitLeadConversion('quote-123', {})).resolves.toBeUndefined();
  });

  it('fires the Google Ads Submit lead form conversion snippet', async () => {
    const gtag = vi.fn();

    await expect(trackSubmitLeadConversion(' quote-123 ', { gtag })).resolves.toBeUndefined();

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'conversion',
      {
        send_to: 'AW-17991079326/FqIMCOHXqYIcEJ6r6IJD',
        value: 1.0,
        currency: 'CAD'
      }
    );
  });

  it('does not fire twice for the same quote in the same browser storage', async () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      })
    };
    const gtag = vi.fn();

    await trackSubmitLeadConversion('quote-123', { gtag, localStorage });
    await trackSubmitLeadConversion('quote-123', { gtag, localStorage });

    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
