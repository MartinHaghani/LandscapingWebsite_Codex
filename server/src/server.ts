import { createHash } from 'node:crypto';
import http from 'node:http';
import { nanoid } from 'nanoid';
import { createServiceAreaPayload, pointInGeometry, type ServiceAreaFeatureCollection } from './lib/serviceArea.js';
import { loadBaseStationsFromEnv, loadServedRegionsFromEnv, type BaseStationConfig } from './lib/serviceAreaConfig.js';
import {
  buildApprovedQuoteEmail,
  createResendApprovedQuoteEmailSender,
  type ApprovedQuoteEmailSender
} from './lib/approvedQuoteEmail.js';
import {
  buildApprovedQuotePreviewMapboxUrl,
  getApprovedQuotePreviewMapboxAccessToken
} from './lib/approvedQuotePreview.js';
import {
  adminQuoteNoteSchema,
  adminQuoteRevisionSchema,
  adminQuoteStatusSchema,
  adminQuoteVersionCreateSchema,
  contactPayloadSchema,
  quoteDraftPayloadSchema,
  quoteContactPayloadSchema,
  serviceAreaCheckSchema,
  serviceAreaRequestPayloadSchema
} from './lib/schemas.js';
import { createDataStore } from './lib/dataStore.js';
import {
  hasCapability,
  recordCustomerAddress,
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
  customerProfile?: {
    recordAddress?: (input: { userId: string; addressText: string }) => Promise<void>;
  };
  publicUrls?: {
    appBaseUrl?: string;
    apiBaseUrl?: string;
  };
  approvedQuoteEmail?: {
    sender?: ApprovedQuoteEmailSender;
  };
  approvedQuotePreview?: {
    mapboxAccessToken?: string;
    fetchImpl?: typeof fetch;
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
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceM = (from: [number, number], to: [number, number]) => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const hav =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(hav)));
};

const getDistanceToNearestStationKm = (point: [number, number], stations: BaseStationConfig[]) => {
  let nearestM = Infinity;

  stations.forEach((station) => {
    if (station.active === false) {
      return;
    }

    const distanceM = haversineDistanceM(point, [station.lng, station.lat]);
    nearestM = Math.min(nearestM, distanceM);
  });

  if (!Number.isFinite(nearestM)) {
    return 0;
  }

  return Number((nearestM / 1000).toFixed(3));
};

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

function assertCustomerPhoneProfile(
  customerIdentity: CustomerIdentity
): asserts customerIdentity is CustomerIdentity & { phone: string } {
  if (!customerIdentity.phone || customerIdentity.phone.trim().length < 7) {
    throw new Error('AUTH_PROFILE_INCOMPLETE');
  }
}

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

const normalizeBaseUrl = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
};

const getRequestOrigin = (req: http.IncomingMessage) => {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.host;

  if (!host) {
    return null;
  }

  const protocol = forwardedProto || 'http';
  return normalizeBaseUrl(`${protocol}://${host}`);
};

const getFirstConfiguredClientOrigin = (rawOrigins: string[]) =>
  rawOrigins.map((value) => normalizeBaseUrl(value)).find((value): value is string => Boolean(value)) ?? null;

const isLoopbackOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
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
  const customerAddressRecorder = options.customerProfile?.recordAddress ?? recordCustomerAddress;
  const configuredAppBaseUrl =
    normalizeBaseUrl(options.publicUrls?.appBaseUrl) ??
    normalizeBaseUrl(process.env.PUBLIC_APP_BASE_URL) ??
    getFirstConfiguredClientOrigin(envOrigins);
  const configuredApiBaseUrl =
    normalizeBaseUrl(options.publicUrls?.apiBaseUrl) ??
    normalizeBaseUrl(process.env.PUBLIC_API_BASE_URL);
  const approvedQuotePreviewMapboxAccessToken = getApprovedQuotePreviewMapboxAccessToken(
    options.approvedQuotePreview?.mapboxAccessToken
  );
  const approvedQuotePreviewFetch = options.approvedQuotePreview?.fetchImpl ?? fetch;
  const approvedQuoteEmailSender =
    options.approvedQuoteEmail?.sender ?? createResendApprovedQuoteEmailSender();
  void dataStore.initialize().catch((error) => {
    console.error('Failed to initialize datastore base stations:', error);
  });

  const globalRequests = new Map<string, number[]>();
  const writeRequests = new Map<string, number[]>();
  const serviceAreaRequests = new Map<string, number[]>();

  let serviceAreaCache: ServiceAreaCacheEntry | null = null;

  const resolveAppBaseUrl = (req: http.IncomingMessage) =>
    configuredAppBaseUrl ??
    normalizeBaseUrl(req.headers.origin as string | undefined) ??
    getRequestOrigin(req);

  const resolveApiBaseUrl = (req: http.IncomingMessage) =>
    configuredApiBaseUrl ??
    getRequestOrigin(req);

  const buildPaymentPageUrl = (req: http.IncomingMessage, quoteId: string) => {
    const appBaseUrl = resolveAppBaseUrl(req);
    if (!appBaseUrl) {
      return null;
    }

    return `${appBaseUrl}/dashboard/quotes/${encodeURIComponent(quoteId)}/payment`;
  };

  const buildPreviewImageBaseUrl = (req: http.IncomingMessage) => {
    const apiBaseUrl = resolveApiBaseUrl(req);
    if (!apiBaseUrl) {
      return null;
    }

    return `${apiBaseUrl}/api/approved-quote-preview`;
  };

  const buildConfiguredPreviewImageBaseUrl = () =>
    configuredApiBaseUrl ? `${configuredApiBaseUrl}/api/approved-quote-preview` : null;

  const getCachedServiceArea = () => {
    const now = nowMs();
    if (serviceAreaCache && serviceAreaCache.expiresAt > now) {
      return serviceAreaCache;
    }

    serviceAreaCache = buildServiceAreaCacheEntry(baseStations, servedRegions, now, cacheTtlMs);
    return serviceAreaCache;
  };

  const deliverApprovedQuoteEmail = async (input: {
    req: http.IncomingMessage;
    quotePublicId: string;
    approvedVersionNumber: number;
    triggerSource: 'approval' | 'manual_resend';
    actor: {
      userId: string;
      role: AdminIdentity['role'];
      requestId?: string;
      correlationId?: string;
      ipHash?: string;
      userAgent?: string;
    };
  }) => {
    try {
      const context = await dataStore.getApprovedQuoteEmailContext(input.quotePublicId);
      const previewToken = nanoid(24);
      const paymentPageUrl = buildPaymentPageUrl(input.req, input.quotePublicId);
      const previewImageBaseUrl = buildConfiguredPreviewImageBaseUrl();
      const previewImageUrl = previewImageBaseUrl
        ? `${previewImageBaseUrl}/${encodeURIComponent(previewToken)}`
        : null;
      const recipientEmail = context.recipientEmail?.trim() || '';

      if (!recipientEmail) {
        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'failed',
          provider: 'resend',
          errorMessage: 'Quote has no customer email on file.',
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: false
        };
      }

      if (!paymentPageUrl || !previewImageUrl) {
        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'failed',
          provider: 'resend',
          errorMessage: !previewImageUrl
            ? 'PUBLIC_API_BASE_URL is required for approved quote email map images.'
            : 'Public application URL is not configured for approved quote emails.',
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: false
        };
      }

      if (!approvedQuotePreviewMapboxAccessToken) {
        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'failed',
          provider: 'resend',
          errorMessage: 'MAPBOX_STATIC_ACCESS_TOKEN is required for approved quote email map images.',
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: false
        };
      }

      const previewContext = await dataStore.getApprovedQuotePreviewContext(
        input.quotePublicId,
        input.approvedVersionNumber
      );
      const previewMapboxUrl = previewContext
        ? buildApprovedQuotePreviewMapboxUrl({
            approvedGeometry: previewContext.approvedGeometry,
            addedGeometry: previewContext.addedGeometry,
            removedGeometry: previewContext.removedGeometry,
            mapboxAccessToken: approvedQuotePreviewMapboxAccessToken
          })
        : null;

      if (!previewContext || !previewMapboxUrl) {
        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'failed',
          provider: 'resend',
          errorMessage: !previewContext
            ? 'Approved quote email map requires saved client and approved polygon sources.'
            : 'Approved quote email map is too complex for Mapbox Static Images.',
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: false
        };
      }

      const template = buildApprovedQuoteEmail({
        quoteId: context.publicQuoteId,
        recipientName: context.recipientName,
        addressText: context.addressText,
        serviceFrequency: context.serviceFrequency,
        sessionsMin: context.sessionsMin,
        sessionsMax: context.sessionsMax,
        perSessionTotal: context.perSessionTotal,
        seasonalDiscountedTotal: context.seasonalDiscountedTotal,
        fullSeasonTotal: context.fullSeasonTotal,
        seasonalSavingsTotal: context.seasonalSavingsTotal,
        seasonalDiscountRate: context.seasonalDiscountRate,
        paymentPageUrl,
        previewImageUrl
      });

      try {
        const sent = await approvedQuoteEmailSender.send({
          ...template,
          to: recipientEmail
        });

        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'sent',
          provider: sent.provider,
          providerMessageId: sent.messageId ?? undefined,
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: true
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send approved quote email.';
        const recorded = await dataStore.recordApprovedQuoteEmailDelivery({
          quotePublicId: input.quotePublicId,
          approvedVersionNumber: input.approvedVersionNumber,
          recipientEmail,
          triggerSource: input.triggerSource,
          deliveryStatus: 'failed',
          provider: 'resend',
          errorMessage: message,
          publicPreviewToken: previewToken,
          actor: input.actor
        });

        return {
          ...recorded,
          previewImageUrl,
          paymentPageUrl,
          sent: false
        };
      }
    } catch (error) {
      console.error('Approved quote email workflow failed after quote approval:', error);
      return {
        deliveryStatus: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : 'Unable to prepare approved quote email.',
        sent: false,
        previewImageUrl: null,
        paymentPageUrl: null
      };
    }
  };

  const applyCors = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const origin = req.headers.origin;

    if (origin && (allowedOrigins.has(origin) || isLoopbackOrigin(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin && allowedOrigins.size > 0) {
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
        const distanceToNearestStationKm = getDistanceToNearestStationKm(point, baseStations);

        json(res, 200, {
          inServiceArea,
          distanceToNearestStationKm,
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
          json(res, 400, { error: 'Invalid quote payload.', details: parsedDraft.error.flatten() });
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
          billingMode: payload.billingMode ?? 'seasonal',
          baseTotal: payload.baseTotal ?? payload.quoteTotal,
          finalTotal: payload.quoteTotal,
          attribution: payload.attribution,
          authUserId: customerIdentity?.userId
        });

        if (customerIdentity) {
          void customerAddressRecorder({
            userId: customerIdentity.userId,
            addressText: payload.address
          }).catch((error) => {
            console.warn('Failed to update customer address metadata from quote draft:', error);
          });
        }

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
        assertCustomerPhoneProfile(customerIdentity);

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
          phone: customerIdentity.phone,
          message: parsed.data.message,
          attribution: parsed.data.attribution
        });

        void dataStore
          .getQuoteByPublicId(quoteContactId, {
            authUserId: customerIdentity.userId,
            isAdmin: false
          })
          .then((quote) => {
            if (!quote) {
              return;
            }

            return customerAddressRecorder({
              userId: customerIdentity.userId,
              addressText: quote.address
            });
          })
          .catch((error) => {
            console.warn('Failed to update customer address metadata from quote finalize:', error);
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
        assertCustomerPhoneProfile(customerIdentity);

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
        assertCustomerPhoneProfile(customerIdentity);

        const quote = await dataStore.getQuoteByPublicId(accountQuoteId, {
          authUserId: customerIdentity.userId,
          isAdmin: false
        }, {
          paymentPageUrl: buildPaymentPageUrl(req, accountQuoteId),
          previewImageBaseUrl: buildPreviewImageBaseUrl(req)
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
        }, {
          paymentPageUrl: buildPaymentPageUrl(req, quoteId),
          previewImageBaseUrl: buildPreviewImageBaseUrl(req)
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

    const approvedQuotePreviewToken = getPathMatch(pathname, /^\/api\/approved-quote-preview\/([^/]+)$/);
    if (method === 'GET' && approvedQuotePreviewToken) {
      try {
        const preview = await dataStore.getApprovedQuotePreviewByToken(approvedQuotePreviewToken);
        if (!preview) {
          json(res, 404, { error: 'Approved quote preview not found.' });
          return;
        }

        const mapboxUrl = buildApprovedQuotePreviewMapboxUrl({
          approvedGeometry: preview.approvedGeometry,
          addedGeometry: preview.addedGeometry,
          removedGeometry: preview.removedGeometry,
          mapboxAccessToken: approvedQuotePreviewMapboxAccessToken
        });

        if (!mapboxUrl) {
          json(res, 502, { error: 'Approved quote preview map is not configured or is too complex to render.' });
          return;
        }

        const upstream = await approvedQuotePreviewFetch(mapboxUrl);
        if (!upstream.ok) {
          json(res, 502, { error: 'Approved quote preview map could not be rendered.' });
          return;
        }

        const body = Buffer.from(await upstream.arrayBuffer());
        res.statusCode = 200;
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Length', body.byteLength);
        res.end(body);
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
            serviceFrequency: serviceFrequency === 'weekly' ? 'weekly' : undefined,
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
            role: identity.role,
            paymentPageUrl: buildPaymentPageUrl(req, adminQuoteEditorId) ?? undefined
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
              activePolygonId: parsed.data.polygonSource.activePolygonId ?? null,
              polygons: parsed.data.polygonSource.polygons.map((polygon) => ({
                ...polygon,
                rawStrokePoints: polygon.rawStrokePoints ?? null
              }))
            },
            serviceFrequency: parsed.data.serviceFrequency ?? 'weekly',
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

          const approvedQuoteEmail = await deliverApprovedQuoteEmail({
            req,
            quotePublicId,
            approvedVersionNumber: versionNumber,
            triggerSource: 'approval',
            actor
          });

          json(res, 200, {
            ...result,
            approvedQuoteEmail
          });
          return;
        }

        const adminQuoteApprovalEmailResendId = getPathMatch(
          pathname,
          /^\/api\/admin\/quotes\/([^/]+)\/approval-email\/resend$/
        );
        if (method === 'POST' && adminQuoteApprovalEmailResendId) {
          if (!canMutateQuotes) {
            json(res, 403, { error: 'Forbidden.' });
            return;
          }

          const editor = await dataStore.getQuoteEditor({
            quotePublicId: adminQuoteApprovalEmailResendId,
            role: identity.role,
            paymentPageUrl: buildPaymentPageUrl(req, adminQuoteApprovalEmailResendId) ?? undefined
          });

          if (editor.status !== 'verified' || editor.customerStatus !== 'awaiting_payment') {
            json(res, 409, { error: 'Approved quote email can only be resent for verified quotes awaiting payment.' });
            return;
          }

          const latestDelivery = await dataStore.getLatestApprovedQuoteEmailDelivery(adminQuoteApprovalEmailResendId);
          const approvedVersionNumber = latestDelivery?.approvedVersionNumber ?? editor.versions[0]?.versionNumber ?? 1;
          const approvedQuoteEmail = await deliverApprovedQuoteEmail({
            req,
            quotePublicId: adminQuoteApprovalEmailResendId,
            approvedVersionNumber,
            triggerSource: 'manual_resend',
            actor
          });

          json(res, 200, {
            ok: true,
            quoteId: adminQuoteApprovalEmailResendId,
            approvedQuoteEmail
          });
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
