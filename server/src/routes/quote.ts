import { Router } from 'express';
import { nanoid } from 'nanoid';
import { quotePayloadSchema } from '../lib/schemas.js';
import { store } from '../lib/store.js';
import { validateAndMeasurePolygon } from '../lib/geometry.js';

const METRIC_DRIFT_TOLERANCE = 0.03;

export const quoteRouter = Router();

quoteRouter.post('/', (req, res) => {
  const parsed = quotePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid quote payload.',
      details: parsed.error.flatten()
    });
  }

  const payload = parsed.data;
  const ring = payload.polygon.coordinates[0];

  let measured;
  try {
    measured = validateAndMeasurePolygon(ring as [number, number][]);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid polygon geometry.'
    });
  }

  if (measured.selfIntersecting) {
    return res.status(400).json({
      error: 'Polygon is self-intersecting. Please redraw the boundary.'
    });
  }

  const areaDrift = Math.abs(payload.metrics.areaM2 - measured.areaM2) / measured.areaM2;
  const perimeterDrift = Math.abs(payload.metrics.perimeterM - measured.perimeterM) / measured.perimeterM;

  if (areaDrift > METRIC_DRIFT_TOLERANCE || perimeterDrift > METRIC_DRIFT_TOLERANCE) {
    return res.status(400).json({
      error: 'Submitted geometry metrics differ from server measurement.'
    });
  }

  const id = nanoid(10);

  store.saveQuote({
    id,
    createdAt: new Date().toISOString(),
    address: payload.address,
    location: payload.location,
    polygon: {
      type: 'Polygon',
      coordinates: [measured.normalizedRing]
    },
    metrics: {
      areaM2: measured.areaM2,
      perimeterM: measured.perimeterM
    },
    plan: payload.plan,
    quoteTotal: payload.quoteTotal
  });

  return res.status(201).json({ quoteId: id });
});

quoteRouter.get('/:id', (req, res) => {
  const quote = store.getQuote(req.params.id);
  if (!quote) {
    return res.status(404).json({ error: 'Quote not found.' });
  }

  return res.json(quote);
});
