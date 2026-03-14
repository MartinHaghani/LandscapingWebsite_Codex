import type { PolygonHistoryState } from './polygonHistory';
import type { LngLat, PolygonEditorState, PolygonKind, ServiceFrequency } from '../types';

export type QuoteDraftUnitMode = 'metric' | 'imperial';
export type QuoteDraftStep = 'address' | 'map';

export interface QuoteDraftPersistedState {
  addressInput: string;
  selectedAddress: string;
  selectedAddressKey: string | null;
  center: LngLat;
  currentStep: QuoteDraftStep;
  polygonHistory: PolygonHistoryState;
  serviceFrequency: ServiceFrequency;
  unitMode: QuoteDraftUnitMode;
}

interface PersistedEnvelope {
  version: 1;
  savedAt: string;
  state: QuoteDraftPersistedState;
}

export const quoteDraftStorageKey = 'autoscape.quoteDraft.v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isLngLat = (value: unknown): value is LngLat =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]) &&
  value[0] >= -180 &&
  value[0] <= 180 &&
  value[1] >= -90 &&
  value[1] <= 90;

const isPolygonKind = (value: unknown): value is PolygonKind =>
  value === 'service' || value === 'obstacle';

const isPolygonEditorState = (value: unknown): value is PolygonEditorState => {
  if (!isRecord(value)) {
    return false;
  }

  if (!(value.activePolygonId === null || typeof value.activePolygonId === 'string')) {
    return false;
  }

  if (!Array.isArray(value.polygons)) {
    return false;
  }

  return value.polygons.every((polygon) => {
    if (!isRecord(polygon)) {
      return false;
    }

    if (
      typeof polygon.id !== 'string' ||
      !isPolygonKind(polygon.kind) ||
      !Array.isArray(polygon.points)
    ) {
      return false;
    }

    return polygon.points.every((point) => isLngLat(point));
  });
};

const isPolygonHistoryState = (value: unknown): value is PolygonHistoryState => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(value.past) ||
    !Array.isArray(value.future) ||
    !isPolygonEditorState(value.present)
  ) {
    return false;
  }

  return (
    value.past.every((entry) => isPolygonEditorState(entry)) &&
    value.future.every((entry) => isPolygonEditorState(entry))
  );
};

const isPersistedState = (value: unknown): value is QuoteDraftPersistedState => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.addressInput !== 'string') {
    return false;
  }

  if (typeof value.selectedAddress !== 'string') {
    return false;
  }

  if (!(value.selectedAddressKey === null || typeof value.selectedAddressKey === 'string')) {
    return false;
  }

  if (!isLngLat(value.center)) {
    return false;
  }

  if (!(value.currentStep === 'address' || value.currentStep === 'map')) {
    return false;
  }

  if (!isPolygonHistoryState(value.polygonHistory)) {
    return false;
  }

  if (!(value.serviceFrequency === 'weekly' || value.serviceFrequency === 'biweekly')) {
    return false;
  }

  if (!(value.unitMode === 'metric' || value.unitMode === 'imperial')) {
    return false;
  }

  return true;
};

export const saveQuoteDraftState = (storage: Storage, state: QuoteDraftPersistedState) => {
  const envelope: PersistedEnvelope = {
    version: 1,
    savedAt: new Date().toISOString(),
    state
  };

  storage.setItem(quoteDraftStorageKey, JSON.stringify(envelope));
};

export const loadQuoteDraftState = (storage: Storage): QuoteDraftPersistedState | null => {
  const raw = storage.getItem(quoteDraftStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    if (parsed.version !== 1) {
      return null;
    }

    if (!isPersistedState(parsed.state)) {
      return null;
    }

    return parsed.state;
  } catch {
    return null;
  }
};

export const clearQuoteDraftState = (storage: Storage) => {
  storage.removeItem(quoteDraftStorageKey);
};
