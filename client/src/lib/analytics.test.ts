import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushAnalyticsEvents, getAnalyticsSession, resetAnalyticsForTests, trackAnalyticsEvent } from './analytics';

class FakeStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const installBrowserGlobals = () => {
  const localStorage = new FakeStorage();
  const sessionStorage = new FakeStorage();
  vi.stubGlobal('window', {
    location: {
      pathname: '/instant-quote',
      search:
        '?gclid=gclid-123&utm_source=google&utm_campaign=campaign-name&utm_id=123&google_campaign_id=123&google_ad_id=789',
      href:
        'https://autoscape.ca/instant-quote?gclid=gclid-123&utm_source=google&utm_campaign=campaign-name&utm_id=123&google_campaign_id=123&google_ad_id=789'
    },
    localStorage,
    sessionStorage,
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
  vi.stubGlobal('document', {
    referrer: 'https://google.com/search'
  });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 TestBrowser',
    sendBeacon: undefined
  });
  vi.stubGlobal('crypto', {
    randomUUID: () => '00000000-0000-4000-8000-000000000001'
  });

  return { localStorage, sessionStorage };
};

afterEach(() => {
  resetAnalyticsForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('analytics client', () => {
  it('creates a session with Google Ads and UTM attribution', () => {
    installBrowserGlobals();

    const session = getAnalyticsSession();

    expect(session?.anonymousId).toContain('anon-');
    expect(session?.attribution).toMatchObject({
      gclid: 'gclid-123',
      utmSource: 'google',
      utmCampaign: 'campaign-name',
      utmId: '123',
      googleCampaignId: '123',
      googleAdId: '789',
      landingPath: '/instant-quote'
    });

    window.location.pathname = '/contact';
    window.location.search = '';
    window.location.href = 'https://autoscape.ca/contact';

    expect(getAnalyticsSession()?.attribution.landingPath).toBe('/instant-quote');
  });

  it('flushes queued events to the first-party analytics endpoint', () => {
    installBrowserGlobals();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    trackAnalyticsEvent('quote.started', {
      step: 'address',
      properties: {
        component: 'test'
      }
    });
    flushAnalyticsEvents(false);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/analytics/events',
      expect.objectContaining({
        method: 'POST'
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      session: { attribution: { googleCampaignId?: string } };
      events: Array<{ eventName: string; properties: { component: string } }>;
    };
    expect(body.session.attribution.googleCampaignId).toBe('123');
    expect(body.events[0]).toMatchObject({
      eventName: 'quote.started',
      properties: {
        component: 'test'
      }
    });
  });

  it('uses sendBeacon for unload-friendly flushing when available', () => {
    installBrowserGlobals();
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 TestBrowser',
      sendBeacon
    });
    vi.stubGlobal('fetch', fetchMock);

    trackAnalyticsEvent('page.viewed');
    flushAnalyticsEvents(true);

    expect(sendBeacon).toHaveBeenCalledWith(
      'http://localhost:4000/api/analytics/events',
      expect.any(Blob)
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
