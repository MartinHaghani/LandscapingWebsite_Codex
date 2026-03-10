import type { LngLat, MapboxSuggestion } from '../types';

interface FetchAddressSuggestionsOptions {
  query: string;
  token?: string;
  limit?: number;
  types?: string;
  country?: string;
  proximity?: LngLat;
}

export const fetchAddressSuggestions = async ({
  query,
  token,
  limit = 5,
  types = 'address,place,postcode',
  country = 'us,ca',
  proximity
}: FetchAddressSuggestionsOptions): Promise<MapboxSuggestion[]> => {
  const trimmed = query.trim();
  if (!token || trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    autocomplete: 'true',
    types,
    country,
    limit: String(limit),
    access_token: token
  });

  if (proximity) {
    params.set('proximity', `${proximity[0]},${proximity[1]}`);
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${params.toString()}`
  );

  const data = (await response.json()) as {
    features?: Array<{ id: string; place_name: string; center: [number, number] }>;
  };

  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    place_name: feature.place_name,
    center: feature.center
  }));
};
