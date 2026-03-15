export type LngLat = [number, number];
export type ServiceFrequency = 'weekly' | 'biweekly';

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

export type SelectionTarget =
  | { kind: 'none' }
  | { kind: 'polygon'; polygonId: string }
  | { kind: 'vertex'; polygonId: string; index: number };

export type PolygonKind = 'service' | 'obstacle';

export interface EditablePolygon {
  id: string;
  kind: PolygonKind;
  points: LngLat[];
}

export interface QuotePolygonSource {
  schemaVersion: 1;
  polygons: EditablePolygon[];
  activePolygonId: string | null;
}

export interface PolygonEditorState {
  polygons: EditablePolygon[];
  activePolygonId: string | null;
}

export type QuoteGeometry =
  | {
      type: 'Polygon';
      coordinates: LngLat[][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: LngLat[][][];
    };

export interface QuotePayload {
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  polygon: QuoteGeometry;
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  quoteTotal: number;
  serviceFrequency?: ServiceFrequency;
  baseTotal?: number;
  pricingVersion?: string;
  currency?: string;
  polygonSource?: QuotePolygonSource;
  attribution?: AttributionPayload;
}

export interface QuoteResponse {
  quoteId: string;
  status?: 'draft';
  contactPending?: boolean;
  nextStepUrl?: string;
  replayed?: boolean;
}

export interface QuoteLookupResponse {
  id: string;
  createdAt: string;
  address: string;
  metrics: {
    areaM2: number;
    perimeterM: number;
  };
  plan: string;
  serviceFrequency: ServiceFrequency;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  quoteTotal: number;
  status: string;
  contactPending: boolean;
  submittedAt: string | null;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  addressText?: string;
  message: string;
  attribution?: AttributionPayload;
}

export interface ContactResponse {
  ok: boolean;
  id: string;
  replayed?: boolean;
}

export interface QuoteContactPayload {
  message?: string;
  attribution?: AttributionPayload;
}

export interface QuoteContactResponse {
  ok: boolean;
  quoteId: string;
  status: string;
  submittedAt: string | null;
  replayed?: boolean;
}

export interface QuoteClaimResponse {
  ok: boolean;
  quoteId: string;
  claimed: boolean;
}

export interface AccountQuoteListItem {
  id: string;
  createdAt: string;
  address: string;
  status: string;
  contactPending: boolean;
  serviceFrequency: ServiceFrequency;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  submittedAt: string | null;
}

export interface AccountQuoteListResponse {
  items: AccountQuoteListItem[];
  nextCursor: string | null;
  meta: {
    generatedAt: string;
    rowCount: number;
    filters: Record<string, string | number | null | undefined>;
  };
}

export interface AttributionPayload {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPath?: string;
  referrer?: string;
  deviceType?: string;
  browser?: string;
  geoCity?: string;
}

export interface ServiceAreaRequestPayload {
  addressText: string;
  lat: number;
  lng: number;
  source: 'out_of_area_page' | 'coverage_checker' | 'instant_quote' | 'contact_form';
  isInServiceAreaAtCapture: boolean;
}

export interface ServiceAreaRequestResponse {
  ok: boolean;
  id: string;
  distanceToNearestStationM: number;
  replayed?: boolean;
}

export type ServiceAreaGeometry =
  | {
      type: 'Polygon';
      coordinates: LngLat[][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: LngLat[][][];
    };

export interface ServiceAreaResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, never>;
    geometry: ServiceAreaGeometry;
  }>;
  metadata: {
    updatedAt: string;
    approximate: boolean;
    coverageRadiusKm: number;
    disclaimer: string;
    servedRegions: string[];
  };
}

export interface ServiceAreaCheckResponse {
  inServiceArea: boolean;
  approximate: boolean;
  disclaimer: string;
  updatedAt: string;
}

export interface OutOfServiceAreaRouteState {
  address: string;
  location: LngLat;
}
