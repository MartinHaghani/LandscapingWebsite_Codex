export type LngLat = [number, number];

export interface MapboxSuggestion {
  id: string;
  place_name: string;
  center: LngLat;
}

export interface QuoteMetrics {
  areaM2: number;
  perimeterM: number;
  vertexCount: number;
  selfIntersecting: boolean;
}

export interface QuotePayload {
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  polygon: {
    type: 'Polygon';
    coordinates: LngLat[][];
  };
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  quoteTotal: number;
}

export interface QuoteResponse {
  quoteId: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

export interface ContactResponse {
  ok: boolean;
  id: string;
}
