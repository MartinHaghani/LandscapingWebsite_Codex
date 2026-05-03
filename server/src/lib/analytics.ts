export const analyticsEventNames = [
  'page.viewed',
  'cta.clicked',
  'faq.opened',
  'contact.action_clicked',
  'contact.started',
  'contact.submitted',
  'quote.started',
  'quote.address_started',
  'quote.address_selected',
  'quote.service_area_checked',
  'quote.service_area_rejected',
  'quote.map_loaded',
  'quote.guide_opened',
  'quote.guide_completed',
  'quote.drawing_started',
  'quote.polygon_completed',
  'quote.obstacle_completed',
  'quote.validation_failed',
  'quote.summary_viewed',
  'quote.billing_mode_selected',
  'quote.submit_clicked',
  'quote.draft_created',
  'quote.auth_required',
  'quote.claimed',
  'quote.finalized',
  'quote.confirmation_viewed',
  'payment.link_viewed',
  'payment.checkout_started',
  'payment.completed',
  'quote.admin_approved',
  'quote.admin_rejected'
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsPropertyValue = string | number | boolean | null;

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

export interface AnalyticsAttributionInput {
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
}

export interface AnalyticsConsentInput {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface AnalyticsSessionInput {
  id: string;
  anonymousId: string;
  startedAt: string;
  lastSeenAt: string;
  attribution: AnalyticsAttributionInput;
  consent: AnalyticsConsentInput;
}

export interface AnalyticsEventInput {
  eventId: string;
  eventName: AnalyticsEventName;
  route: string;
  step?: string;
  leadId?: string;
  quoteId?: string;
  properties?: AnalyticsProperties;
  createdAt: string;
}

export interface AnalyticsEventBatchInput {
  session: AnalyticsSessionInput;
  events: AnalyticsEventInput[];
}

