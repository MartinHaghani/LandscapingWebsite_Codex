export type LngLat = [number, number];
export type ServiceFrequency = 'weekly';
export type BillingMode = 'seasonal' | 'per_session';

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
  ringPoints: LngLat[];
  rawStrokePoints: LngLat[] | null;
}

export interface QuotePolygonSource {
  schemaVersion: 2;
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
  billingMode?: BillingMode;
  baseTotal?: number;
  pricingVersion?: string;
  currency?: string;
  polygonSource?: QuotePolygonSource;
  attribution?: AttributionPayload;
  legalAcceptance: LegalAcceptancePayload;
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
  polygonSource?: QuotePolygonSource | null;
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
  fullSeasonTotal?: number;
  seasonalDiscountedTotal?: number;
  seasonalSavingsTotal?: number;
  seasonalDiscountRate?: number;
  globalDiscountRate?: number;
  priceOverrideEnabled?: boolean;
  overrideBasePerSessionTotal?: number | null;
  billingMode?: BillingMode;
  quoteTotal: number;
  status: string;
  customerStatus?: string;
  contactPending: boolean;
  submittedAt: string | null;
  verifiedAt?: string | null;
  paymentPageUrl?: string | null;
  approvedQuotePreviewImageUrl?: string | null;
  payment?: QuotePaymentSummary | null;
  billing?: AccountQuoteBillingSummary | null;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  addressText?: string;
  message: string;
  marketingConsent?: boolean;
  attribution?: AttributionPayload;
  legalAcceptance: LegalAcceptancePayload;
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

export interface LegalAcceptancePayload {
  accepted: true;
}

export interface QuoteClaimPayload {
  legalAcceptance: LegalAcceptancePayload;
}

export interface PaymentCheckoutPayload {
  legalAcceptance: LegalAcceptancePayload;
}

export interface AccountLegalAcceptancePayload {
  legalAcceptance: LegalAcceptancePayload;
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

export type QuotePaymentMode = 'seasonal_payment' | 'per_session_subscription';
export type QuotePaymentStatus =
  | 'awaiting_payment'
  | 'checkout_created'
  | 'paid'
  | 'subscription_scheduled'
  | 'subscription_active'
  | 'past_due'
  | 'failed'
  | 'canceled';

export interface QuotePaymentSummary {
  mode: QuotePaymentMode;
  status: QuotePaymentStatus;
  amountCents: number;
  currency: string;
  recurringInterval: string | null;
  maxBillableVisits: number | null;
  paidInvoiceCount: number;
  seasonStartAt: string | null;
  seasonEndAt: string | null;
  checkoutExpiresAt: string | null;
}

export interface CardOnFileSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface AccountQuoteBillingSummary {
  canManageCard: boolean;
  cardOnFile: CardOnFileSummary | null;
}

export interface PaymentLinkResponse {
  quote: {
    id: string;
    address: string;
    metrics: {
      areaM2: number;
      perimeterM: number;
    };
    serviceFrequency: ServiceFrequency;
    billingMode: BillingMode;
    sessionsMin: number;
    sessionsMax: number;
    perSessionTotal: number;
    seasonalTotalMin: number;
    seasonalTotalMax: number;
    fullSeasonTotal: number;
    seasonalDiscountedTotal: number;
    seasonalSavingsTotal: number;
    seasonalDiscountRate: number;
    verifiedAt: string | null;
    approvedQuotePreviewImageUrl: string | null;
  };
  payment: {
    mode: QuotePaymentMode;
    status: QuotePaymentStatus;
    amountCents: number;
    amount: number;
    currency: string;
    recurringInterval: string | null;
    maxBillableVisits: number | null;
    paidInvoiceCount: number;
    seasonStartAt: string | null;
    seasonEndAt: string | null;
    checkoutExpiresAt: string | null;
  };
}

export interface PaymentCheckoutResponse {
  checkoutUrl: string;
  checkoutSessionId: string;
  reused: boolean;
}

export interface AccountQuoteListItem {
  id: string;
  createdAt: string;
  address: string;
  status: string;
  customerStatus?: string;
  contactPending: boolean;
  serviceFrequency: ServiceFrequency;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  fullSeasonTotal?: number;
  seasonalDiscountedTotal?: number;
  seasonalSavingsTotal?: number;
  seasonalDiscountRate?: number;
  billingMode?: BillingMode;
  submittedAt: string | null;
  verifiedAt?: string | null;
  paymentPageUrl?: string | null;
  payment?: QuotePaymentSummary | null;
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
  utmId?: string;
  landingPath?: string;
  landingUrl?: string;
  referrer?: string;
  googleCampaignId?: string;
  googleAdGroupId?: string;
  googleAdId?: string;
  googleKeyword?: string;
  googleMatchType?: string;
  googleDevice?: string;
  googleNetwork?: string;
  deviceType?: string;
  browser?: string;
  userAgent?: string;
  geoCity?: string;
}

export type AnalyticsEventName =
  | 'page.viewed'
  | 'cta.clicked'
  | 'faq.opened'
  | 'contact.action_clicked'
  | 'contact.started'
  | 'contact.submitted'
  | 'quote.started'
  | 'quote.address_started'
  | 'quote.address_selected'
  | 'quote.service_area_checked'
  | 'quote.service_area_rejected'
  | 'quote.map_loaded'
  | 'quote.guide_opened'
  | 'quote.guide_completed'
  | 'quote.drawing_started'
  | 'quote.polygon_completed'
  | 'quote.obstacle_completed'
  | 'quote.validation_failed'
  | 'quote.summary_viewed'
  | 'quote.billing_mode_selected'
  | 'quote.submit_clicked'
  | 'quote.draft_created'
  | 'quote.auth_required'
  | 'quote.claimed'
  | 'quote.finalized'
  | 'quote.confirmation_viewed'
  | 'payment.link_viewed'
  | 'payment.checkout_started'
  | 'payment.completed'
  | 'quote.admin_approved'
  | 'quote.admin_rejected';

export type AnalyticsPropertyValue = string | number | boolean | null;

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | undefined>;

export interface AnalyticsConsentState {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}


export interface BillingPortalSessionResponse {
  portalUrl: string;
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
  distanceToNearestStationKm?: number;
  approximate: boolean;
  disclaimer: string;
  updatedAt: string;
}

export interface OutOfServiceAreaRouteState {
  address: string;
  location: LngLat;
}
