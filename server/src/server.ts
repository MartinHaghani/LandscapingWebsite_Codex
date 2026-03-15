import { createHash } from 'node:crypto';
import http from 'node:http';
import { createServiceAreaPayload, pointInGeometry, type ServiceAreaFeatureCollection } from './lib/serviceArea.js';
import { loadBaseStationsFromEnv, loadServedRegionsFromEnv, type BaseStationConfig } from './lib/serviceAreaConfig.js';
import {
  adminQuoteNoteSchema,
  adminQuoteRevisionSchema,
  adminQuoteStatusSchema,
  adminQuoteVersionCreateSchema,
  contactPayloadSchema,
  quoteDraftPayloadSchema,
  quotePayloadSchema,
  quoteContactPayloadSchema,
  serviceAreaCheckSchema,
  serviceAreaRequestPayloadSchema
} from './lib/schemas.js';
import { createDataStore } from './lib/dataStore.js';
import {
  hasCapability,
  resolveAdminIdentity,
  resolveCustomerIdentity,
  type AdminIdentity,
  type CustomerIdentity
} from './lib/adminAuth.js';

interface CreateServerOptions {
  port?: number;
  clientOrigins?: string[];
  baseStations?: BaseStationConfig[];
  servedRegions?: string[];
  serviceAreaCacheTtlMs?: number;
  nowMs?: () => number;
  authResolvers?: {
    resolveCustomerIdentity?: (req: http.IncomingMessage) => Promise<CustomerIdentity | null>;
    resolveAdminIdentity?: (req: http.IncomingMessage) => Promise<AdminIdentity | null>;
  };
}

interface ServiceAreaCacheEntry {
  payload: ServiceAreaFeatureCollection;
  serialized: string;
  etag: string;
  expiresAt: number;
}

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];
const globalWindowMs = 60_000;
const globalLimit = 80;
const writeWindowMs = 60_000;
const writeLimit = 30;
const serviceAreaWindowMs = 60_000;
const serviceAreaLimit = 40;
const defaultServiceAreaCacheTtlMs = 60 * 60 * 1_000;

const getClientIp = (req: http.IncomingMessage) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
};

const hashIp = (ip: string) => createHash('sha256').update(ip).digest('hex');

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

const json = (res: http.ServerResponse, statusCode: number, payload: unknown) => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
};

const csvResponse = (res: http.ServerResponse, statusCode: number, filename: string, payload: string) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(payload));
  res.end(payload);
};

const parseLimit = (value: string | null, fallback = 25, max = 100) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
};

const parseBooleanParam = (value: string | null) => {
  if (value === null) {
    return undefined;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return undefined;
};

const parseSortDir = (value: string | null): 'asc' | 'desc' | undefined => {
  if (value === 'asc') {
    return 'asc';
  }
  if (value === 'desc') {
    return 'desc';
  }

  return undefined;
};

const parseBbox = (value: string | null): [number, number, number, number] | undefined => {
  if (!value) {
    return undefined;
  }

  const parts = value.split(',').map((segment) => Number.parseFloat(segment.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat) {
    return undefined;
  }

  return [minLng, minLat, maxLng, maxLat];
};

const getIdempotencyKey = (req: http.IncomingMessage) => {
  const header = req.headers['idempotency-key'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  return null;
};

const mapStoreError = (error: unknown): { statusCode: number; message: string } => {
  if (!(error instanceof Error)) {
    return {
      statusCode: 500,
      message: 'Unexpected server error.'
    };
  }

  switch (error.message) {
    case 'IDEMPOTENCY_PAYLOAD_MISMATCH':
      return {
        statusCode: 409,
        message: 'Idempotency key already used with a different payload.'
      };
    case 'QUOTE_NOT_FOUND':
      return {
        statusCode: 404,
        message: 'Quote not found.'
      };
    case 'LEAD_NOT_FOUND':
      return {
        statusCode: 404,
        message: 'Lead not found.'
      };
    case 'QUOTE_CONTACT_FINALIZE_NOT_ALLOWED':
      return {
        statusCode: 409,
        message: 'Quote contact finalize is not allowed for the current quote state.'
      };
    case 'QUOTE_ALREADY_CLAIMED':
      return {
        statusCode: 409,
        message: 'Quote is already claimed by a different account.'
      };
    case 'QUOTE_FORBIDDEN':
      return {
        statusCode: 403,
        message: 'You do not have access to this quote.'
      };
    case 'AUTH_REQUIRED':
      return {
        statusCode: 401,
        message: 'Authentication is required for this request.'
      };
    case 'AUTH_FORBIDDEN':
      return {
        statusCode: 403,
        message: 'You do not have access to this resource.'
      };
    case 'AUTH_PROFILE_INCOMPLETE':
      return {
        statusCode: 400,
        message: 'Authenticated account profile is missing required fields.'
      };
    case 'AUTH_CONFIG_ERROR':
      return {
        statusCode: 500,
        message: 'Authentication is not configured correctly.'
      };
    case 'QUOTE_NOT_IN_REVIEW':
      return {
        statusCode: 409,
        message: 'Quote can only be revised while in review.'
      };
    case 'QUOTE_VERSION_NOT_FOUND':
      return {
        statusCode: 404,
        message: 'Quote version not found.'
      };
    case 'QUOTE_EDITOR_SOURCE_INVALID':
      return {
        statusCode: 400,
        message: 'Invalid quote editor payload.'
      };
    case 'QUOTE_EDITOR_GEOMETRY_INVALID':
      return {
        statusCode: 409,
        message: 'Quote geometry could not be loaded for editing.'
      };
    default:
      if (
        error.message.startsWith('Polygon source includes') ||
        error.message === 'At least one service polygon is required.' ||
        error.message === 'Unable to merge service polygons.' ||
        error.message === 'Obstacles remove the entire service area.'
      ) {
        return {
          statusCode: 400,
          message: error.message
        };
      }

      if (error.message.startsWith('Illegal quote status transition')) {
        return {
          statusCode: 409,
          message: error.message
        };
      }

      return {
        statusCode: 500,
        message: error.message || 'Unexpected server error.'
      };
  }
};

const buildServiceAreaCacheEntry = (
  stations: BaseStationConfig[],
  servedRegions: string[],
  nowMs: number,
  ttlMs: number
): ServiceAreaCacheEntry => {
  const payload = createServiceAreaPayload(stations, servedRegions, new Date(nowMs).toISOString());
  const serialized = JSON.stringify(payload);
  const etag = `"${createHash('sha256').update(serialized).digest('base64url')}"`;

  return {
    payload,
    serialized,
    etag,
    expiresAt: nowMs + ttlMs
  };
};

const getPathMatch = (pathname: string, pattern: RegExp) => {
  const match = pathname.match(pattern);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
};

export const createServer = (options: CreateServerOptions = {}) => {
  const port = options.port ?? Number(process.env.PORT ?? 4000);
  const envOrigins = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(options.clientOrigins ?? [...defaultOrigins, ...envOrigins]);
  const nowMs = options.nowMs ?? (() => Date.now());
  const cacheTtlMs = options.serviceAreaCacheTtlMs ?? defaultServiceAreaCacheTtlMs;
  const baseStations = options.baseStations ?? loadBaseStationsFromEnv();
  const servedRegions = options.servedRegions ?? loadServedRegionsFromEnv();
  const dataStore = createDataStore(baseStations);
  const customerIdentityResolver = options.authResolvers?.resolveCustomerIdentity ?? resolveCustomerIdentity;
  const adminIdentityResolver = options.authResolvers?.resolveAdminIdentity ?? resolveAdminIdentity;
  void dataStore.initialize().catch((error) => {
    console.error('Failed to initialize datastore base stations:', error);
  });

  const globalRequests = new Map<string, number[]>();
  const writeRequests = new Map<string, number[]>();
  const serviceAreaRequests = new Map<string, number[]>();

  let serviceAreaCache: ServiceAreaCacheEntry | null = null;

  const getCachedServiceArea = () => {
    const now = nowMs();
    if (serviceAreaCache && serviceAreaCache.expiresAt > now) {
      return serviceAreaCache;
    }

    serviceAreaCache = buildServiceAreaCacheEntry(baseStations, servedRegions, now, cacheTtlMs);
    return serviceAreaCache;
  };

  const applyCors = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.size > 0) {
      res.setHeader('Access-Control-Allow-Origin', [...allowedOrigins][0]);
    }

    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,If-None-Match,Authorization,Idempotency-Key,X-Correlation-Id'
    );
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

    if (pathname === '/api/service-area' || pathname.startsWith('/api/service-area/')) {
      const allowed = withinRateLimit(serviceAreaRequests, ip, serviceAreaWindowMs, serviceAreaLimit);
      if (!allowed) {
        json(res, 429, { error: 'Too many service-area requests. Please try again shortly.' });
        return;
      }
    }

    if (
      method === 'POST' &&
      (pathname === '/api/quote' ||
        pathname === '/api/quote/draft' ||
        pathname.match(/^\/api\/quote\/[^/]+\/contact$/) ||
        pathname.match(/^\/api\/quote\/[^/]+\/claim$/) ||
        pathname === '/api/contact' ||
        pathname === '/api/service-area/request')
    ) {
      const writeAllowed = withinRateLimit(writeRequests, ip, writeWindowMs, writeLimit);
      if (!writeAllowed) {
        json(res, 429, { error: 'Rate limit reached for submissions. Please retry in a minute.' });
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
      json(res, 200, { ok: true, service: 'autoscape-server', mode: 'admin-platform-v1' });
      return;
    }

    if (method === 'GET' && pathname === '/api/service-area') {
      const cached = getCachedServiceArea();
      res.setHeader('ETag', cached.etag);
      res.setHeader('Cache-Control', 'public, max-age=300');

      const ifNoneMatch = req.headers['if-none-match'];
      if (typeof ifNoneMatch === 'string' && ifNoneMatch.trim() === cached.etag) {
        res.statusCode = 304;
        res.end();
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Length', Buffer.byteLength(cached.serialized));
      res.end(cached.serialized);
      return;
    }

    if (method === 'POST' && pathname === '/api/service-area/check') {
      try {
        const body = await readJson(req);
        const parsed = serviceAreaCheckSchema.safeParse(body);
        if (!parsed.success) {
          json(res, 400, {
            error: 'Invalid service-area check payload.',
            details: parsed.error.flatten()
          });
          return;
        }

        const cached = getCachedServiceArea();
        const point: [number, number] = [parsed.data.lng, parsed.data.lat];
        const inServiceArea = cached.payload.features.some((feature) =>
          pointInGeometry(point, feature.geometry)
        );

        json(res, 200, {
          inServiceArea,
          approximate: true,
          disclaimer: cached.payload.metadata.disclaimer,
          updatedAt: cached.payload.metadata.updatedAt
        });
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

    if (method === 'POST' && pathname === '/api/service-area/request') {
      try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
          json(res, 400, { error: 'Missing Idempotency-Key header.' });
          return;
        }

        const body = await readJson(req);
        const parsed = serviceAreaRequestPayloadSchema.safeParse(body);

        if (!parsed.success) {
          json(res, 400, {
            error: 'Invalid service-area request payload.',
            details: parsed.error.flatten()
          });
          return;
        }

        const result = await dataStore.createServiceAreaRequest({
          idempotencyKey,
          addressText: parsed.data.addressText,
          lat: parsed.data.lat,
          lng: parsed.data.lng,
          source: parsed.data.source,
          isInServiceAreaAtCapture: parsed.data.isInServiceAreaAtCapture
        });

        json(res, result.statusCode, {
          ...result.body,
          replayed: result.replayed
        });
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

        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    if (method === 'POST' && pathname === '/api/contact') {
      try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
          json(res, 400, { error: 'Missing Idempotency-Key header.' });
          return;
        }

        const body = await readJson(req);
        const parsed = contactPayloadSchema.safeParse(body);

        if (!parsed.success) {
          json(res, 400, { error: 'Invalid contact payload.', details: parsed.error.flatten() });
          return;
        }

        const result = await dataStore.submitContactForm({
          idempotencyKey,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          addressText: parsed.data.addressText,
          message: parsed.data.message,
          attribution: parsed.data.attribution
        });

        json(res, result.statusCode, {
          ...result.body,
          replayed: result.replayed
        });
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

        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    if (method === 'POST' && (pathname === '/api/quote/draft' || pathname === '/api/quote')) {
      try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
          json(res, 400, { error: 'Missing Idempotency-Key header.' });
          return;
        }

        let customerIdentity: CustomerIdentity | null = null;
        try {
          customerIdentity = await customerIdentityResolver(req);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'AUTH_REQUIRED') {
            throw error;
          }
        }

        const body = await readJson(req);
        const parsedDraft = quoteDraftPayloadSchema.safeParse(body);

        if (!parsedDraft.success) {
          const parsedLegacy = quotePayloadSchema.safeParse(body);
          if (!parsedLegacy.success) {
            json(res, 400, { error: 'Invalid quote payload.', details: parsedDraft.error.flatten() });
            return;
          }

          const legacy = parsedLegacy.data;
          const result = await dataStore.createQuoteDraft({
            idempotencyKey,
            addressText: legacy.address,
            location: legacy.location,
            polygon: legacy.polygon,
            recommendedPlan: legacy.plan,
            pricingVersion: 'legacy-v1',
            currency: 'CAD',
            serviceFrequency: legacy.serviceFrequency ?? 'weekly',
            baseTotal: legacy.quoteTotal,
            finalTotal: legacy.quoteTotal,
            authUserId: customerIdentity?.userId
          });

          json(res, result.statusCode, {
            ...result.body,
            replayed: result.replayed
          });
          return;
        }

        const payload = parsedDraft.data;

        const result = await dataStore.createQuoteDraft({
          idempotencyKey,
          addressText: payload.address,
          location: payload.location,
          polygon: payload.polygon,
          polygonSourceJson: payload.polygonSource,
          recommendedPlan: payload.plan,
          pricingVersion: payload.pricingVersion ?? 'v1',
          currency: payload.currency ?? 'CAD',
          serviceFrequency: payload.serviceFrequency ?? 'weekly',
          baseTotal: payload.baseTotal ?? payload.quoteTotal,
          finalTotal: payload.quoteTotal,
          attribution: payload.attribution,
          authUserId: customerIdentity?.userId
        });

        json(res, result.statusCode, {
          ...result.body,
          replayed: result.replayed
        });
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

        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    const quoteClaimId = getPathMatch(pathname, /^\/api\/quote\/([^/]+)\/claim$/);
    if (method === 'POST' && quoteClaimId) {
      try {
        const customerIdentity = await customerIdentityResolver(req);
        if (!customerIdentity) {
          throw new Error('AUTH_REQUIRED');
        }

        const result = await dataStore.claimQuoteOwnership({
          quotePublicId: quoteClaimId,
          authUserId: customerIdentity.userId
        });

        json(res, result.statusCode, {
          ...result.body
        });
        return;
      } catch (error) {
        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    const quoteContactId = getPathMatch(pathname, /^\/api\/quote\/([^/]+)\/contact$/);
    if (method === 'POST' && quoteContactId) {
      try {
        const customerIdentity = await customerIdentityResolver(req);
        if (!customerIdentity) {
          throw new Error('AUTH_REQUIRED');
        }

        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
          json(res, 400, { error: 'Missing Idempotency-Key header.' });
          return;
        }

        const body = await readJson(req);
        const parsed = quoteContactPayloadSchema.safeParse(body);

        if (!parsed.success) {
          json(res, 400, { error: 'Invalid quote contact payload.', details: parsed.error.flatten() });
          return;
        }

        const result = await dataStore.finalizeQuoteContact({
          idempotencyKey,
          quotePublicId: quoteContactId,
          authUserId: customerIdentity.userId,
          name: customerIdentity.name ?? 'Autoscape Customer',
          email: customerIdentity.email,
          phone: parsed.data.phone,
          addressText: parsed.data.addressText,
          message: parsed.data.message,
          attribution: parsed.data.attribution
        });

        json(res, result.statusCode, {
          ...result.body,
          replayed: result.replayed
        });
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

        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    if (method === 'GET' && pathname === '/api/account/quotes') {
      try {
        const customerIdentity = await customerIdentityResolver(req);
        if (!customerIdentity) {
          throw new Error('AUTH_REQUIRED');
        }

        const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
        const cursor = url.searchParams.get('cursor') ?? undefined;
        const result = await dataStore.listAccountQuotes({
          authUserId: customerIdentity.userId,
          limit,
          cursor
        });

        json(res, 200, result);
        return;
      } catch (error) {
        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    const accountQuoteId = getPathMatch(pathname, /^\/api\/account\/quotes\/([^/]+)$/);
    if (method === 'GET' && accountQuoteId) {
      try {
        const customerIdentity = await customerIdentityResolver(req);
        if (!customerIdentity) {
          throw new Error('AUTH_REQUIRED');
        }

        const quote = await dataStore.getQuoteByPublicId(accountQuoteId, {
          authUserId: customerIdentity.userId,
          isAdmin: false
        });
        if (!quote) {
          json(res, 404, { error: 'Quote not found.' });
          return;
        }

        json(res, 200, quote);
        return;
      } catch (error) {
        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    const quoteId = getPathMatch(pathname, /^\/api\/quote\/([^/]+)$/);
    if (method === 'GET' && quoteId) {
      try {
        let customerIdentity: CustomerIdentity | null = null;
        let adminIdentity: AdminIdentity | null = null;

        try {
          customerIdentity = await customerIdentityResolver(req);
        } catch (error) {
          if (!(error instanceof Error) || (error.message !== 'AUTH_REQUIRED' && error.message !== 'AUTH_PROFILE_INCOMPLETE')) {
            throw error;
          }
        }

        try {
          adminIdentity = await adminIdentityResolver(req);
        } catch (error) {
          if (!(error instanceof Error) || (error.message !== 'AUTH_REQUIRED' && error.message !== 'AUTH_FORBIDDEN')) {
            throw error;
          }
        }

        if (!customerIdentity && !adminIdentity) {
          throw new Error('AUTH_REQUIRED');
        }

        const quote = await dataStore.getQuoteByPublicId(quoteId, {
          authUserId: customerIdentity?.userId,
          isAdmin: Boolean(adminIdentity)
        });
        if (!quote) {
          json(res, 404, { error: 'Quote not found.' });
          return;
        }

        json(res, 200, quote);
        return;
      } catch (error) {
        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    if (pathname.startsWith('/api/admin')) {
      let identity: AdminIdentity | null = null;
      try {
        identity = await adminIdentityResolver(req);
      } catch (error) {
        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }

      if (!identity) {
        json(res, 401, { error: 'Authentication is required for this request.' });
        return;
      }

      const correlationId =
        (req.headers['x-correlation-id'] as string | undefined)?.trim() || createHash('sha1').update(String(nowMs())).digest('hex').slice(0, 16);

      const actor = {
        userId: identity.userId,
        role: identity.role,
        correlationId,
        ipHash: hashIp(ip),
        userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 300)
      } as const;
      const canMutateQuotes =
        identity.role === 'OWNER' || identity.role === 'ADMIN' || identity.role === 'REVIEWER';

      try {
        if (method === 'GET' && pathname === '/api/admin/health') {
          json(res, 200, {
            ok: true,
            role: identity.role,
            capabilities: {
              viewPiiFull: hasCapability(identity.role, 'VIEW_PII_FULL'),
              viewAttribution: hasCapability(identity.role, 'VIEW_ATTRIBUTION'),
              exportPiiFull: hasCapability(identity.role, 'EXPORT_PII_FULL'),
              exportMarketingSafe: hasCapability(identity.role, 'EXPORT_MARKETING_SAFE')
            }
          });
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/quotes') {
          const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
          const cursor = url.searchParams.get('cursor') ?? undefined;
          const q = url.searchParams.get('q') ?? undefined;
          const status = url.searchParams.get('status') ?? undefined;
          const serviceFrequency = url.searchParams.get('serviceFrequency') ?? undefined;
          const contactPending = parseBooleanParam(url.searchParams.get('contactPending'));
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const submittedFrom = url.searchParams.get('submittedFrom') ?? undefined;
          const submittedTo = url.searchParams.get('submittedTo') ?? undefined;
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as
            | 'createdAt'
            | 'submittedAt'
            | 'perSessionTotal'
            | 'seasonalTotalMax'
            | undefined;
          const sortDir = parseSortDir(url.searchParams.get('sortDir'));

          const result = await dataStore.listQuotes({
            limit,
            cursor,
            q,
            status,
            serviceFrequency: serviceFrequency === 'biweekly' ? 'biweekly' : serviceFrequency === 'weekly' ? 'weekly' : undefined,
            contactPending,
            createdFrom,
            createdTo,
            submittedFrom,
            submittedTo,
            sortBy,
            sortDir,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        const adminQuoteEditorId = getPathMatch(pathname, /^\/api\/admin\/quotes\/([^/]+)\/editor$/);
        if (method === 'GET' && adminQuoteEditorId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const result = await dataStore.getQuoteEditor({
            quotePublicId: adminQuoteEditorId,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/service-area-requests') {
          const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
          const cursor = url.searchParams.get('cursor') ?? undefined;
          const q = url.searchParams.get('q') ?? undefined;
          const source = url.searchParams.get('source') ?? undefined;
          const status = url.searchParams.get('status') ?? undefined;
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as
            | 'createdAt'
            | 'distanceToNearestStationM'
            | undefined;
          const sortDir = parseSortDir(url.searchParams.get('sortDir'));

          const result = await dataStore.listServiceAreaRequests({
            limit,
            cursor,
            q,
            source,
            status,
            createdFrom,
            createdTo,
            sortBy,
            sortDir,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/service-area-requests/map') {
          const q = url.searchParams.get('q') ?? undefined;
          const source = url.searchParams.get('source') ?? undefined;
          const status = url.searchParams.get('status') ?? undefined;
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const bbox = parseBbox(url.searchParams.get('bbox'));

          const result = await dataStore.listServiceAreaRequestMap({
            q,
            source,
            status,
            createdFrom,
            createdTo,
            bbox,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/contacts') {
          const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
          const cursor = url.searchParams.get('cursor') ?? undefined;
          const q = url.searchParams.get('q') ?? undefined;
          const channel = url.searchParams.get('channel');
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as
            | 'createdAt'
            | 'name'
            | 'email'
            | undefined;
          const sortDir = parseSortDir(url.searchParams.get('sortDir'));

          const result = await dataStore.listLeadContacts({
            limit,
            cursor,
            q,
            channel:
              channel === 'quote_finalize' || channel === 'contact_form'
                ? channel
                : undefined,
            createdFrom,
            createdTo,
            sortBy,
            sortDir,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/leads') {
          const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
          const cursor = url.searchParams.get('cursor') ?? undefined;
          const q = url.searchParams.get('q') ?? undefined;
          const consentMarketing = parseBooleanParam(url.searchParams.get('consentMarketing'));
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as
            | 'createdAt'
            | 'firstSeenAt'
            | 'lastSeenAt'
            | undefined;
          const sortDir = parseSortDir(url.searchParams.get('sortDir'));

          const result = await dataStore.listLeads({
            limit,
            cursor,
            q,
            consentMarketing,
            createdFrom,
            createdTo,
            sortBy,
            sortDir,
            role: identity.role
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/audit-logs') {
          const limit = parseLimit(url.searchParams.get('limit'), 25, 100);
          const cursor = url.searchParams.get('cursor') ?? undefined;
          const q = url.searchParams.get('q') ?? undefined;
          const actorRole = url.searchParams.get('actorRole');
          const entityType = url.searchParams.get('entityType') ?? undefined;
          const createdFrom = url.searchParams.get('createdFrom') ?? undefined;
          const createdTo = url.searchParams.get('createdTo') ?? undefined;
          const sortBy = (url.searchParams.get('sortBy') ?? undefined) as 'createdAt' | 'action' | undefined;
          const sortDir = parseSortDir(url.searchParams.get('sortDir'));

          const result = await dataStore.listAuditLogs({
            limit,
            cursor,
            q,
            actorRole:
              actorRole === 'OWNER' ||
              actorRole === 'ADMIN' ||
              actorRole === 'REVIEWER' ||
              actorRole === 'MARKETING' ||
              actorRole === 'SYSTEM'
                ? actorRole
                : undefined,
            entityType,
            createdFrom,
            createdTo,
            sortBy,
            sortDir
          });

          json(res, 200, result);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/attribution/summary') {
          if (!hasCapability(identity.role, 'VIEW_ATTRIBUTION')) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const launchAtRaw = process.env.SYSTEM_LAUNCH_AT?.trim();
          const launchAtDate = launchAtRaw ? new Date(launchAtRaw) : undefined;
          const launchAt = launchAtDate && !Number.isNaN(launchAtDate.valueOf()) ? launchAtDate : undefined;

          const summary = await dataStore.getAttributionSummary({
            launchAt
          });

          json(res, 200, summary);
          return;
        }

        if (method === 'GET' && pathname === '/api/admin/exports/quotes.csv') {
          if (!hasCapability(identity.role, 'EXPORT_MARKETING_SAFE')) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          if (identity.role === 'MARKETING' && !hasCapability(identity.role, 'EXPORT_PII_FULL')) {
            const exportResult = await dataStore.exportQuotesCsv(identity.role);
            csvResponse(res, 200, 'quotes-marketing-safe.csv', exportResult.csv);
            return;
          }

          const exportResult = await dataStore.exportQuotesCsv(identity.role);
          csvResponse(res, 200, 'quotes.csv', exportResult.csv);
          return;
        }

        const adminQuoteStatusId = getPathMatch(pathname, /^\/api\/admin\/quotes\/([^/]+)\/status$/);
        if (method === 'PATCH' && adminQuoteStatusId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const body = await readJson(req);
          const parsed = adminQuoteStatusSchema.safeParse(body);

          if (!parsed.success) {
            json(res, 400, {
              error: 'Invalid status payload.',
              details: parsed.error.flatten()
            });
            return;
          }

          const result = await dataStore.updateQuoteStatus({
            quotePublicId: adminQuoteStatusId,
            nextStatus: parsed.data.status,
            actor
          });

          json(res, 200, result);
          return;
        }

        const adminQuoteNoteId = getPathMatch(pathname, /^\/api\/admin\/quotes\/([^/]+)\/notes$/);
        if (method === 'POST' && adminQuoteNoteId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const body = await readJson(req);
          const parsed = adminQuoteNoteSchema.safeParse(body);

          if (!parsed.success) {
            json(res, 400, {
              error: 'Invalid note payload.',
              details: parsed.error.flatten()
            });
            return;
          }

          const result = await dataStore.addQuoteNote({
            quotePublicId: adminQuoteNoteId,
            note: parsed.data.note,
            actor
          });

          json(res, 201, { ok: true, note: result });
          return;
        }

        const adminQuoteRevisionId = getPathMatch(pathname, /^\/api\/admin\/quotes\/([^/]+)\/revise$/);
        if (method === 'POST' && adminQuoteRevisionId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const body = await readJson(req);
          const parsed = adminQuoteRevisionSchema.safeParse(body);

          if (!parsed.success) {
            json(res, 400, {
              error: 'Invalid revision payload.',
              details: parsed.error.flatten()
            });
            return;
          }

          const result = await dataStore.reviseQuote({
            quotePublicId: adminQuoteRevisionId,
            perSessionTotal: parsed.data.perSessionTotal ?? parsed.data.finalTotal ?? 0,
            finalTotal: parsed.data.finalTotal,
            overrideAmount: parsed.data.overrideAmount,
            overrideReason: parsed.data.overrideReason,
            actor
          });

          json(res, 200, result);
          return;
        }

        const adminQuoteVersionId = getPathMatch(pathname, /^\/api\/admin\/quotes\/([^/]+)\/versions$/);
        if (method === 'POST' && adminQuoteVersionId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const body = await readJson(req);
          const parsed = adminQuoteVersionCreateSchema.safeParse(body);

          if (!parsed.success) {
            json(res, 400, {
              error: 'Invalid version payload.',
              details: parsed.error.flatten()
            });
            return;
          }

          const result = await dataStore.createQuoteVersion({
            quotePublicId: adminQuoteVersionId,
            polygonSource: {
              ...parsed.data.polygonSource,
              activePolygonId: parsed.data.polygonSource.activePolygonId ?? null
            },
            serviceFrequency: parsed.data.serviceFrequency,
            perSessionTotal: parsed.data.perSessionTotal,
            finalTotal: parsed.data.finalTotal,
            overrideReason: parsed.data.overrideReason,
            actor
          });

          json(res, 200, result);
          return;
        }

        const adminQuoteVersionSubmitMatch = pathname.match(
          /^\/api\/admin\/quotes\/([^/]+)\/versions\/(\d+)\/submit$/
        );
        if (method === 'POST' && adminQuoteVersionSubmitMatch) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const quotePublicId = decodeURIComponent(adminQuoteVersionSubmitMatch[1]);
          const versionNumber = Number.parseInt(adminQuoteVersionSubmitMatch[2], 10);
          if (!Number.isFinite(versionNumber) || versionNumber < 1) {
            json(res, 400, { error: 'Invalid version number.' });
            return;
          }

          const result = await dataStore.submitQuoteVersion({
            quotePublicId,
            versionNumber,
            actor
          });

          json(res, 200, result);
          return;
        }

        json(res, 404, { error: `Cannot ${method} ${pathname}` });
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

        const mapped = mapStoreError(error);
        json(res, mapped.statusCode, { error: mapped.message });
        return;
      }
    }

    json(res, 404, { error: `Cannot ${method} ${pathname}` });
  });

  return { server, port };
};
