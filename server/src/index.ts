import http from 'node:http';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import { validateAndMeasurePolygon } from './lib/geometry.js';
import { contactPayloadSchema, quotePayloadSchema } from './lib/schemas.js';
import { store } from './lib/store.js';

dotenv.config();

const port = Number(process.env.PORT ?? 4000);
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const envOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

const globalWindowMs = 60_000;
const globalLimit = 45;
const writeWindowMs = 60_000;
const writeLimit = 20;
const metricDriftTolerance = 0.03;

const globalRequests = new Map<string, number[]>();
const writeRequests = new Map<string, number[]>();

const json = (res: http.ServerResponse, statusCode: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
};

const getClientIp = (req: http.IncomingMessage) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
};

const withinRateLimit = (
  requests: Map<string, number[]>,
  key: string,
  windowMs: number,
  max: number
) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = (requests.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= max) {
    requests.set(key, recent);
    return false;
  }

  recent.push(now);
  requests.set(key, recent);
  return true;
};

const readJson = async (req: http.IncomingMessage, limitBytes = 1_000_000) => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > limitBytes) {
      throw new Error('Payload too large.');
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw) as unknown;
};

const applyCors = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.size > 0) {
    res.setHeader('Access-Control-Allow-Origin', [...allowedOrigins][0]);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const ip = getClientIp(req);

  if (pathname.startsWith('/api')) {
    const allowed = withinRateLimit(globalRequests, ip, globalWindowMs, globalLimit);
    if (!allowed) {
      json(res, 429, { error: 'Too many requests. Please try again shortly.' });
      return;
    }
  }

  if (method === 'GET' && pathname === '/') {
    json(res, 200, {
      ok: true,
      message: 'Autoscape API is running.',
      frontend: [...allowedOrigins][0] ?? 'http://localhost:5173',
      health: '/api/health'
    });
    return;
  }

  if (method === 'GET' && pathname === '/api/health') {
    json(res, 200, { ok: true, service: 'autoscape-server' });
    return;
  }

  if (method === 'GET' && pathname.startsWith('/api/quote/')) {
    const id = pathname.split('/').pop() ?? '';
    const quote = store.getQuote(id);
    if (!quote) {
      json(res, 404, { error: 'Quote not found.' });
      return;
    }
    json(res, 200, quote);
    return;
  }

  if (method === 'POST' && (pathname === '/api/quote' || pathname === '/api/contact')) {
    const writeAllowed = withinRateLimit(writeRequests, ip, writeWindowMs, writeLimit);
    if (!writeAllowed) {
      json(res, 429, { error: 'Rate limit reached for submissions. Please retry in a minute.' });
      return;
    }
  }

  if (method === 'POST' && pathname === '/api/contact') {
    try {
      const body = await readJson(req);
      const parsed = contactPayloadSchema.safeParse(body);

      if (!parsed.success) {
        json(res, 400, { error: 'Invalid contact payload.', details: parsed.error.flatten() });
        return;
      }

      const payload = parsed.data;
      const contact = store.saveContact({
        id: nanoid(10),
        createdAt: new Date().toISOString(),
        name: payload.name,
        email: payload.email,
        message: payload.message
      });

      json(res, 201, { ok: true, id: contact.id });
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        json(res, 400, { error: 'Invalid JSON body.' });
        return;
      }
      if (error instanceof Error && error.message === 'Payload too large.') {
        json(res, 413, { error: 'Payload too large.' });
        return;
      }
      json(res, 500, { error: 'Unexpected server error.' });
      return;
    }
  }

  if (method === 'POST' && pathname === '/api/quote') {
    try {
      const body = await readJson(req);
      const parsed = quotePayloadSchema.safeParse(body);

      if (!parsed.success) {
        json(res, 400, { error: 'Invalid quote payload.', details: parsed.error.flatten() });
        return;
      }

      const payload = parsed.data;
      const ring = payload.polygon.coordinates[0] as [number, number][];

      let measured;
      try {
        measured = validateAndMeasurePolygon(ring);
      } catch (error) {
        json(res, 400, {
          error: error instanceof Error ? error.message : 'Invalid polygon geometry.'
        });
        return;
      }

      if (measured.selfIntersecting) {
        json(res, 400, { error: 'Polygon is self-intersecting. Please redraw the boundary.' });
        return;
      }

      const areaDrift = Math.abs(payload.metrics.areaM2 - measured.areaM2) / measured.areaM2;
      const perimeterDrift = Math.abs(payload.metrics.perimeterM - measured.perimeterM) / measured.perimeterM;

      if (areaDrift > metricDriftTolerance || perimeterDrift > metricDriftTolerance) {
        json(res, 400, { error: 'Submitted geometry metrics differ from server measurement.' });
        return;
      }

      const quoteId = nanoid(10);
      store.saveQuote({
        id: quoteId,
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

      json(res, 201, { quoteId });
      return;
    } catch (error) {
      if (error instanceof SyntaxError) {
        json(res, 400, { error: 'Invalid JSON body.' });
        return;
      }
      if (error instanceof Error && error.message === 'Payload too large.') {
        json(res, 413, { error: 'Payload too large.' });
        return;
      }
      json(res, 500, { error: 'Unexpected server error.' });
      return;
    }
  }

  json(res, 404, { error: `Cannot ${method} ${pathname}` });
});

server.listen(port, () => {
  console.log(`Autoscape API running on http://localhost:${port}`);
});
