import { z } from 'zod';

const coordinateSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
  ]);

const polygonSourcePolygonSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(['service', 'obstacle']),
  points: z.array(coordinateSchema).min(3)
});

export const polygonSourceSchema = z.object({
  schemaVersion: z.literal(1),
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
  serviceFrequency: z.enum(['weekly', 'biweekly']).optional()
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
    landingPath: z.string().trim().max(300).optional(),
    referrer: z.string().trim().max(500).optional(),
    deviceType: z.string().trim().max(40).optional(),
    browser: z.string().trim().max(80).optional(),
    geoCity: z.string().trim().max(120).optional()
  })
  .optional();

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
  serviceFrequency: z.enum(['weekly', 'biweekly']).optional(),
  baseTotal: z.number().nonnegative().optional(),
  pricingVersion: z.string().trim().min(1).max(40).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  polygonSource: z.unknown().optional(),
  attribution: attributionSchema
});

export const quoteContactPayloadSchema = z.object({
  phone: z.string().trim().min(7).max(40),
  addressText: z.string().trim().max(300).optional(),
  message: z.string().trim().max(5000).optional(),
  attribution: attributionSchema
});

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(7).max(40).optional(),
  addressText: z.string().trim().max(300).optional(),
  message: z.string().trim().min(8).max(5000),
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
  serviceFrequency: z.enum(['weekly', 'biweekly']),
  perSessionTotal: z.number().nonnegative(),
  finalTotal: z.number().nonnegative(),
  overrideReason: z.string().trim().max(2000).optional()
});
