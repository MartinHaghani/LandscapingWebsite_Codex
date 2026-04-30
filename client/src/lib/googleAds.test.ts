import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackSubmitLeadConversion } from './googleAds';

afterEach(() => {
  vi.useRealTimers();
});

describe('trackSubmitLeadConversion', () => {
  it('resolves without sending when the Google tag is unavailable', async () => {
    await expect(trackSubmitLeadConversion('quote-123', {})).resolves.toBeUndefined();
  });

  it('uses the page-level Submit lead form conversion reporter when available', async () => {
    const gtag_report_submit_lead_conversion = vi.fn(
      (_transactionId: string | undefined, callback: () => void) => {
        callback();
      }
    );

    await expect(
      trackSubmitLeadConversion(' quote-123 ', { gtag_report_submit_lead_conversion })
    ).resolves.toBeUndefined();

    expect(gtag_report_submit_lead_conversion).toHaveBeenCalledWith(
      'quote-123',
      expect.any(Function)
    );
  });

  it('fires the Submit lead form conversion with the quote id as the transaction id', async () => {
    const gtag = vi.fn();

    const conversionSent = trackSubmitLeadConversion(' quote-123 ', { gtag });

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'conversion',
      expect.objectContaining({
        send_to: 'AW-17991079326/FqIMCOHXqYIcEJ6r6IJD',
        value: 1.0,
        currency: 'CAD',
        transaction_id: 'quote-123'
      })
    );

    const params = gtag.mock.calls[0]?.[2];
    params.event_callback();

    await expect(conversionSent).resolves.toBeUndefined();
  });

  it('continues after a short timeout if Google does not call the event callback', async () => {
    vi.useFakeTimers();
    const conversionSent = trackSubmitLeadConversion('quote-123', { gtag: vi.fn() });

    await vi.advanceTimersByTimeAsync(1000);

    await expect(conversionSent).resolves.toBeUndefined();
  });
});
