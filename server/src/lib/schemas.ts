import { z } from 'zod';
import { analyticsEventNames } from './analytics.js';

const easyQuoteIdPattern = /^[23456789ABCDEFGHJKMNPRSTUVWXYZ]{6}$/;
const legacyQuoteIdPattern = /^Q-[A-Z0-9_-]{4,30}$/;

const publicQuoteIdSchema = z
  .string()
  .trim()
  .refine((value) => easyQuoteIdPattern.test(value) || legacyQuoteIdPattern.test(value), {
    message: 'Quote ID must be a six-character code or legacy Q-prefixed ID'
  });

const coordinateSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
  ]);

const polygonSourcePolygonSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(['service', 'obstacle']),
  ringPoints: z.array(coordinateSchema).min(3),
  rawStrokePoints: z.array(coordinateSchema).min(2).nullable().optional()
});

export const polygonSourceSchema = z.object({
  schemaVersion: z.literal(2),
  polygons: z.array(polygonSourcePolygonSchema).min(1),
  activePolygonId: z.string().trim().max(120).nullable().optional()
});

export const quotePayloadSchema = z.object({
  address: z.string().trim().min(3).max(300),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  polygon: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(coordinateSchema).min(1)).min(1)
    }),
    z.object({
      type: z.literal('MultiPolygon'),
      coordinates: z.array(z.array(z.array(coordinateSchema).min(1)).min(1)).min(1)
    })
  ]),
  metrics: z.object({
    areaM2: z.number().positive(),
    perimeterM: z.number().positive()
  }),
  plan: z.string().trim().min(3).max(120),
  quoteTotal: z.number().nonnegative(),
  serviceFrequency: z.enum(['weekly']).optional(),
  billingMode: z.enum(['seasonal', 'per_session']).optional()
});

export const attributionSchema = z
  .object({
    gclid: z.string().trim().max(120).optional(),
    gbraid: z.string().trim().max(120).optional(),
    wbraid: z.string().trim().max(120).optional(),
    utmSource: z.string().trim().max(160).optional(),
    utmMedium: z.string().trim().max(160).optional(),
    utmCampaign: z.string().trim().max(200).optional(),
    utmTerm: z.string().trim().max(200).optional(),
    utmContent: z.string().trim().max(200).optional(),
    utmId: z.string().trim().max(200).optional(),
    landingPath: z.string().trim().max(300).optional(),
    landingUrl: z.string().trim().max(1000).optional(),
    referrer: z.string().trim().max(500).optional(),
    googleCampaignId: z.string().trim().max(120).optional(),
    googleAdGroupId: z.string().trim().max(120).optional(),
    googleAdId: z.string().trim().max(120).optional(),
    googleKeyword: z.string().trim().max(200).optional(),
    googleMatchType: z.string().trim().max(40).optional(),
    googleDevice: z.string().trim().max(40).optional(),
    googleNetwork: z.string().trim().max(80).optional(),
    deviceType: z.string().trim().max(40).optional(),
    browser: z.string().trim().max(80).optional(),
    userAgent: z.string().trim().max(300).optional(),
    geoCity: z.string().trim().max(120).optional()
  })
  .optional();

const analyticsPropertyValueSchema = z.union([
  z.string().trim().max(500),
  z.number().finite(),
  z.boolean(),
  z.null()
]);

const analyticsPropertiesSchema = z
  .record(analyticsPropertyValueSchema)
  .optional()
  .refine((value) => JSON.stringify(value ?? {}).length <= 12_000, {
    message: 'Event properties are too large.'
  });

const analyticsConsentSchema = z.object({
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean()
});

const analyticsSessionSchema = z.object({
  id: z.string().trim().min(8).max(120),
  anonymousId: z.string().trim().min(8).max(120),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  attribution: attributionSchema.default({}),
  consent: analyticsConsentSchema
});

const analyticsEventSchema = z.object({
  eventId: z.string().trim().min(8).max(120),
  eventName: z.enum(analyticsEventNames),
  route: z.string().trim().min(1).max(300),
  step: z.string().trim().max(80).optional(),
  leadId: z.string().trim().max(120).optional(),
  quoteId: z.string().trim().max(120).optional(),
  properties: analyticsPropertiesSchema,
  createdAt: z.string().datetime()
});

export const analyticsEventBatchSchema = z.object({
  session: analyticsSessionSchema,
  events: z.array(analyticsEventSchema).min(1).max(50)
});

export const quoteDraftPayloadSchema = z.object({
  address: z.string().trim().min(3).max(300),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  polygon: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(coordinateSchema).min(1)).min(1)
    }),
    z.object({
      type: z.literal('MultiPolygon'),
      coordinates: z.array(z.array(z.array(coordinateSchema).min(1)).min(1)).min(1)
    })
  ]),
  plan: z.string().trim().min(3).max(120),
  quoteTotal: z.number().nonnegative(),
  serviceFrequency: z.enum(['weekly']).optional(),
  billingMode: z.enum(['seasonal', 'per_session']).optional(),
  baseTotal: z.number().nonnegative().optional(),
  pricingVersion: z.string().trim().min(1).max(40).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  polygonSource: polygonSourceSchema,
  attribution: attributionSchema
});

export const quoteContactPayloadSchema = z.object({
  message: z.string().trim().max(5000).optional(),
  attribution: attributionSchema
});

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40).optional(),
  addressText: z.string().trim().max(300).optional(),
  message: z.string().trim().min(8).max(5000),
  marketingConsent: z.boolean().optional(),
  attribution: attributionSchema
});

export const serviceAreaCheckSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const serviceAreaRequestPayloadSchema = z.object({
  addressText: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  source: z.enum(['out_of_area_page', 'coverage_checker', 'instant_quote', 'contact_form']),
  isInServiceAreaAtCapture: z.boolean()
});

export const adminQuoteStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'in_review', 'verified', 'rejected'])
});

export const adminQuoteNoteSchema = z.object({
  note: z.string().trim().min(2).max(5000)
});

export const adminQuoteRevisionSchema = z.object({
  perSessionTotal: z.number().nonnegative().optional(),
  finalTotal: z.number().nonnegative().optional(),
  overrideAmount: z.number().nonnegative().optional(),
  overrideReason: z.string().trim().max(2000).optional()
}).refine((payload) => payload.perSessionTotal !== undefined || payload.finalTotal !== undefined, {
  message: 'perSessionTotal or finalTotal is required',
  path: ['perSessionTotal']
});

export const adminQuoteVersionCreateSchema = z.object({
  polygonSource: polygonSourceSchema,
  serviceFrequency: z.enum(['weekly']).optional(),
  perSessionTotal: z.number().nonnegative(),
  finalTotal: z.number().nonnegative(),
  globalDiscountRate: z.number().min(0).max(0.5).optional(),
  seasonalDiscountRate: z.number().min(0).max(0.5).optional(),
  priceOverrideEnabled: z.boolean().optional(),
  overrideBasePerSessionTotal: z.number().nonnegative().optional(),
  overrideReason: z.string().trim().max(2000).optional()
});

export const adminQuoteCreateSchema = z.object({
  quoteId: publicQuoteIdSchema.optional(),
  address: z.string().trim().min(3).max(300),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  polygon: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('Polygon'),
      coordinates: z.array(z.array(coordinateSchema).min(1)).min(1)
    }),
    z.object({
      type: z.literal('MultiPolygon'),
      coordinates: z.array(z.array(z.array(coordinateSchema).min(1)).min(1)).min(1)
    })
  ]),
  polygonSource: polygonSourceSchema,
  serviceFrequency: z.enum(['weekly']).optional(),
  billingMode: z.enum(['seasonal', 'per_session']).optional(),
  pricingVersion: z.string().trim().min(1).max(40).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  globalDiscountRate: z.number().min(0).max(0.5).optional(),
  seasonalDiscountRate: z.number().min(0).max(0.5).optional(),
  priceOverrideEnabled: z.boolean().optional(),
  overrideBasePerSessionTotal: z.number().nonnegative().optional(),
  overrideReason: z.string().trim().max(2000).optional()
});

export const accountQuoteBillingModeSchema = z.object({
  billingMode: z.enum(['seasonal', 'per_session'])
});
