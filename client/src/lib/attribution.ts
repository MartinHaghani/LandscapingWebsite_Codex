import type { AttributionPayload } from '../types';
import { api } from './api';

const STORAGE_KEY = 'autoscape_attribution_v1';

const hasValue = (value: AttributionPayload) =>
  Object.values(value).some((entry) => typeof entry === 'string' && entry.trim().length > 0);

const readStoredAttribution = (): AttributionPayload => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as AttributionPayload;
  } catch {
    return {};
  }
};

const writeStoredAttribution = (payload: AttributionPayload) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore write failures in private browsing or quota-limited contexts.
  }
};

export const getAttributionSnapshot = (): AttributionPayload => {
  if (typeof window === 'undefined') {
    return {};
  }

  const fromUrl = api.getAttributionFromUrl(window.location);
  const stored = readStoredAttribution();

  const merged: AttributionPayload = {
    ...stored,
    ...Object.fromEntries(
      Object.entries(fromUrl).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    )
  };

  if (hasValue(merged)) {
    writeStoredAttribution(merged);
  }

  return merged;
};
