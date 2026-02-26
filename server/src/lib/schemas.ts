import { z } from 'zod';

const coordinateSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90)
  ])
  .readonly();

export const quotePayloadSchema = z.object({
  address: z.string().trim().min(3).max(300),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(coordinateSchema)).min(1)
  }),
  metrics: z.object({
    areaM2: z.number().positive(),
    perimeterM: z.number().positive()
  }),
  plan: z.string().trim().min(3).max(120),
  quoteTotal: z.number().nonnegative()
});

export const contactPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  message: z.string().trim().min(8).max(5000)
});
