import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAttributionSnapshot } from './attribution';
import type {
  AnalyticsConsentState,
  AnalyticsEventName,
  AnalyticsProperties,
  AttributionPayload
} from '../types';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:4000';
const ANONYMOUS_ID_KEY = 'autoscape.analytics.anonymousId.v1';
const SESSION_KEY = 'autoscape.analytics.session.v1';
const CONSENT_KEY = 'autoscape.analyticsConsent.v1';
const FLUSH_DELAY_MS = 900;
const MAX_BATCH_SIZE = 20;

interface StoredSession {
  id: string;
  anonymousId: string;
  startedAt: string;
  attribution: AttributionPayload;
}

interface QueuedAnalyticsEvent {
  eventId: string;
  eventName: AnalyticsEventName;
  route: string;
  step?: string;
  leadId?: string;
  quoteId?: string;
  properties?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

let queue: QueuedAnalyticsEvent[] = [];
let flushTimer: number | null = null;

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const safeReadJson = <T>(storage: Storage, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const safeWriteJson = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore private browsing and quota failures.
  }
};

export const getAnalyticsConsentState = (): AnalyticsConsentState => {
  if (typeof window === 'undefined') {
    return {
      functional: true,
      analytics: true,
      marketing: false
    };
  }

  const stored = safeReadJson<Partial<AnalyticsConsentState>>(window.localStorage, CONSENT_KEY);
  return {
    functional: stored?.functional ?? true,
    analytics: stored?.analytics ?? true,
    marketing: stored?.marketing ?? false
  };
};

const getAnonymousId = () => {
  if (typeof window === 'undefined') {
    return 'server-render';
  }

  try {
    const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) {
      return existing;
    }

    const next = createId('anon');
    window.localStorage.setItem(ANONYMOUS_ID_KEY, next);
    return next;
  } catch {
    return createId('anon-memory');
  }
};

const mergeAttribution = (current: AttributionPayload, next: AttributionPayload): AttributionPayload => ({
  ...current,
  ...(Object.fromEntries(
    Object.entries(next).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
  ) as AttributionPayload),
  landingPath: current.landingPath ?? next.landingPath,
  landingUrl: current.landingUrl ?? next.landingUrl,
  referrer: current.referrer ?? next.referrer
});

export const getAnalyticsSession = (): StoredSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const attribution = getAttributionSnapshot();
  const existing = safeReadJson<StoredSession>(window.sessionStorage, SESSION_KEY);
  if (existing?.id && existing.anonymousId) {
    const updated = {
      ...existing,
      attribution: mergeAttribution(existing.attribution, attribution)
    };
    safeWriteJson(window.sessionStorage, SESSION_KEY, updated);
    return updated;
  }

  const now = new Date().toISOString();
  const created: StoredSession = {
    id: createId('session'),
    anonymousId: getAnonymousId(),
    startedAt: now,
    attribution
  };
  safeWriteJson(window.sessionStorage, SESSION_KEY, created);
  return created;
};

const cleanProperties = (properties?: AnalyticsProperties) => {
  const cleaned: Record<string, string | number | boolean | null> = {};
  Object.entries(properties ?? {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    cleaned[key] = value;
  });
  return cleaned;
};

const buildPayload = (events: QueuedAnalyticsEvent[]) => {
  const session = getAnalyticsSession();
  if (!session) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    session: {
      id: session.id,
      anonymousId: session.anonymousId,
      startedAt: session.startedAt,
      lastSeenAt: now,
      attribution: session.attribution,
      consent: getAnalyticsConsentState()
    },
    events
  };
};

const sendPayload = (events: QueuedAnalyticsEvent[], preferBeacon = false) => {
  const consent = getAnalyticsConsentState();
  if (!consent.analytics || events.length === 0) {
    return;
  }

  const payload = buildPayload(events);
  if (!payload) {
    return;
  }

  const body = JSON.stringify(payload);
  const url = `${API_BASE_URL}/api/analytics/events`;

  if (preferBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    if (sent) {
      return;
    }
  }

  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body,
    keepalive: preferBeacon
  }).catch(() => {
    // Analytics must never block the quote flow.
  });
};

export const flushAnalyticsEvents = (preferBeacon = false) => {
  if (flushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  const events = queue;
  queue = [];
  sendPayload(events, preferBeacon);
};

const scheduleFlush = () => {
  if (typeof window === 'undefined' || flushTimer !== null) {
    return;
  }

  flushTimer = window.setTimeout(() => flushAnalyticsEvents(false), FLUSH_DELAY_MS);
};

export const trackAnalyticsEvent = (
  eventName: AnalyticsEventName,
  options: {
    route?: string;
    step?: string;
    leadId?: string;
    quoteId?: string;
    properties?: AnalyticsProperties;
  } = {}
) => {
  if (typeof window === 'undefined' || !getAnalyticsConsentState().analytics) {
    return;
  }

  queue.push({
    eventId: createId('event'),
    eventName,
    route: options.route ?? window.location.pathname,
    step: options.step,
    leadId: options.leadId,
    quoteId: options.quoteId,
    properties: cleanProperties(options.properties),
    createdAt: new Date().toISOString()
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    flushAnalyticsEvents(false);
    return;
  }

  scheduleFlush();
};

export const useAnalyticsPageView = () => {
  const location = useLocation();

  useEffect(() => {
    trackAnalyticsEvent('page.viewed', {
      route: location.pathname,
      properties: {
        path: location.pathname,
        searchPresent: location.search.length > 0
      }
    });
  }, [location.pathname, location.search]);
};

export const installAnalyticsUnloadFlush = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const flushOnPageHide = () => flushAnalyticsEvents(true);
  window.addEventListener('pagehide', flushOnPageHide);
  return () => window.removeEventListener('pagehide', flushOnPageHide);
};

export const resetAnalyticsForTests = () => {
  queue = [];
  flushTimer = null;
};
