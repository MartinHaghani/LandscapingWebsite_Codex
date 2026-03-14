import { describe, expect, it } from 'vitest';
import {
  clearQuoteDraftState,
  loadQuoteDraftState,
  quoteDraftStorageKey,
  saveQuoteDraftState
} from './quoteDraftPersistence';

interface StorageLike {
  length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const createStorageMock = (): StorageLike => {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      if (!map.has(key)) {
        return null;
      }

      const value = map.get(key);
      return value === undefined ? null : value;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    }
  };
};

describe('quoteDraftPersistence', () => {
  it('round-trips a valid draft snapshot', () => {
    const storage = createStorageMock();
    const state = {
      addressInput: '123 Greenway Blvd',
      selectedAddress: '123 Greenway Blvd, Vaughan, ON',
      selectedAddressKey: 'mapbox:place.123',
      center: [-79.52, 43.84] as [number, number],
      currentStep: 'map' as const,
      polygonHistory: {
        past: [],
        present: {
          polygons: [
            {
              id: 'polygon-1',
              kind: 'service' as const,
              points: [
                [-79.52, 43.84],
                [-79.521, 43.84],
                [-79.521, 43.841]
              ] as [number, number][]
            }
          ],
          activePolygonId: 'polygon-1'
        },
        future: []
      },
      serviceFrequency: 'weekly' as const,
      unitMode: 'metric' as const
    };

    saveQuoteDraftState(storage, state);
    expect(loadQuoteDraftState(storage)).toEqual(state);
  });

  it('returns null for invalid data shape', () => {
    const storage = createStorageMock();
    storage.setItem(
      quoteDraftStorageKey,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: {
          addressInput: 'x',
          selectedAddress: 'x',
          selectedAddressKey: null,
          center: [999, 1000],
          currentStep: 'map',
          polygonHistory: { past: [], present: {}, future: [] },
          serviceFrequency: 'weekly',
          unitMode: 'metric'
        }
      })
    );

    expect(loadQuoteDraftState(storage)).toBeNull();
  });

  it('returns null for unsupported version', () => {
    const storage = createStorageMock();
    storage.setItem(
      quoteDraftStorageKey,
      JSON.stringify({
        version: 2,
        state: {}
      })
    );

    expect(loadQuoteDraftState(storage)).toBeNull();
  });

  it('clears the stored snapshot', () => {
    const storage = createStorageMock();
    storage.setItem(quoteDraftStorageKey, '{}');

    clearQuoteDraftState(storage);

    expect(storage.getItem(quoteDraftStorageKey)).toBeNull();
  });
});
