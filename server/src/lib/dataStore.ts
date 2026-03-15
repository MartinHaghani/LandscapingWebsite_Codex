import { nanoid } from 'nanoid';
import type { QuoteStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import difference from '@turf/difference';
import { featureCollection, polygon } from '@turf/helpers';
import kinks from '@turf/kinks';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { validateAndMeasureGeometry } from './geometry.js';
import { hashJson } from './hash.js';
import {
  computeSessionRangePricing,
  normalizeServiceFrequency,
  type ServiceFrequency
} from './pricing.js';
import { getPrisma } from './prisma.js';
import type { BaseStationConfig } from './serviceAreaConfig.js';
import type { QuoteGeometry } from '../types.js';

export type AdminRole = 'OWNER' | 'ADMIN' | 'REVIEWER' | 'MARKETING';

export interface AttributionInput {
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

interface ActorContext {
  userId: string;
  role: AdminRole | 'SYSTEM';
  requestId?: string;
  correlationId?: string;
  ipHash?: string;
  userAgent?: string;
}

interface QuoteDraftInput {
  idempotencyKey: string;
  authUserId?: string;
  addressText: string;
  location: {
    lat: number;
    lng: number;
  };
  polygon: QuoteGeometry;
  polygonSourceJson?: unknown;
  recommendedPlan: string;
  pricingVersion: string;
  currency: string;
  serviceFrequency: ServiceFrequency;
  baseTotal: number;
  finalTotal: number;
  attribution?: AttributionInput;
}

type PolygonKind = 'service' | 'obstacle';

interface PolygonSourcePolygon {
  id: string;
  kind: PolygonKind;
  points: [number, number][];
}

interface PolygonSourcePayload {
  schemaVersion: 1;
  polygons: PolygonSourcePolygon[];
  activePolygonId: string | null;
}

interface QuoteContactInput {
  idempotencyKey: string;
  quotePublicId: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string;
  message?: string;
  attribution?: AttributionInput;
}

interface ContactFormInput {
  idempotencyKey: string;
  name: string;
  email: string;
  phone?: string;
  addressText?: string;
  message: string;
  attribution?: AttributionInput;
}

interface ServiceAreaRequestInput {
  idempotencyKey: string;
  addressText: string;
  lat: number;
  lng: number;
  source: 'out_of_area_page' | 'coverage_checker' | 'instant_quote' | 'contact_form';
  isInServiceAreaAtCapture: boolean;
}

interface QuotePublicRecord {
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

interface QuoteAccessContext {
  authUserId?: string;
  isAdmin?: boolean;
}

interface ListAccountQuotesInput {
  authUserId: string;
  limit: number;
  cursor?: string;
}

interface ListQuotesInput {
  limit: number;
  cursor?: string;
  q?: string;
  status?: string;
  serviceFrequency?: ServiceFrequency;
  contactPending?: boolean;
  createdFrom?: string;
  createdTo?: string;
  submittedFrom?: string;
  submittedTo?: string;
  sortBy?: 'createdAt' | 'submittedAt' | 'perSessionTotal' | 'seasonalTotalMax';
  sortDir?: 'asc' | 'desc';
  role: AdminRole;
}

interface ListServiceAreaRequestsInput {
  limit: number;
  cursor?: string;
  q?: string;
  source?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'distanceToNearestStationM';
  sortDir?: 'asc' | 'desc';
  role: AdminRole;
}

interface ListServiceAreaRequestMapInput {
  q?: string;
  source?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  bbox?: [number, number, number, number];
  role: AdminRole;
}

interface ListContactsInput {
  limit: number;
  cursor?: string;
  q?: string;
  channel?: 'quote_finalize' | 'contact_form';
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortDir?: 'asc' | 'desc';
  role: AdminRole;
}

interface ListLeadsInput {
  limit: number;
  cursor?: string;
  q?: string;
  consentMarketing?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'firstSeenAt' | 'lastSeenAt';
  sortDir?: 'asc' | 'desc';
  role: AdminRole;
}

interface ListAuditLogsInput {
  limit: number;
  cursor?: string;
  q?: string;
  actorRole?: AdminRole | 'SYSTEM';
  entityType?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'action';
  sortDir?: 'asc' | 'desc';
}

interface AttributionSummaryInput {
  launchAt?: Date;
}

interface UpdateQuoteStatusInput {
  quotePublicId: string;
  nextStatus: QuoteStatus;
  actor: ActorContext;
}

interface AddQuoteNoteInput {
  quotePublicId: string;
  note: string;
  actor: ActorContext;
}

interface ReviseQuoteInput {
  quotePublicId: string;
  perSessionTotal: number;
  finalTotal?: number;
  overrideAmount?: number;
  overrideReason?: string;
  actor: ActorContext;
}

interface GetQuoteEditorInput {
  quotePublicId: string;
  role: AdminRole;
}

interface CreateQuoteVersionInput {
  quotePublicId: string;
  polygonSource: PolygonSourcePayload;
  serviceFrequency: ServiceFrequency;
  perSessionTotal: number;
  finalTotal: number;
  overrideReason?: string;
  actor: ActorContext;
}

interface SubmitQuoteVersionInput {
  quotePublicId: string;
  versionNumber: number;
  actor: ActorContext;
}

interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  meta: {
    generatedAt: string;
    rowCount: number;
    filters: Record<string, string | number | null | undefined>;
  };
}

interface IdempotentResult<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

type IdempotencyScope = 'quote_draft' | 'quote_contact' | 'service_area_request' | 'contact_submit';

interface MemoryLead {
  id: string;
  primaryName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  consentMarketing: boolean;
  externalIds: Record<string, unknown> | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

interface MemoryQuote {
  id: string;
  publicQuoteId: string;
  leadId: string;
  authUserId: string | null;
  addressText: string;
  location: {
    lat: number;
    lng: number;
  };
  locationSource: 'address_geocode' | 'polygon_centroid_fallback';
  polygon: QuoteGeometry;
  polygonSourceJson: unknown | null;
  polygonCentroid: {
    lat: number;
    lng: number;
  } | null;
  areaM2: number;
  perimeterM: number;
  recommendedPlan: string;
  pricingVersion: string;
  currency: string;
  serviceFrequency: ServiceFrequency;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  baseTotal: number;
  finalTotal: number;
  overrideAmount: number | null;
  overrideReason: string | null;
  status: QuoteStatus;
  customerStatus: 'pending' | 'updated' | 'verified' | 'awaiting_payment' | 'rejected';
  contactPending: boolean;
  assignedTo: string | null;
  teamId: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryQuoteVersion {
  id: string;
  quoteId: string;
  versionNumber: number;
  changeType: 'initial' | 'admin_revision' | 'pricing_override' | 'verification';
  actorType: 'client' | 'admin';
  polygon: QuoteGeometry;
  polygonSourceJson: unknown | null;
  polygonCentroid: {
    lat: number;
    lng: number;
  } | null;
  areaM2: number;
  perimeterM: number;
  recommendedPlan: string;
  serviceFrequency: ServiceFrequency;
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  baseTotal: number;
  finalTotal: number;
  overrideAmount: number | null;
  overrideReason: string | null;
  changedBy: string;
  changedAt: string;
}

interface MemoryLeadContact {
  id: string;
  leadId: string;
  channel: 'quote_finalize' | 'contact_form';
  name: string | null;
  email: string | null;
  phone: string | null;
  addressText: string | null;
  message: string | null;
  createdAt: string;
}

interface MemoryServiceAreaRequest {
  id: string;
  leadId: string | null;
  addressText: string;
  lat: number;
  lng: number;
  isInServiceAreaAtCapture: boolean;
  distanceToNearestStationM: number;
  source: 'out_of_area_page' | 'coverage_checker' | 'instant_quote' | 'contact_form';
  status: 'open' | 'reviewed' | 'planned' | 'rejected';
  idempotencyKey: string;
  createdAt: string;
}

interface MemoryAttributionTouch {
  id: string;
  leadId: string | null;
  quoteId: string | null;
  touchType: 'first_touch' | 'last_touch' | 'session_touch' | 'submit_snapshot';
  attribution: AttributionInput;
  createdAt: string;
}

interface MemoryQuoteNote {
  id: string;
  quoteId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

interface MemoryAuditLog {
  id: string;
  actorUserId: string | null;
  actorRole: AdminRole | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  changedFields: string[];
  beforeRedacted: unknown;
  afterRedacted: unknown;
  beforeFull: unknown;
  afterFull: unknown;
  requestId: string | null;
  correlationId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface MemoryIdempotencyRecord {
  id: string;
  scope: IdempotencyScope;
  idempotencyKey: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
  responseHash: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
}

const METRIC_DRIFT_TOLERANCE = 0.03;
const BASE_FEE = 49;
const AREA_RATE = 0.085;
const PERIMETER_RATE = 0.38;
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

const getDistanceToNearestStationM = (point: [number, number], stations: BaseStationConfig[]) => {
  if (stations.length === 0) {
    return 0;
  }

  let nearest = Infinity;

  stations.forEach((station) => {
    if (station.active === false) {
      return;
    }

    const distance = haversineDistanceM(point, [station.lng, station.lat]);
    nearest = Math.min(nearest, distance);
  });

  return Number.isFinite(nearest) ? nearest : 0;
};

const firstCharacter = (value: string) => value.trim().charAt(0);

const maskEmail = (value: string | null) => {
  if (!value) {
    return null;
  }

  const [local, domain] = value.split('@');
  if (!local || !domain) {
    return '***';
  }

  return `${firstCharacter(local)}***@${firstCharacter(domain)}***`;
};

const maskPhone = (value: string | null) => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) {
    return '***';
  }

  return `***-***-${digits.slice(-4)}`;
};

const maskName = (value: string | null) => {
  if (!value) {
    return null;
  }

  return `${firstCharacter(value)}***`;
};

const maskAddress = (value: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length <= 8) {
    return '***';
  }

  return `${normalized.slice(0, 8)}***`;
};

const hasAnyAttributionValue = (attribution?: AttributionInput) => {
  if (!attribution) {
    return false;
  }

  return Object.values(attribution).some((value) => typeof value === 'string' && value.trim().length > 0);
};

const toMultiPolygonGeometry = (geometry: QuoteGeometry): QuoteGeometry => {
  if (geometry.type === 'MultiPolygon') {
    return geometry;
  }

  return {
    type: 'MultiPolygon',
    coordinates: [geometry.coordinates]
  };
};

const getCentroidFromGeometry = (geometry: QuoteGeometry): { lat: number; lng: number } | null => {
  const points: Array<[number, number]> = [];

  const pushRing = (ring: Array<[number, number]>) => {
    ring.forEach((point) => {
      points.push(point);
    });
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => pushRing(ring));
  } else {
    geometry.coordinates.forEach((polygonCoordinates) => {
      polygonCoordinates.forEach((ring) => pushRing(ring));
    });
  }

  if (points.length === 0) {
    return null;
  }

  const sum = points.reduce(
    (accumulator, [lng, lat]) => {
      accumulator.lng += lng;
      accumulator.lat += lat;
      return accumulator;
    },
    { lng: 0, lat: 0 }
  );

  return {
    lng: sum.lng / points.length,
    lat: sum.lat / points.length
  };
};

const isValidLngLat = (lng: number, lat: number) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90;

const swapCoordinateOrder = (point: [number, number]): [number, number] | null => {
  const [lng, lat] = point;
  const swappedLng = lat;
  const swappedLat = lng;
  if (!isValidLngLat(swappedLng, swappedLat)) {
    return null;
  }

  return [swappedLng, swappedLat];
};

const swapQuoteGeometryPointOrder = (geometry: QuoteGeometry): QuoteGeometry | null => {
  if (geometry.type === 'Polygon') {
    const swappedRings: [number, number][][] = [];
    for (const ring of geometry.coordinates) {
      const swappedRing: [number, number][] = [];
      for (const point of ring) {
        const swapped = swapCoordinateOrder(point as [number, number]);
        if (!swapped) {
          return null;
        }
        swappedRing.push(swapped);
      }
      swappedRings.push(swappedRing);
    }
    return {
      type: 'Polygon',
      coordinates: swappedRings
    };
  }

  const swappedPolygons: [number, number][][][] = [];
  for (const polygonCoordinates of geometry.coordinates) {
    const swappedRings: [number, number][][] = [];
    for (const ring of polygonCoordinates) {
      const swappedRing: [number, number][] = [];
      for (const point of ring) {
        const swapped = swapCoordinateOrder(point as [number, number]);
        if (!swapped) {
          return null;
        }
        swappedRing.push(swapped);
      }
      swappedRings.push(swappedRing);
    }
    swappedPolygons.push(swappedRings);
  }

  return {
    type: 'MultiPolygon',
    coordinates: swappedPolygons
  };
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const getRecommendedPlanFromArea = (areaM2: number) => {
  if (areaM2 < 450) {
    return 'Starter Autonomy Plan';
  }

  if (areaM2 < 1200) {
    return 'Precision Weekly Plan';
  }

  return 'Estate Coverage Plan';
};

const computeCalculatedPerSessionTotal = (areaM2: number, perimeterM: number) =>
  roundMoney(BASE_FEE + areaM2 * AREA_RATE + perimeterM * PERIMETER_RATE);

const closePolygonRing = (points: [number, number][]) => {
  if (points.length < 3) {
    return [...points];
  }

  const [firstLng, firstLat] = points[0];
  const [lastLng, lastLat] = points[points.length - 1];

  if (firstLng === lastLng && firstLat === lastLat) {
    return [...points];
  }

  return [...points, points[0]];
};

const toOpenRing = (ring: [number, number][]) => {
  if (ring.length < 2) {
    return [...ring];
  }

  const [firstLng, firstLat] = ring[0];
  const [lastLng, lastLat] = ring[ring.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) {
    return ring.slice(0, -1);
  }

  return [...ring];
};

const hasThreeDistinctPoints = (points: [number, number][]) =>
  new Set(points.map((point) => point.join(','))).size >= 3;

const clonePolygonSource = (source: PolygonSourcePayload): PolygonSourcePayload => ({
  schemaVersion: 1,
  activePolygonId: source.activePolygonId,
  polygons: source.polygons.map((polygonSource) => ({
    id: polygonSource.id,
    kind: polygonSource.kind,
    points: polygonSource.points.map(([lng, lat]) => [lng, lat] as [number, number])
  }))
});

const normalizePolygonSource = (payload: unknown): PolygonSourcePayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    schemaVersion?: unknown;
    polygons?: unknown;
    activePolygonId?: unknown;
  };

  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.polygons) || candidate.polygons.length === 0) {
    return null;
  }

  const polygons: PolygonSourcePolygon[] = [];
  for (const rawPolygon of candidate.polygons) {
    if (!rawPolygon || typeof rawPolygon !== 'object') {
      return null;
    }

    const parsed = rawPolygon as {
      id?: unknown;
      kind?: unknown;
      points?: unknown;
    };

    if (typeof parsed.id !== 'string' || parsed.id.trim().length === 0) {
      return null;
    }

    if (parsed.kind !== 'service' && parsed.kind !== 'obstacle') {
      return null;
    }

    if (!Array.isArray(parsed.points) || parsed.points.length < 3) {
      return null;
    }

    const points: [number, number][] = [];
    for (const point of parsed.points) {
      if (!Array.isArray(point) || point.length !== 2) {
        return null;
      }

      const [lng, lat] = point;
      if (
        typeof lng !== 'number' ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180 ||
        typeof lat !== 'number' ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90
      ) {
        return null;
      }

      points.push([lng, lat]);
    }

    polygons.push({
      id: parsed.id.trim(),
      kind: parsed.kind,
      points
    });
  }

  const activePolygonId =
    candidate.activePolygonId === null || typeof candidate.activePolygonId === 'string'
      ? candidate.activePolygonId
      : null;

  return {
    schemaVersion: 1,
    activePolygonId,
    polygons
  };
};

const mergePolygons = (features: Feature<Polygon>[]): Feature<Polygon | MultiPolygon> | null => {
  if (features.length === 0) {
    return null;
  }

  let merged: Feature<Polygon | MultiPolygon> = features[0];

  for (let index = 1; index < features.length; index += 1) {
    const next = union(featureCollection([merged, features[index]]));
    if (!next) {
      return null;
    }

    merged = next;
  }

  return merged;
};

const polygonSourceToEffectiveGeometry = (source: PolygonSourcePayload): QuoteGeometry => {
  const serviceFeatures: Feature<Polygon>[] = [];
  const obstacleFeatures: Feature<Polygon>[] = [];

  for (const polygonSource of source.polygons) {
    if (polygonSource.points.length < 3 || !hasThreeDistinctPoints(polygonSource.points)) {
      throw new Error('Polygon source includes an invalid polygon.');
    }

    const feature = polygon([closePolygonRing(polygonSource.points)]);
    if (kinks(feature).features.length > 0) {
      throw new Error('Polygon source includes a self-intersecting polygon.');
    }

    if (polygonSource.kind === 'service') {
      serviceFeatures.push(feature);
    } else {
      obstacleFeatures.push(feature);
    }
  }

  if (serviceFeatures.length === 0) {
    throw new Error('At least one service polygon is required.');
  }

  const serviceUnion = mergePolygons(serviceFeatures);
  if (!serviceUnion) {
    throw new Error('Unable to merge service polygons.');
  }

  const obstacleUnion = mergePolygons(obstacleFeatures);
  const effective = obstacleUnion
    ? difference(featureCollection([serviceUnion, obstacleUnion]))
    : serviceUnion;

  if (!effective) {
    throw new Error('Obstacles remove the entire service area.');
  }

  const geometry = effective.geometry as Polygon | MultiPolygon;
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates as [number, number][][]
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates as [number, number][][][]
  };
};

const centroidDistanceM = (
  left: { lng: number; lat: number },
  right: { lng: number; lat: number }
) => {
  return haversineDistanceM([left.lng, left.lat], [right.lng, right.lat]);
};

const resolveEditorGeometryForLocation = (
  geometry: QuoteGeometry,
  location: { lat: number; lng: number } | null
): QuoteGeometry => {
  if (!location || !isValidLngLat(location.lng, location.lat)) {
    return geometry;
  }

  const sourceCentroid = getCentroidFromGeometry(geometry);
  if (!sourceCentroid) {
    return geometry;
  }

  const sourceDistanceM = centroidDistanceM(sourceCentroid, location);
  if (!Number.isFinite(sourceDistanceM) || sourceDistanceM <= 500_000) {
    return geometry;
  }

  const swapped = swapQuoteGeometryPointOrder(geometry);
  if (!swapped) {
    return geometry;
  }

  try {
    const swappedMeasured = validateAndMeasureGeometry(swapped);
    const swappedCentroid = getCentroidFromGeometry(swappedMeasured.normalizedGeometry);
    if (!swappedCentroid) {
      return geometry;
    }

    const swappedDistanceM = centroidDistanceM(swappedCentroid, location);
    if (
      Number.isFinite(swappedDistanceM) &&
      swappedDistanceM < 250_000 &&
      swappedDistanceM + 50_000 < sourceDistanceM
    ) {
      return swappedMeasured.normalizedGeometry;
    }
  } catch {
    return geometry;
  }

  return geometry;
};

const isPolygonSourceConsistentWithGeometry = (
  source: PolygonSourcePayload,
  geometry: QuoteGeometry
) => {
  try {
    const sourceGeometry = polygonSourceToEffectiveGeometry(source);
    const sourceMeasured = validateAndMeasureGeometry(sourceGeometry);
    const targetMeasured = validateAndMeasureGeometry(geometry);
    const areaDelta = Math.abs(sourceMeasured.areaM2 - targetMeasured.areaM2);
    const perimeterDelta = Math.abs(sourceMeasured.perimeterM - targetMeasured.perimeterM);
    const maxAreaDelta = Math.max(1, targetMeasured.areaM2 * 0.01);
    const maxPerimeterDelta = Math.max(1, targetMeasured.perimeterM * 0.01);

    if (areaDelta > maxAreaDelta || perimeterDelta > maxPerimeterDelta) {
      return false;
    }

    const sourceCentroid = getCentroidFromGeometry(sourceMeasured.normalizedGeometry);
    const targetCentroid = getCentroidFromGeometry(targetMeasured.normalizedGeometry);
    if (!sourceCentroid || !targetCentroid) {
      return false;
    }

    return centroidDistanceM(sourceCentroid, targetCentroid) <= 250;
  } catch {
    return false;
  }
};

const swapPointOrder = (point: [number, number]): [number, number] | null => {
  const [lng, lat] = point;
  const swappedLng = lat;
  const swappedLat = lng;
  if (
    !Number.isFinite(swappedLng) ||
    swappedLng < -180 ||
    swappedLng > 180 ||
    !Number.isFinite(swappedLat) ||
    swappedLat < -90 ||
    swappedLat > 90
  ) {
    return null;
  }

  return [swappedLng, swappedLat];
};

const trySwapPolygonSourcePointOrder = (source: PolygonSourcePayload): PolygonSourcePayload | null => {
  const polygons: PolygonSourcePolygon[] = [];

  for (const polygon of source.polygons) {
    const points: [number, number][] = [];
    for (const point of polygon.points) {
      const swapped = swapPointOrder(point);
      if (!swapped) {
        return null;
      }
      points.push(swapped);
    }

    polygons.push({
      id: polygon.id,
      kind: polygon.kind,
      points
    });
  }

  return {
    schemaVersion: 1,
    activePolygonId: source.activePolygonId,
    polygons
  };
};

const derivePolygonSourceFromGeometry = (geometry: QuoteGeometry): PolygonSourcePayload => {
  const polygons: PolygonSourcePolygon[] =
    geometry.type === 'Polygon'
      ? [
          {
            id: 'derived-service-1',
            kind: 'service',
            points: toOpenRing(geometry.coordinates[0] as [number, number][])
          }
        ]
      : geometry.coordinates.map((polygonCoordinates, index) => ({
          id: `derived-service-${index + 1}`,
          kind: 'service' as const,
          points: toOpenRing(polygonCoordinates[0] as [number, number][])
        }));

  return {
    schemaVersion: 1,
    activePolygonId: polygons[0]?.id ?? null,
    polygons
  };
};

const resolvePolygonSourceForEditor = (
  polygonSourceJson: unknown,
  geometry: QuoteGeometry
): { polygonSource: PolygonSourcePayload; fallbackUsed: boolean } => {
  const parsed = normalizePolygonSource(polygonSourceJson);
  if (parsed && isPolygonSourceConsistentWithGeometry(parsed, geometry)) {
    return {
      polygonSource: clonePolygonSource(parsed),
      fallbackUsed: false
    };
  }

  if (parsed) {
    const swapped = trySwapPolygonSourcePointOrder(parsed);
    if (swapped && isPolygonSourceConsistentWithGeometry(swapped, geometry)) {
      return {
        polygonSource: clonePolygonSource(swapped),
        fallbackUsed: true
      };
    }
  }

  return {
    polygonSource: derivePolygonSourceFromGeometry(geometry),
    fallbackUsed: true
  };
};

const encodeCursor = (createdAt: string, id: string) =>
  Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');

const decodeCursor = (cursor?: string) => {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [createdAt, id] = decoded.split('|');
    if (!createdAt || !id) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
};

const assertAllowedTransition = (current: QuoteStatus, next: QuoteStatus) => {
  if (current === next) {
    return;
  }

  const allowedByState: Record<QuoteStatus, QuoteStatus[]> = {
    draft: ['submitted'],
    submitted: ['in_review'],
    in_review: ['verified', 'rejected'],
    verified: [],
    rejected: []
  };

  const allowed = allowedByState[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Illegal quote status transition: ${current} -> ${next}`);
  }
};

const parseDecimal = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  return 0;
};

const parseQuoteGeometryJson = (value: string | null): QuoteGeometry | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      type?: unknown;
      coordinates?: unknown;
    };

    if (
      parsed.type === 'Polygon' &&
      Array.isArray(parsed.coordinates)
    ) {
      return {
        type: 'Polygon',
        coordinates: parsed.coordinates as [number, number][][]
      };
    }

    if (
      parsed.type === 'MultiPolygon' &&
      Array.isArray(parsed.coordinates)
    ) {
      return {
        type: 'MultiPolygon',
        coordinates: parsed.coordinates as [number, number][][][]
      };
    }
  } catch {
    return null;
  }

  return null;
};

const parsePointGeoJson = (value: string | null): { lat: number; lng: number } | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      type?: unknown;
      coordinates?: unknown;
    };

    if (!parsed || parsed.type !== 'Point' || !Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
      return null;
    }

    const [lng, lat] = parsed.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || !isValidLngLat(lng, lat)) {
      return null;
    }

    return { lng, lat };
  } catch {
    return null;
  }
};

const parseDateBound = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return date;
};

const includesText = (value: string | null | undefined, query: string) =>
  (value ?? '').toLowerCase().includes(query.toLowerCase());

const compareText = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '');

const compareNumber = (left: number, right: number) => left - right;

const cleanAttribution = (attribution?: AttributionInput): AttributionInput => ({
  gclid: attribution?.gclid?.trim(),
  gbraid: attribution?.gbraid?.trim(),
  wbraid: attribution?.wbraid?.trim(),
  utmSource: attribution?.utmSource?.trim(),
  utmMedium: attribution?.utmMedium?.trim(),
  utmCampaign: attribution?.utmCampaign?.trim(),
  utmTerm: attribution?.utmTerm?.trim(),
  utmContent: attribution?.utmContent?.trim(),
  landingPath: attribution?.landingPath?.trim(),
  referrer: attribution?.referrer?.trim(),
  deviceType: attribution?.deviceType?.trim(),
  browser: attribution?.browser?.trim(),
  geoCity: attribution?.geoCity?.trim()
});

const nowIso = () => new Date().toISOString();

export class DataStore {
  private readonly prisma = getPrisma();

  private readonly memory = {
    leads: new Map<string, MemoryLead>(),
    quotes: new Map<string, MemoryQuote>(),
    quoteVersions: [] as MemoryQuoteVersion[],
    contacts: [] as MemoryLeadContact[],
    requests: [] as MemoryServiceAreaRequest[],
    attributionTouches: [] as MemoryAttributionTouch[],
    quoteNotes: [] as MemoryQuoteNote[],
    auditLogs: [] as MemoryAuditLog[],
    idempotency: new Map<string, MemoryIdempotencyRecord>()
  };

  constructor(private readonly baseStations: BaseStationConfig[]) {}

  async initialize() {
    if (!this.prisma) {
      return;
    }

    const activeStations = this.baseStations.filter((station) => station.active !== false);

    for (const station of activeStations) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "base_stations" (
            "id",
            "internal_label",
            "internal_address",
            "location_geog",
            "active",
            "created_at",
            "updated_at"
          )
          VALUES (
            ${nanoid(14)},
            ${station.label},
            ${station.address},
            ST_SetSRID(ST_MakePoint(${station.lng}, ${station.lat}), 4326)::geography,
            true,
            now(),
            now()
          )
          ON CONFLICT ("internal_label")
          DO UPDATE SET
            "internal_address" = EXCLUDED."internal_address",
            "location_geog" = EXCLUDED."location_geog",
            "active" = true,
            "updated_at" = now()
        `
      );
    }
  }

  private memoryKey(scope: IdempotencyScope, key: string) {
    return `${scope}:${key}`;
  }

  private async withMemoryIdempotency<T>(
    scope: IdempotencyScope,
    idempotencyKey: string,
    requestBody: unknown,
    action: () => Promise<{ statusCode: number; body: T; resourceType?: string; resourceId?: string }>
  ): Promise<IdempotentResult<T>> {
    const requestHash = hashJson(requestBody);
    const key = this.memoryKey(scope, idempotencyKey);
    const existing = this.memory.idempotency.get(key);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      return {
        statusCode: existing.statusCode,
        body: existing.responseBody as T,
        replayed: true
      };
    }

    const result = await action();
    const record: MemoryIdempotencyRecord = {
      id: nanoid(14),
      scope,
      idempotencyKey,
      requestHash,
      statusCode: result.statusCode,
      responseBody: result.body,
      responseHash: hashJson(result.body),
      resourceType: result.resourceType ?? null,
      resourceId: result.resourceId ?? null,
      createdAt: nowIso()
    };

    this.memory.idempotency.set(key, record);

    return {
      statusCode: result.statusCode,
      body: result.body,
      replayed: false
    };
  }

  private async withDbIdempotency<T>(
    scope: IdempotencyScope,
    idempotencyKey: string,
    requestBody: unknown,
    action: () => Promise<{ statusCode: number; body: T; resourceType?: string; resourceId?: string }>
  ): Promise<IdempotentResult<T>> {
    if (!this.prisma) {
      return this.withMemoryIdempotency(scope, idempotencyKey, requestBody, action);
    }

    const requestHash = hashJson(requestBody);

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_idempotencyKey: {
          scope,
          idempotencyKey
        }
      }
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      return {
        statusCode: existing.statusCode,
        body: existing.responseJson as T,
        replayed: true
      };
    }

    const result = await action();

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          id: nanoid(14),
          scope,
          idempotencyKey,
          requestHash,
          statusCode: result.statusCode,
          responseJson: result.body as Prisma.InputJsonValue,
          responseHash: hashJson(result.body),
          resourceType: result.resourceType,
          resourceId: result.resourceId
        }
      });

      return {
        statusCode: result.statusCode,
        body: result.body,
        replayed: false
      };
    } catch {
      const raceWinner = await this.prisma.idempotencyRecord.findUnique({
        where: {
          scope_idempotencyKey: {
            scope,
            idempotencyKey
          }
        }
      });

      if (!raceWinner) {
        throw new Error('Failed to persist idempotency record.');
      }

      if (raceWinner.requestHash !== requestHash) {
        throw new Error('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      return {
        statusCode: raceWinner.statusCode,
        body: raceWinner.responseJson as T,
        replayed: true
      };
    }
  }

  private async writeAuditLog(params: {
    actor: ActorContext;
    action: string;
    entityType: string;
    entityId: string;
    changedFields?: string[];
    beforeRedacted?: unknown;
    afterRedacted?: unknown;
    beforeFull?: unknown;
    afterFull?: unknown;
  }) {
    if (!this.prisma) {
      this.memory.auditLogs.push({
        id: nanoid(14),
        actorUserId: params.actor.userId,
        actorRole: params.actor.role,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changedFields: params.changedFields ?? [],
        beforeRedacted: params.beforeRedacted ?? null,
        afterRedacted: params.afterRedacted ?? null,
        beforeFull: params.beforeFull ?? null,
        afterFull: params.afterFull ?? null,
        requestId: params.actor.requestId ?? null,
        correlationId: params.actor.correlationId ?? null,
        ipHash: params.actor.ipHash ?? null,
        userAgent: params.actor.userAgent ?? null,
        createdAt: nowIso()
      });
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        id: nanoid(14),
        actorUserId: params.actor.userId,
        actorRole: params.actor.role,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changedFields: params.changedFields ?? [],
        beforeRedacted: (params.beforeRedacted ?? null) as Prisma.InputJsonValue,
        afterRedacted: (params.afterRedacted ?? null) as Prisma.InputJsonValue,
        beforeFull: (params.beforeFull ?? null) as Prisma.InputJsonValue,
        afterFull: (params.afterFull ?? null) as Prisma.InputJsonValue,
        requestId: params.actor.requestId,
        correlationId: params.actor.correlationId,
        ipHash: params.actor.ipHash,
        userAgent: params.actor.userAgent
      }
    });
  }

  private async attachLeadAttribution(
    leadId: string,
    attribution?: AttributionInput,
    quoteId?: string,
    includeSessionTouch = true
  ) {
    const cleaned = cleanAttribution(attribution);
    if (!hasAnyAttributionValue(cleaned)) {
      return;
    }

    if (!this.prisma) {
      const firstTouch = this.memory.attributionTouches.find(
        (item) => item.leadId === leadId && item.touchType === 'first_touch'
      );

      if (!firstTouch) {
        this.memory.attributionTouches.push({
          id: nanoid(14),
          leadId,
          quoteId: null,
          touchType: 'first_touch',
          attribution: cleaned,
          createdAt: nowIso()
        });
      }

      const lastTouch = this.memory.attributionTouches.find(
        (item) => item.leadId === leadId && item.touchType === 'last_touch'
      );

      if (lastTouch) {
        lastTouch.attribution = cleaned;
        lastTouch.createdAt = nowIso();
      } else {
        this.memory.attributionTouches.push({
          id: nanoid(14),
          leadId,
          quoteId: null,
          touchType: 'last_touch',
          attribution: cleaned,
          createdAt: nowIso()
        });
      }

      if (includeSessionTouch) {
        this.memory.attributionTouches.push({
          id: nanoid(14),
          leadId,
          quoteId: quoteId ?? null,
          touchType: 'session_touch',
          attribution: cleaned,
          createdAt: nowIso()
        });
      }

      return;
    }

    const firstTouch = await this.prisma.attributionTouch.findFirst({
      where: {
        leadId,
        touchType: 'first_touch'
      }
    });

    if (!firstTouch) {
      await this.prisma.attributionTouch.create({
        data: {
          id: nanoid(14),
          leadId,
          quoteId: quoteId ?? null,
          touchType: 'first_touch',
          ...cleaned
        }
      });
    }

    const lastTouch = await this.prisma.attributionTouch.findFirst({
      where: {
        leadId,
        touchType: 'last_touch'
      }
    });

    if (lastTouch) {
      await this.prisma.attributionTouch.update({
        where: {
          id: lastTouch.id
        },
        data: {
          quoteId: quoteId ?? null,
          ...cleaned,
          createdAt: new Date()
        }
      });
    } else {
      await this.prisma.attributionTouch.create({
        data: {
          id: nanoid(14),
          leadId,
          quoteId: quoteId ?? null,
          touchType: 'last_touch',
          ...cleaned
        }
      });
    }

    if (includeSessionTouch) {
      await this.prisma.attributionTouch.create({
        data: {
          id: nanoid(14),
          leadId,
          quoteId: quoteId ?? null,
          touchType: 'session_touch',
          ...cleaned
        }
      });
    }
  }

  async createQuoteDraft(input: QuoteDraftInput) {
    return this.withDbIdempotency(
      'quote_draft',
      input.idempotencyKey,
      {
        addressText: input.addressText,
        location: input.location,
        polygon: input.polygon,
        polygonSourceJson: input.polygonSourceJson ?? null,
        recommendedPlan: input.recommendedPlan,
        pricingVersion: input.pricingVersion,
        currency: input.currency,
        serviceFrequency: input.serviceFrequency,
        baseTotal: input.baseTotal,
        finalTotal: input.finalTotal,
        attribution: cleanAttribution(input.attribution)
      },
      async () => {
        const measured = validateAndMeasureGeometry(input.polygon);

        const normalized = toMultiPolygonGeometry(measured.normalizedGeometry);
        const centroid = getCentroidFromGeometry(normalized);
        const sessionPricing = computeSessionRangePricing(input.finalTotal, input.serviceFrequency);

        if (!this.prisma) {
          const leadId = nanoid(14);
          const quoteId = nanoid(14);
          const publicQuoteId = `Q-${nanoid(8).toUpperCase()}`;
          const now = nowIso();

          this.memory.leads.set(leadId, {
            id: leadId,
            primaryName: null,
            primaryEmail: null,
            primaryPhone: null,
            consentMarketing: false,
            externalIds: null,
            firstSeenAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now
          });

          this.memory.quotes.set(quoteId, {
            id: quoteId,
            publicQuoteId,
            leadId,
            authUserId: input.authUserId ?? null,
            addressText: input.addressText,
            location: input.location,
            locationSource: 'address_geocode',
            polygon: normalized,
            polygonSourceJson: input.polygonSourceJson ?? null,
            polygonCentroid: centroid,
            areaM2: measured.areaM2,
            perimeterM: measured.perimeterM,
            recommendedPlan: input.recommendedPlan,
            pricingVersion: input.pricingVersion,
            currency: input.currency,
            serviceFrequency: sessionPricing.serviceFrequency,
            sessionsMin: sessionPricing.sessionsMin,
            sessionsMax: sessionPricing.sessionsMax,
            perSessionTotal: sessionPricing.perSessionTotal,
            seasonalTotalMin: sessionPricing.seasonalTotalMin,
            seasonalTotalMax: sessionPricing.seasonalTotalMax,
            baseTotal: input.baseTotal,
            finalTotal: sessionPricing.perSessionTotal,
            overrideAmount: null,
            overrideReason: null,
            status: 'draft',
            customerStatus: 'pending',
            contactPending: true,
            assignedTo: null,
            teamId: null,
            submittedAt: null,
            verifiedAt: null,
            verifiedBy: null,
            createdAt: now,
            updatedAt: now
          });

          this.memory.quoteVersions.push({
            id: nanoid(14),
            quoteId,
            versionNumber: 1,
            changeType: 'initial',
            actorType: 'client',
            polygon: normalized,
            polygonSourceJson: input.polygonSourceJson ?? null,
            polygonCentroid: centroid,
            areaM2: measured.areaM2,
            perimeterM: measured.perimeterM,
            recommendedPlan: input.recommendedPlan,
            serviceFrequency: sessionPricing.serviceFrequency,
            sessionsMin: sessionPricing.sessionsMin,
            sessionsMax: sessionPricing.sessionsMax,
            perSessionTotal: sessionPricing.perSessionTotal,
            seasonalTotalMin: sessionPricing.seasonalTotalMin,
            seasonalTotalMax: sessionPricing.seasonalTotalMax,
            baseTotal: input.baseTotal,
            finalTotal: sessionPricing.perSessionTotal,
            overrideAmount: null,
            overrideReason: null,
            changedBy: 'system',
            changedAt: now
          });

          await this.attachLeadAttribution(leadId, input.attribution, quoteId);

          await this.writeAuditLog({
            actor: {
              userId: 'system',
              role: 'SYSTEM'
            },
            action: 'quote.draft_created',
            entityType: 'quote',
            entityId: quoteId,
            changedFields: ['status', 'contact_pending', 'area_m2', 'perimeter_m'],
            afterRedacted: {
              quoteId: publicQuoteId,
              status: 'draft',
              contactPending: true
            }
          });

          return {
            statusCode: 201,
            body: {
              quoteId: publicQuoteId,
              status: 'draft',
              contactPending: true,
              nextStepUrl: `/quote-contact/${publicQuoteId}`
            },
            resourceType: 'quote',
            resourceId: quoteId
          };
        }

        const leadId = nanoid(14);
        const quoteId = nanoid(14);
        const publicQuoteId = `Q-${nanoid(8).toUpperCase()}`;
        const polygonGeoJson = JSON.stringify(normalized);

        await this.prisma.$transaction(async (tx) => {
          await tx.lead.create({
            data: {
              id: leadId,
              firstSeenAt: new Date(),
              lastSeenAt: new Date()
            }
          });

          const dbMetrics = await tx.$queryRaw<
            Array<{ is_valid: boolean; area_m2: number; perimeter_m: number; centroid_json: string | null }>
          >(
            Prisma.sql`
              WITH geom_input AS (
                SELECT ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326)::geometry(MultiPolygon,4326) AS geom
              )
              SELECT
                ST_IsValid(geom) AS is_valid,
                ST_Area(geom::geography)::float8 AS area_m2,
                ST_Perimeter(geom::geography)::float8 AS perimeter_m,
                ST_AsGeoJSON(ST_Centroid(geom)) AS centroid_json
              FROM geom_input;
            `
          );

          const measuredDb = dbMetrics[0];
          if (!measuredDb || !measuredDb.is_valid) {
            throw new Error('Polygon geometry is invalid.');
          }

          const areaDrift = Math.abs(measuredDb.area_m2 - measured.areaM2) / measuredDb.area_m2;
          const perimeterDrift = Math.abs(measuredDb.perimeter_m - measured.perimeterM) / measuredDb.perimeter_m;

          if (areaDrift > METRIC_DRIFT_TOLERANCE || perimeterDrift > METRIC_DRIFT_TOLERANCE) {
            throw new Error('Submitted geometry metrics differ from server measurement.');
          }

          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "quotes" (
                "id",
                "public_quote_id",
                "lead_id",
                "auth_user_id",
                "address_text",
                "location_geog",
                "location_source",
                "polygon_geom",
                "polygon_source_json",
                "polygon_centroid_geog",
                "area_m2",
                "perimeter_m",
                "recommended_plan",
                "pricing_version",
                "currency",
                "service_frequency",
                "sessions_min",
                "sessions_max",
                "per_session_total",
                "seasonal_total_min",
                "seasonal_total_max",
                "base_total",
                "final_total",
                "status",
                "customer_status",
                "contact_pending",
                "created_at",
                "updated_at"
              )
              VALUES (
                ${quoteId},
                ${publicQuoteId},
                ${leadId},
                ${input.authUserId ?? null},
                ${input.addressText},
                ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography,
                'address_geocode'::"LocationSource",
                ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326)::geometry(MultiPolygon,4326),
                ${JSON.stringify(input.polygonSourceJson ?? null)}::jsonb,
                ST_Centroid(ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326))::geography,
                ${measuredDb.area_m2},
                ${measuredDb.perimeter_m},
                ${input.recommendedPlan},
                ${input.pricingVersion},
                ${input.currency},
                ${sessionPricing.serviceFrequency}::"ServiceFrequency",
                ${sessionPricing.sessionsMin},
                ${sessionPricing.sessionsMax},
                ${sessionPricing.perSessionTotal},
                ${sessionPricing.seasonalTotalMin},
                ${sessionPricing.seasonalTotalMax},
                ${input.baseTotal},
                ${sessionPricing.perSessionTotal},
                'draft'::"QuoteStatus",
                'pending'::"CustomerStatus",
                true,
                now(),
                now()
              )
            `
          );

          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "quote_versions" (
                "id",
                "quote_id",
                "version_number",
                "change_type",
                "actor_type",
                "polygon_geom",
                "polygon_source_json",
                "polygon_centroid_geog",
                "area_m2",
                "perimeter_m",
                "recommended_plan",
                "service_frequency",
                "sessions_min",
                "sessions_max",
                "per_session_total",
                "seasonal_total_min",
                "seasonal_total_max",
                "base_total",
                "final_total",
                "changed_by",
                "changed_at"
              )
              VALUES (
                ${nanoid(14)},
                ${quoteId},
                1,
                'initial'::"QuoteVersionChangeType",
                'client'::"QuoteVersionActorType",
                ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326)::geometry(MultiPolygon,4326),
                ${JSON.stringify(input.polygonSourceJson ?? null)}::jsonb,
                ST_Centroid(ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326))::geography,
                ${measuredDb.area_m2},
                ${measuredDb.perimeter_m},
                ${input.recommendedPlan},
                ${sessionPricing.serviceFrequency}::"ServiceFrequency",
                ${sessionPricing.sessionsMin},
                ${sessionPricing.sessionsMax},
                ${sessionPricing.perSessionTotal},
                ${sessionPricing.seasonalTotalMin},
                ${sessionPricing.seasonalTotalMax},
                ${input.baseTotal},
                ${sessionPricing.perSessionTotal},
                'system',
                now()
              )
            `
          );
        });

        await this.attachLeadAttribution(leadId, input.attribution, quoteId);

        await this.writeAuditLog({
          actor: {
            userId: 'system',
            role: 'SYSTEM'
          },
          action: 'quote.draft_created',
          entityType: 'quote',
          entityId: quoteId,
          changedFields: ['status', 'contact_pending', 'area_m2', 'perimeter_m'],
          afterRedacted: {
            quoteId: publicQuoteId,
            status: 'draft',
            contactPending: true
          }
        });

        return {
          statusCode: 201,
          body: {
            quoteId: publicQuoteId,
            status: 'draft',
            contactPending: true,
            nextStepUrl: `/quote-contact/${publicQuoteId}`
          },
          resourceType: 'quote',
          resourceId: quoteId
        };
      }
    );
  }

  async finalizeQuoteContact(input: QuoteContactInput) {
    return this.withDbIdempotency(
      'quote_contact',
      input.idempotencyKey,
      {
        quotePublicId: input.quotePublicId,
        authUserId: input.authUserId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        message: input.message,
        attribution: cleanAttribution(input.attribution)
      },
      async () => {
        if (!this.prisma) {
          const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
          if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
          }

          const lead = this.memory.leads.get(quote.leadId);
          if (!lead) {
            throw new Error('LEAD_NOT_FOUND');
          }

          if (quote.status !== 'draft' && quote.status !== 'submitted') {
            throw new Error('QUOTE_CONTACT_FINALIZE_NOT_ALLOWED');
          }

          if (quote.authUserId && quote.authUserId !== input.authUserId) {
            throw new Error('QUOTE_FORBIDDEN');
          }
          quote.authUserId = input.authUserId;

          lead.primaryName = input.name;
          lead.primaryEmail = input.email;
          lead.primaryPhone = input.phone;
          lead.lastSeenAt = nowIso();
          lead.updatedAt = nowIso();

          this.memory.contacts.push({
            id: nanoid(14),
            leadId: lead.id,
            channel: 'quote_finalize',
            name: input.name,
            email: input.email,
            phone: input.phone,
            addressText: quote.addressText,
            message: input.message?.trim() || null,
            createdAt: nowIso()
          });

          quote.status = 'in_review';
          quote.contactPending = false;
          quote.customerStatus = 'pending';
          quote.submittedAt = nowIso();
          quote.updatedAt = nowIso();

          await this.attachLeadAttribution(lead.id, input.attribution, quote.id);

          const lastTouch = this.memory.attributionTouches
            .filter((item) => item.leadId === lead.id && item.touchType === 'last_touch')
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

          const alreadySnapshot = this.memory.attributionTouches.some(
            (item) => item.quoteId === quote.id && item.touchType === 'submit_snapshot'
          );

          if (!alreadySnapshot) {
            this.memory.attributionTouches.push({
              id: nanoid(14),
              leadId: lead.id,
              quoteId: quote.id,
              touchType: 'submit_snapshot',
              attribution: lastTouch?.attribution ?? cleanAttribution(input.attribution),
              createdAt: nowIso()
            });
          }

          await this.writeAuditLog({
            actor: {
              userId: 'system',
              role: 'SYSTEM'
            },
            action: 'quote.contact_finalized',
            entityType: 'quote',
            entityId: quote.id,
            changedFields: ['status', 'contact_pending', 'submitted_at'],
            afterRedacted: {
              quoteId: quote.publicQuoteId,
              status: quote.status,
              contactPending: quote.contactPending
            }
          });

          return {
            statusCode: 200,
            body: {
              ok: true,
              quoteId: quote.publicQuoteId,
              status: quote.status,
              submittedAt: quote.submittedAt
            },
            resourceType: 'quote',
            resourceId: quote.id
          };
        }

        const quote = await this.prisma.quote.findUnique({
          where: {
            publicQuoteId: input.quotePublicId
          }
        });

        if (!quote) {
          throw new Error('QUOTE_NOT_FOUND');
        }

        if (quote.status !== 'draft' && quote.status !== 'submitted') {
          throw new Error('QUOTE_CONTACT_FINALIZE_NOT_ALLOWED');
        }

        if (quote.authUserId && quote.authUserId !== input.authUserId) {
          throw new Error('QUOTE_FORBIDDEN');
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.lead.update({
            where: {
              id: quote.leadId
            },
            data: {
              primaryName: input.name,
              primaryEmail: input.email,
              primaryPhone: input.phone,
              lastSeenAt: new Date()
            }
          });

          await tx.leadContact.create({
            data: {
              id: nanoid(14),
              leadId: quote.leadId,
              channel: 'quote_finalize',
              name: input.name,
              email: input.email,
              phone: input.phone,
              addressText: quote.addressText,
              message: input.message?.trim() || null
            }
          });

          await tx.quote.update({
            where: {
              id: quote.id
            },
            data: {
              status: 'in_review',
              contactPending: false,
              customerStatus: 'pending',
              submittedAt: new Date(),
              authUserId: input.authUserId
            }
          });
        });

        await this.attachLeadAttribution(quote.leadId, input.attribution, quote.id);

        const snapshotAlreadyExists = await this.prisma.attributionTouch.findFirst({
          where: {
            quoteId: quote.id,
            touchType: 'submit_snapshot'
          }
        });

        if (!snapshotAlreadyExists) {
          const latestLastTouch = await this.prisma.attributionTouch.findFirst({
            where: {
              leadId: quote.leadId,
              touchType: 'last_touch'
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          await this.prisma.attributionTouch.create({
            data: {
              id: nanoid(14),
              leadId: quote.leadId,
              quoteId: quote.id,
              touchType: 'submit_snapshot',
              gclid: latestLastTouch?.gclid,
              gbraid: latestLastTouch?.gbraid,
              wbraid: latestLastTouch?.wbraid,
              utmSource: latestLastTouch?.utmSource,
              utmMedium: latestLastTouch?.utmMedium,
              utmCampaign: latestLastTouch?.utmCampaign,
              utmTerm: latestLastTouch?.utmTerm,
              utmContent: latestLastTouch?.utmContent,
              landingPath: latestLastTouch?.landingPath,
              referrer: latestLastTouch?.referrer,
              deviceType: latestLastTouch?.deviceType,
              browser: latestLastTouch?.browser,
              geoCity: latestLastTouch?.geoCity
            }
          });
        }

        await this.writeAuditLog({
          actor: {
            userId: 'system',
            role: 'SYSTEM'
          },
          action: 'quote.contact_finalized',
          entityType: 'quote',
          entityId: quote.id,
          changedFields: ['status', 'contact_pending', 'submitted_at'],
          afterRedacted: {
            quoteId: quote.publicQuoteId,
            status: 'in_review',
            contactPending: false
          }
        });

        return {
          statusCode: 200,
          body: {
            ok: true,
            quoteId: quote.publicQuoteId,
            status: 'in_review',
            submittedAt: nowIso()
          },
          resourceType: 'quote',
          resourceId: quote.id
        };
      }
    );
  }

  async submitContactForm(input: ContactFormInput) {
    return this.withDbIdempotency(
      'contact_submit',
      input.idempotencyKey,
      {
        name: input.name,
        email: input.email,
        phone: input.phone,
        addressText: input.addressText,
        message: input.message,
        attribution: cleanAttribution(input.attribution)
      },
      async () => {
        if (!this.prisma) {
          const now = nowIso();
          const existingLead = [...this.memory.leads.values()].find(
            (lead) => lead.primaryEmail?.toLowerCase() === input.email.toLowerCase()
          );

          const lead =
            existingLead ??
            (() => {
              const created: MemoryLead = {
                id: nanoid(14),
                primaryName: input.name,
                primaryEmail: input.email,
                primaryPhone: input.phone?.trim() || null,
                consentMarketing: false,
                externalIds: null,
                firstSeenAt: now,
                lastSeenAt: now,
                createdAt: now,
                updatedAt: now
              };
              this.memory.leads.set(created.id, created);
              return created;
            })();

          lead.primaryName = input.name;
          lead.primaryEmail = input.email;
          lead.primaryPhone = input.phone?.trim() || lead.primaryPhone;
          lead.lastSeenAt = now;
          lead.updatedAt = now;

          const contactId = nanoid(14);
          this.memory.contacts.push({
            id: contactId,
            leadId: lead.id,
            channel: 'contact_form',
            name: input.name,
            email: input.email,
            phone: input.phone?.trim() || null,
            addressText: input.addressText?.trim() || null,
            message: input.message.trim(),
            createdAt: now
          });

          await this.attachLeadAttribution(lead.id, input.attribution, undefined);

          await this.writeAuditLog({
            actor: {
              userId: 'system',
              role: 'SYSTEM'
            },
            action: 'contact.submitted',
            entityType: 'lead_contact',
            entityId: contactId,
            changedFields: ['channel', 'email'],
            afterRedacted: {
              leadId: lead.id,
              email: maskEmail(input.email)
            }
          });

          return {
            statusCode: 201,
            body: {
              ok: true,
              id: contactId
            },
            resourceType: 'lead_contact',
            resourceId: contactId
          };
        }

        const now = new Date();

        const existingLead = await this.prisma.lead.findFirst({
          where: {
            primaryEmail: input.email
          }
        });

        const leadId = existingLead?.id ?? nanoid(14);

        if (existingLead) {
          await this.prisma.lead.update({
            where: {
              id: existingLead.id
            },
            data: {
              primaryName: input.name,
              primaryPhone: input.phone?.trim() || existingLead.primaryPhone,
              lastSeenAt: now
            }
          });
        } else {
          await this.prisma.lead.create({
            data: {
              id: leadId,
              primaryName: input.name,
              primaryEmail: input.email,
              primaryPhone: input.phone?.trim() || null,
              firstSeenAt: now,
              lastSeenAt: now
            }
          });
        }

        const contactId = nanoid(14);
        await this.prisma.leadContact.create({
          data: {
            id: contactId,
            leadId,
            channel: 'contact_form',
            name: input.name,
            email: input.email,
            phone: input.phone?.trim() || null,
            addressText: input.addressText?.trim() || null,
            message: input.message.trim()
          }
        });

        await this.attachLeadAttribution(leadId, input.attribution, undefined);

        await this.writeAuditLog({
          actor: {
            userId: 'system',
            role: 'SYSTEM'
          },
          action: 'contact.submitted',
          entityType: 'lead_contact',
          entityId: contactId,
          changedFields: ['channel', 'email'],
          afterRedacted: {
            leadId,
            email: maskEmail(input.email)
          }
        });

        return {
          statusCode: 201,
          body: {
            ok: true,
            id: contactId
          },
          resourceType: 'lead_contact',
          resourceId: contactId
        };
      }
    );
  }

  async createServiceAreaRequest(input: ServiceAreaRequestInput) {
    return this.withDbIdempotency(
      'service_area_request',
      input.idempotencyKey,
      {
        addressText: input.addressText,
        lat: input.lat,
        lng: input.lng,
        source: input.source,
        isInServiceAreaAtCapture: input.isInServiceAreaAtCapture
      },
      async () => {
        const distance = getDistanceToNearestStationM([input.lng, input.lat], this.baseStations);

        if (!this.prisma) {
          const id = nanoid(14);
          this.memory.requests.push({
            id,
            leadId: null,
            addressText: input.addressText,
            lat: input.lat,
            lng: input.lng,
            isInServiceAreaAtCapture: input.isInServiceAreaAtCapture,
            distanceToNearestStationM: distance,
            source: input.source,
            status: 'open',
            idempotencyKey: input.idempotencyKey,
            createdAt: nowIso()
          });

          await this.writeAuditLog({
            actor: {
              userId: 'system',
              role: 'SYSTEM'
            },
            action: 'service_area.request_created',
            entityType: 'service_area_request',
            entityId: id,
            changedFields: ['source', 'is_in_service_area_at_capture'],
            afterRedacted: {
              source: input.source,
              inServiceArea: input.isInServiceAreaAtCapture
            }
          });

          return {
            statusCode: 201,
            body: {
              ok: true,
              id,
              distanceToNearestStationM: distance
            },
            resourceType: 'service_area_request',
            resourceId: id
          };
        }

        const id = nanoid(14);
        await this.prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO "service_area_requests" (
              "id",
              "address_text",
              "location_geog",
              "is_in_service_area_at_capture",
              "distance_to_nearest_station_m",
              "source",
              "status",
              "idempotency_key",
              "created_at"
            )
            VALUES (
              ${id},
              ${input.addressText},
              ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
              ${input.isInServiceAreaAtCapture},
              ${distance},
              ${input.source}::"ServiceAreaRequestSource",
              'open'::"ServiceAreaRequestStatus",
              ${input.idempotencyKey},
              now()
            )
          `
        );

        await this.writeAuditLog({
          actor: {
            userId: 'system',
            role: 'SYSTEM'
          },
          action: 'service_area.request_created',
          entityType: 'service_area_request',
          entityId: id,
          changedFields: ['source', 'is_in_service_area_at_capture'],
          afterRedacted: {
            source: input.source,
            inServiceArea: input.isInServiceAreaAtCapture
          }
        });

        return {
          statusCode: 201,
          body: {
            ok: true,
            id,
            distanceToNearestStationM: distance
          },
          resourceType: 'service_area_request',
          resourceId: id
        };
      }
    );
  }

  async claimQuoteOwnership(input: { quotePublicId: string; authUserId: string }) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      if (quote.authUserId && quote.authUserId !== input.authUserId) {
        throw new Error('QUOTE_ALREADY_CLAIMED');
      }

      const claimed = quote.authUserId === null;
      quote.authUserId = input.authUserId;
      quote.updatedAt = nowIso();

      return {
        statusCode: 200,
        body: {
          ok: true,
          quoteId: quote.publicQuoteId,
          claimed
        }
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.authUserId && quote.authUserId !== input.authUserId) {
      throw new Error('QUOTE_ALREADY_CLAIMED');
    }

    const claimed = quote.authUserId === null;
    if (claimed) {
      await this.prisma.quote.update({
        where: {
          id: quote.id
        },
        data: {
          authUserId: input.authUserId
        }
      });
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        quoteId: quote.publicQuoteId,
        claimed
      }
    };
  }

  async getQuoteByPublicId(
    quotePublicId: string,
    access: QuoteAccessContext = {}
  ): Promise<QuotePublicRecord | null> {
    const isAdmin = access.isAdmin === true;
    const authUserId = access.authUserId?.trim();
    if (!isAdmin && !authUserId) {
      throw new Error('AUTH_REQUIRED');
    }

    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === quotePublicId);
      if (!quote) {
        return null;
      }

      if (!isAdmin && quote.authUserId !== authUserId) {
        throw new Error('QUOTE_FORBIDDEN');
      }

      return {
        id: quote.publicQuoteId,
        createdAt: quote.createdAt,
        address: quote.addressText,
        metrics: {
          areaM2: quote.areaM2,
          perimeterM: quote.perimeterM
        },
        plan: quote.recommendedPlan,
        serviceFrequency: quote.serviceFrequency,
        sessionsMin: quote.sessionsMin,
        sessionsMax: quote.sessionsMax,
        perSessionTotal: quote.perSessionTotal,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        quoteTotal: quote.finalTotal,
        status: quote.status,
        contactPending: quote.contactPending,
        submittedAt: quote.submittedAt
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: quotePublicId
      }
    });

    if (!quote) {
      return null;
    }

    if (!isAdmin && quote.authUserId !== authUserId) {
      throw new Error('QUOTE_FORBIDDEN');
    }

    return {
      id: quote.publicQuoteId,
      createdAt: quote.createdAt.toISOString(),
      address: quote.addressText,
      metrics: {
        areaM2: parseDecimal(quote.areaM2),
        perimeterM: parseDecimal(quote.perimeterM)
      },
      plan: quote.recommendedPlan,
      serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
      sessionsMin: quote.sessionsMin,
      sessionsMax: quote.sessionsMax,
      perSessionTotal: parseDecimal(quote.perSessionTotal),
      seasonalTotalMin: parseDecimal(quote.seasonalTotalMin),
      seasonalTotalMax: parseDecimal(quote.seasonalTotalMax),
      quoteTotal: parseDecimal(quote.finalTotal),
      status: quote.status,
      contactPending: quote.contactPending,
      submittedAt: quote.submittedAt ? quote.submittedAt.toISOString() : null
    };
  }

  async listAccountQuotes(input: ListAccountQuotesInput): Promise<PaginatedResponse<Record<string, unknown>>> {
    const cursor = decodeCursor(input.cursor);

    if (!this.prisma) {
      const filtered = [...this.memory.quotes.values()]
        .filter((quote) => quote.authUserId === input.authUserId)
        .sort((left, right) => compareText(right.createdAt, left.createdAt));

      const cursorIndex =
        cursor === null
          ? -1
          : filtered.findIndex((quote) => quote.createdAt === cursor.createdAt && quote.id === cursor.id);
      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = filtered.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit).map((quote) => ({
        id: quote.publicQuoteId,
        createdAt: quote.createdAt,
        address: quote.addressText,
        status: quote.status,
        contactPending: quote.contactPending,
        serviceFrequency: quote.serviceFrequency,
        perSessionTotal: quote.perSessionTotal,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        submittedAt: quote.submittedAt
      }));

      const nextCursor = hasNext
        ? encodeCursor(window[input.limit].createdAt, window[input.limit].id)
        : null;

      return {
        items,
        nextCursor,
        meta: {
          generatedAt: nowIso(),
          rowCount: items.length,
          filters: {
            owner: input.authUserId
          }
        }
      };
    }

    const where: Prisma.QuoteWhereInput = {
      authUserId: input.authUserId
    };
    const cursorCondition =
      cursor !== null
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }
            ]
          }
        : {};

    const rows = await this.prisma.quote.findMany({
      where: {
        AND: [where, cursorCondition]
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1
    });

    const hasNext = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const nextCursor = hasNext
      ? encodeCursor(rows[input.limit].createdAt.toISOString(), rows[input.limit].id)
      : null;

    return {
      items: pageRows.map((row) => ({
        id: row.publicQuoteId,
        createdAt: row.createdAt.toISOString(),
        address: row.addressText,
        status: row.status,
        contactPending: row.contactPending,
        serviceFrequency: normalizeServiceFrequency(row.serviceFrequency),
        perSessionTotal: parseDecimal(row.perSessionTotal),
        seasonalTotalMin: parseDecimal(row.seasonalTotalMin),
        seasonalTotalMax: parseDecimal(row.seasonalTotalMax),
        submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null
      })),
      nextCursor,
      meta: {
        generatedAt: nowIso(),
        rowCount: pageRows.length,
        filters: {
          owner: input.authUserId
        }
      }
    };
  }

  async listQuotes(input: ListQuotesInput): Promise<PaginatedResponse<Record<string, unknown>>> {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const submittedFrom = parseDateBound(input.submittedFrom);
    const submittedTo = parseDateBound(input.submittedTo);
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';
    const cursor = sortBy === 'createdAt' ? decodeCursor(input.cursor) : null;
    const direction = sortDir === 'asc' ? 1 : -1;

    if (!this.prisma) {
      const filtered = [...this.memory.quotes.values()].filter((quote) => {
        if (input.status && quote.status !== input.status) {
          return false;
        }

        if (input.serviceFrequency && quote.serviceFrequency !== input.serviceFrequency) {
          return false;
        }

        if (typeof input.contactPending === 'boolean' && quote.contactPending !== input.contactPending) {
          return false;
        }

        const createdAt = new Date(quote.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }

        if (submittedFrom || submittedTo) {
          if (!quote.submittedAt) {
            return false;
          }

          const submittedAt = new Date(quote.submittedAt);
          if (submittedFrom && submittedAt < submittedFrom) {
            return false;
          }
          if (submittedTo && submittedAt > submittedTo) {
            return false;
          }
        }

        if (query.length > 0) {
          const lead = this.memory.leads.get(quote.leadId);
          const matches =
            includesText(quote.publicQuoteId, query) ||
            includesText(quote.addressText, query) ||
            includesText(lead?.primaryName, query) ||
            includesText(lead?.primaryEmail, query) ||
            includesText(lead?.primaryPhone, query);

          if (!matches) {
            return false;
          }
        }

        return true;
      });

      const sorted = filtered.sort((left, right) => {
        switch (sortBy) {
          case 'submittedAt':
            return direction * compareText(left.submittedAt, right.submittedAt);
          case 'perSessionTotal':
            return direction * compareNumber(left.perSessionTotal, right.perSessionTotal);
          case 'seasonalTotalMax':
            return direction * compareNumber(left.seasonalTotalMax, right.seasonalTotalMax);
          case 'createdAt':
          default:
            return direction * compareText(left.createdAt, right.createdAt);
        }
      });

      const cursorIndex =
        cursor === null
          ? -1
          : sorted.findIndex((quote) => quote.createdAt === cursor.createdAt && quote.id === cursor.id);

      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = sorted.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit);

      const mapped = items.map((quote) => {
        const lead = this.memory.leads.get(quote.leadId);
        const name = input.role === 'MARKETING' ? maskName(lead?.primaryName ?? null) : lead?.primaryName;
        const email = input.role === 'MARKETING' ? maskEmail(lead?.primaryEmail ?? null) : lead?.primaryEmail;
        const phone = input.role === 'MARKETING' ? maskPhone(lead?.primaryPhone ?? null) : lead?.primaryPhone;

        return {
          quoteId: quote.publicQuoteId,
          status: quote.status,
          customerStatus: quote.customerStatus,
          contactPending: quote.contactPending,
          createdAt: quote.createdAt,
          submittedAt: quote.submittedAt,
          addressText: quote.addressText,
          serviceFrequency: quote.serviceFrequency,
          sessionsMin: quote.sessionsMin,
          sessionsMax: quote.sessionsMax,
          perSessionTotal: quote.perSessionTotal,
          seasonalTotalMin: quote.seasonalTotalMin,
          seasonalTotalMax: quote.seasonalTotalMax,
          finalTotal: quote.finalTotal,
          areaM2: quote.areaM2,
          perimeterM: quote.perimeterM,
          lead: {
            id: quote.leadId,
            name,
            email,
            phone
          }
        };
      });

      const nextCursor =
        sortBy === 'createdAt' && hasNext
          ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
          : null;

      return {
        items: mapped,
        nextCursor,
        meta: {
          generatedAt: nowIso(),
          rowCount: mapped.length,
          filters: {
            q: query || null,
            status: input.status ?? null,
            serviceFrequency: input.serviceFrequency ?? null,
            contactPending: typeof input.contactPending === 'boolean' ? String(input.contactPending) : null,
            sortBy,
            sortDir,
            role: input.role
          }
        }
      };
    }

    const whereAnd: Prisma.QuoteWhereInput[] = [];

    if (input.status) {
      whereAnd.push({ status: input.status as QuoteStatus });
    }

    if (input.serviceFrequency) {
      whereAnd.push({ serviceFrequency: input.serviceFrequency });
    }

    if (typeof input.contactPending === 'boolean') {
      whereAnd.push({ contactPending: input.contactPending });
    }

    if (createdFrom || createdTo) {
      whereAnd.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {})
        }
      });
    }

    if (submittedFrom || submittedTo) {
      whereAnd.push({
        submittedAt: {
          ...(submittedFrom ? { gte: submittedFrom } : {}),
          ...(submittedTo ? { lte: submittedTo } : {})
        }
      });
    }

    if (query.length > 0) {
      whereAnd.push({
        OR: [
          { publicQuoteId: { contains: query, mode: 'insensitive' } },
          { addressText: { contains: query, mode: 'insensitive' } },
          { lead: { primaryName: { contains: query, mode: 'insensitive' } } },
          { lead: { primaryEmail: { contains: query, mode: 'insensitive' } } },
          { lead: { primaryPhone: { contains: query, mode: 'insensitive' } } }
        ]
      });
    }

    if (sortBy === 'createdAt' && cursor) {
      whereAnd.push({
        OR: [
          {
            createdAt: {
              [sortDir === 'asc' ? 'gt' : 'lt']: new Date(cursor.createdAt)
            }
          },
          {
            createdAt: new Date(cursor.createdAt),
            id: {
              [sortDir === 'asc' ? 'gt' : 'lt']: cursor.id
            }
          }
        ]
      });
    }

    const where: Prisma.QuoteWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};

    const orderBy: Prisma.QuoteOrderByWithRelationInput[] =
      sortBy === 'submittedAt'
        ? [{ submittedAt: sortDir }, { id: sortDir }]
        : sortBy === 'perSessionTotal'
          ? [{ perSessionTotal: sortDir }, { createdAt: 'desc' }]
          : sortBy === 'seasonalTotalMax'
            ? [{ seasonalTotalMax: sortDir }, { createdAt: 'desc' }]
            : [{ createdAt: sortDir }, { id: sortDir }];

    const rows = await this.prisma.quote.findMany({
      where,
      orderBy,
      take: input.limit + 1,
      include: {
        lead: true
      }
    });

    const hasNext = rows.length > input.limit;
    const window = rows.slice(0, input.limit);

    const mapped = window.map((row) => {
      const name = input.role === 'MARKETING' ? maskName(row.lead.primaryName) : row.lead.primaryName;
      const email = input.role === 'MARKETING' ? maskEmail(row.lead.primaryEmail) : row.lead.primaryEmail;
      const phone = input.role === 'MARKETING' ? maskPhone(row.lead.primaryPhone) : row.lead.primaryPhone;

      return {
        quoteId: row.publicQuoteId,
        status: row.status,
        customerStatus: row.customerStatus,
        contactPending: row.contactPending,
        createdAt: row.createdAt.toISOString(),
        submittedAt: row.submittedAt?.toISOString() ?? null,
        addressText: row.addressText,
        serviceFrequency: normalizeServiceFrequency(row.serviceFrequency),
        sessionsMin: row.sessionsMin,
        sessionsMax: row.sessionsMax,
        perSessionTotal: parseDecimal(row.perSessionTotal),
        seasonalTotalMin: parseDecimal(row.seasonalTotalMin),
        seasonalTotalMax: parseDecimal(row.seasonalTotalMax),
        finalTotal: parseDecimal(row.finalTotal),
        areaM2: parseDecimal(row.areaM2),
        perimeterM: parseDecimal(row.perimeterM),
        lead: {
          id: row.lead.id,
          name,
          email,
          phone
        }
      };
    });

    const nextCursor =
      sortBy === 'createdAt' && hasNext && window.length > 0
        ? encodeCursor(window[window.length - 1].createdAt.toISOString(), window[window.length - 1].id)
        : null;

    return {
      items: mapped,
      nextCursor,
      meta: {
        generatedAt: nowIso(),
        rowCount: mapped.length,
        filters: {
          q: query || null,
          status: input.status ?? null,
          serviceFrequency: input.serviceFrequency ?? null,
          contactPending: typeof input.contactPending === 'boolean' ? String(input.contactPending) : null,
          sortBy,
          sortDir,
          role: input.role
        }
      }
    };
  }

  async listServiceAreaRequests(
    input: ListServiceAreaRequestsInput
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';
    const direction = sortDir === 'asc' ? 1 : -1;
    const cursor = sortBy === 'createdAt' ? decodeCursor(input.cursor) : null;

    if (!this.prisma) {
      const filtered = [...this.memory.requests].filter((request) => {
        if (input.source && request.source !== input.source) {
          return false;
        }

        if (input.status && request.status !== input.status) {
          return false;
        }

        const createdAt = new Date(request.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }

        if (
          query.length > 0 &&
          !includesText(request.id, query) &&
          !includesText(request.addressText, query)
        ) {
          return false;
        }

        return true;
      });

      const sorted = filtered.sort((left, right) => {
        if (sortBy === 'distanceToNearestStationM') {
          return direction * compareNumber(left.distanceToNearestStationM, right.distanceToNearestStationM);
        }

        return direction * compareText(left.createdAt, right.createdAt);
      });

      const cursorIndex =
        cursor === null
          ? -1
          : sorted.findIndex((request) => request.createdAt === cursor.createdAt && request.id === cursor.id);

      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = sorted.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit);

      return {
        items: items.map((request) => ({
          id: request.id,
          addressText:
            input.role === 'MARKETING' ? (maskAddress(request.addressText) ?? '***') : request.addressText,
          source: request.source,
          status: request.status,
          createdAt: request.createdAt,
          distanceToNearestStationM: request.distanceToNearestStationM,
          isInServiceAreaAtCapture: request.isInServiceAreaAtCapture
        })),
        nextCursor:
          sortBy === 'createdAt' && hasNext
            ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
            : null,
        meta: {
          generatedAt: nowIso(),
          rowCount: items.length,
          filters: {
            q: query || null,
            source: input.source ?? null,
            status: input.status ?? null,
            sortBy,
            sortDir,
            role: input.role
          }
        }
      };
    }

    const whereAnd: Prisma.ServiceAreaRequestWhereInput[] = [];

    if (
      input.source === 'out_of_area_page' ||
      input.source === 'coverage_checker' ||
      input.source === 'instant_quote' ||
      input.source === 'contact_form'
    ) {
      whereAnd.push({ source: input.source });
    }

    if (
      input.status === 'open' ||
      input.status === 'reviewed' ||
      input.status === 'planned' ||
      input.status === 'rejected'
    ) {
      whereAnd.push({ status: input.status });
    }

    if (createdFrom || createdTo) {
      whereAnd.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {})
        }
      });
    }

    if (query.length > 0) {
      whereAnd.push({
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { addressText: { contains: query, mode: 'insensitive' } }
        ]
      });
    }

    if (sortBy === 'createdAt' && cursor) {
      whereAnd.push({
        OR: [
          {
            createdAt: {
              [sortDir === 'asc' ? 'gt' : 'lt']: new Date(cursor.createdAt)
            }
          },
          {
            createdAt: new Date(cursor.createdAt),
            id: {
              [sortDir === 'asc' ? 'gt' : 'lt']: cursor.id
            }
          }
        ]
      });
    }

    const where: Prisma.ServiceAreaRequestWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};
    const orderBy: Prisma.ServiceAreaRequestOrderByWithRelationInput[] =
      sortBy === 'distanceToNearestStationM'
        ? [{ distanceToNearestStationM: sortDir }, { createdAt: 'desc' }]
        : [{ createdAt: sortDir }, { id: sortDir }];

    const rows = await this.prisma.serviceAreaRequest.findMany({
      where,
      orderBy,
      take: input.limit + 1
    });

    const hasNext = rows.length > input.limit;
    const window = rows.slice(0, input.limit);

    return {
      items: window.map((row) => ({
        id: row.id,
        addressText: input.role === 'MARKETING' ? (maskAddress(row.addressText) ?? '***') : row.addressText,
        source: row.source,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        distanceToNearestStationM: parseDecimal(row.distanceToNearestStationM),
        isInServiceAreaAtCapture: row.isInServiceAreaAtCapture
      })),
      nextCursor:
        sortBy === 'createdAt' && hasNext && window.length > 0
          ? encodeCursor(window[window.length - 1].createdAt.toISOString(), window[window.length - 1].id)
          : null,
      meta: {
        generatedAt: nowIso(),
        rowCount: window.length,
        filters: {
          q: query || null,
          source: input.source ?? null,
          status: input.status ?? null,
          sortBy,
          sortDir,
          role: input.role
        }
      }
    };
  }

  async listServiceAreaRequestMap(input: ListServiceAreaRequestMapInput) {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const bbox = input.bbox;

    const includeByBbox = (lng: number, lat: number) => {
      if (!bbox) {
        return true;
      }

      const [minLng, minLat, maxLng, maxLat] = bbox;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    };

    const aggregateHotspots = (
      points: Array<{
        id: string;
        addressText: string;
        lat: number;
        lng: number;
        createdAt: string;
        source: string;
        status: string;
      }>
    ) => {
      const hotspots = new Map<
        string,
        {
          id: string;
          lat: number;
          lng: number;
          count: number;
        }
      >();

      points.forEach((point) => {
        const cellLat = Number((Math.round(point.lat * 100) / 100).toFixed(2));
        const cellLng = Number((Math.round(point.lng * 100) / 100).toFixed(2));
        const key = `${cellLng}|${cellLat}`;
        const current = hotspots.get(key) ?? {
          id: key,
          lat: cellLat,
          lng: cellLng,
          count: 0
        };

        current.count += 1;
        hotspots.set(key, current);
      });

      return [...hotspots.values()].sort((left, right) => right.count - left.count);
    };

    if (!this.prisma) {
      const points = this.memory.requests
        .filter((request) => {
          if (input.source && request.source !== input.source) {
            return false;
          }
          if (input.status && request.status !== input.status) {
            return false;
          }
          if (createdFrom && new Date(request.createdAt) < createdFrom) {
            return false;
          }
          if (createdTo && new Date(request.createdAt) > createdTo) {
            return false;
          }
          if (query.length > 0 && !includesText(request.addressText, query) && !includesText(request.id, query)) {
            return false;
          }
          if (!includeByBbox(request.lng, request.lat)) {
            return false;
          }
          return true;
        })
        .map((request) => ({
          id: request.id,
          addressText:
            input.role === 'MARKETING' ? (maskAddress(request.addressText) ?? '***') : request.addressText,
          lat: request.lat,
          lng: request.lng,
          createdAt: request.createdAt,
          source: request.source,
          status: request.status
        }));

      return {
        points,
        hotspots: aggregateHotspots(points),
        meta: {
          generatedAt: nowIso(),
          pointCount: points.length,
          filters: {
            q: query || null,
            source: input.source ?? null,
            status: input.status ?? null
          }
        }
      };
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        address_text: string;
        lat: number;
        lng: number;
        source: string;
        status: string;
        created_at: Date;
      }>
    >(
      Prisma.sql`
        SELECT
          sar."id",
          sar."address_text",
          ST_Y(sar."location_geog"::geometry) AS lat,
          ST_X(sar."location_geog"::geometry) AS lng,
          sar."source"::text AS source,
          sar."status"::text AS status,
          sar."created_at"
        FROM "service_area_requests" sar
        WHERE (${input.source ? Prisma.sql`sar."source" = ${input.source}::"ServiceAreaRequestSource"` : Prisma.sql`true`})
          AND (${input.status ? Prisma.sql`sar."status" = ${input.status}::"ServiceAreaRequestStatus"` : Prisma.sql`true`})
          AND (${createdFrom ? Prisma.sql`sar."created_at" >= ${createdFrom}` : Prisma.sql`true`})
          AND (${createdTo ? Prisma.sql`sar."created_at" <= ${createdTo}` : Prisma.sql`true`})
          AND (${query.length > 0
            ? Prisma.sql`(sar."id" ILIKE ${`%${query}%`} OR sar."address_text" ILIKE ${`%${query}%`})`
            : Prisma.sql`true`})
        ORDER BY sar."created_at" DESC
        LIMIT 5000
      `
    );

    const points = rows
      .filter((row) => includeByBbox(row.lng, row.lat))
      .map((row) => ({
        id: row.id,
        addressText: input.role === 'MARKETING' ? (maskAddress(row.address_text) ?? '***') : row.address_text,
        lat: Number(row.lat),
        lng: Number(row.lng),
        source: row.source,
        status: row.status,
        createdAt: row.created_at.toISOString()
      }));

    return {
      points,
      hotspots: aggregateHotspots(points),
      meta: {
        generatedAt: nowIso(),
        pointCount: points.length,
        filters: {
          q: query || null,
          source: input.source ?? null,
          status: input.status ?? null
        }
      }
    };
  }

  async listLeadContacts(input: ListContactsInput): Promise<PaginatedResponse<Record<string, unknown>>> {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';
    const direction = sortDir === 'asc' ? 1 : -1;
    const cursor = sortBy === 'createdAt' ? decodeCursor(input.cursor) : null;

    if (!this.prisma) {
      const filtered = [...this.memory.contacts].filter((contact) => {
        if (input.channel && contact.channel !== input.channel) {
          return false;
        }

        const createdAt = new Date(contact.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }

        if (
          query.length > 0 &&
          !includesText(contact.name, query) &&
          !includesText(contact.email, query) &&
          !includesText(contact.phone, query) &&
          !includesText(contact.addressText, query) &&
          !includesText(contact.message, query)
        ) {
          return false;
        }

        return true;
      });

      const sorted = filtered.sort((left, right) => {
        switch (sortBy) {
          case 'name':
            return direction * compareText(left.name, right.name);
          case 'email':
            return direction * compareText(left.email, right.email);
          case 'createdAt':
          default:
            return direction * compareText(left.createdAt, right.createdAt);
        }
      });

      const cursorIndex =
        cursor === null
          ? -1
          : sorted.findIndex((contact) => contact.createdAt === cursor.createdAt && contact.id === cursor.id);

      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = sorted.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit);

      return {
        items: items.map((contact) => ({
          id: contact.id,
          channel: contact.channel,
          name: input.role === 'MARKETING' ? maskName(contact.name) : contact.name,
          email: input.role === 'MARKETING' ? maskEmail(contact.email) : contact.email,
          phone: input.role === 'MARKETING' ? maskPhone(contact.phone) : contact.phone,
          addressText: input.role === 'MARKETING' ? maskAddress(contact.addressText) : contact.addressText,
          message: contact.message,
          createdAt: contact.createdAt
        })),
        nextCursor:
          sortBy === 'createdAt' && hasNext
            ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
            : null,
        meta: {
          generatedAt: nowIso(),
          rowCount: items.length,
          filters: {
            q: query || null,
            channel: input.channel ?? null,
            sortBy,
            sortDir,
            role: input.role
          }
        }
      };
    }

    const whereAnd: Prisma.LeadContactWhereInput[] = [];

    if (input.channel) {
      whereAnd.push({ channel: input.channel });
    }

    if (createdFrom || createdTo) {
      whereAnd.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {})
        }
      });
    }

    if (query.length > 0) {
      whereAnd.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { addressText: { contains: query, mode: 'insensitive' } },
          { message: { contains: query, mode: 'insensitive' } }
        ]
      });
    }

    if (sortBy === 'createdAt' && cursor) {
      whereAnd.push({
        OR: [
          {
            createdAt: {
              [sortDir === 'asc' ? 'gt' : 'lt']: new Date(cursor.createdAt)
            }
          },
          {
            createdAt: new Date(cursor.createdAt),
            id: {
              [sortDir === 'asc' ? 'gt' : 'lt']: cursor.id
            }
          }
        ]
      });
    }

    const where: Prisma.LeadContactWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};
    const orderBy: Prisma.LeadContactOrderByWithRelationInput[] =
      sortBy === 'name'
        ? [{ name: sortDir }, { createdAt: 'desc' }]
        : sortBy === 'email'
          ? [{ email: sortDir }, { createdAt: 'desc' }]
          : [{ createdAt: sortDir }, { id: sortDir }];

    const rows = await this.prisma.leadContact.findMany({
      where,
      orderBy,
      take: input.limit + 1
    });

    const hasNext = rows.length > input.limit;
    const window = rows.slice(0, input.limit);

    return {
      items: window.map((row) => ({
        id: row.id,
        channel: row.channel,
        name: input.role === 'MARKETING' ? maskName(row.name) : row.name,
        email: input.role === 'MARKETING' ? maskEmail(row.email) : row.email,
        phone: input.role === 'MARKETING' ? maskPhone(row.phone) : row.phone,
        addressText: input.role === 'MARKETING' ? maskAddress(row.addressText) : row.addressText,
        message: row.message,
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor:
        sortBy === 'createdAt' && hasNext && window.length > 0
          ? encodeCursor(window[window.length - 1].createdAt.toISOString(), window[window.length - 1].id)
          : null,
      meta: {
        generatedAt: nowIso(),
        rowCount: window.length,
        filters: {
          q: query || null,
          channel: input.channel ?? null,
          sortBy,
          sortDir,
          role: input.role
        }
      }
    };
  }

  async listLeads(input: ListLeadsInput): Promise<PaginatedResponse<Record<string, unknown>>> {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';
    const direction = sortDir === 'asc' ? 1 : -1;
    const cursor = sortBy === 'createdAt' ? decodeCursor(input.cursor) : null;

    if (!this.prisma) {
      const filtered = [...this.memory.leads.values()].filter((lead) => {
        if (typeof input.consentMarketing === 'boolean' && lead.consentMarketing !== input.consentMarketing) {
          return false;
        }

        const createdAt = new Date(lead.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }

        if (
          query.length > 0 &&
          !includesText(lead.primaryName, query) &&
          !includesText(lead.primaryEmail, query) &&
          !includesText(lead.primaryPhone, query)
        ) {
          return false;
        }

        return true;
      });

      const sorted = filtered.sort((left, right) => {
        switch (sortBy) {
          case 'firstSeenAt':
            return direction * compareText(left.firstSeenAt, right.firstSeenAt);
          case 'lastSeenAt':
            return direction * compareText(left.lastSeenAt, right.lastSeenAt);
          case 'createdAt':
          default:
            return direction * compareText(left.createdAt, right.createdAt);
        }
      });

      const cursorIndex =
        cursor === null
          ? -1
          : sorted.findIndex((lead) => lead.createdAt === cursor.createdAt && lead.id === cursor.id);

      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = sorted.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit);

      return {
        items: items.map((lead) => ({
          id: lead.id,
          primaryName: input.role === 'MARKETING' ? maskName(lead.primaryName) : lead.primaryName,
          primaryEmail: input.role === 'MARKETING' ? maskEmail(lead.primaryEmail) : lead.primaryEmail,
          primaryPhone: input.role === 'MARKETING' ? maskPhone(lead.primaryPhone) : lead.primaryPhone,
          consentMarketing: lead.consentMarketing,
          firstSeenAt: lead.firstSeenAt,
          lastSeenAt: lead.lastSeenAt,
          createdAt: lead.createdAt
        })),
        nextCursor:
          sortBy === 'createdAt' && hasNext
            ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
            : null,
        meta: {
          generatedAt: nowIso(),
          rowCount: items.length,
          filters: {
            q: query || null,
            consentMarketing:
              typeof input.consentMarketing === 'boolean' ? String(input.consentMarketing) : null,
            sortBy,
            sortDir,
            role: input.role
          }
        }
      };
    }

    const whereAnd: Prisma.LeadWhereInput[] = [];

    if (typeof input.consentMarketing === 'boolean') {
      whereAnd.push({ consentMarketing: input.consentMarketing });
    }

    if (createdFrom || createdTo) {
      whereAnd.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {})
        }
      });
    }

    if (query.length > 0) {
      whereAnd.push({
        OR: [
          { primaryName: { contains: query, mode: 'insensitive' } },
          { primaryEmail: { contains: query, mode: 'insensitive' } },
          { primaryPhone: { contains: query, mode: 'insensitive' } }
        ]
      });
    }

    if (sortBy === 'createdAt' && cursor) {
      whereAnd.push({
        OR: [
          {
            createdAt: {
              [sortDir === 'asc' ? 'gt' : 'lt']: new Date(cursor.createdAt)
            }
          },
          {
            createdAt: new Date(cursor.createdAt),
            id: {
              [sortDir === 'asc' ? 'gt' : 'lt']: cursor.id
            }
          }
        ]
      });
    }

    const where: Prisma.LeadWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};
    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      sortBy === 'firstSeenAt'
        ? [{ firstSeenAt: sortDir }, { createdAt: 'desc' }]
        : sortBy === 'lastSeenAt'
          ? [{ lastSeenAt: sortDir }, { createdAt: 'desc' }]
          : [{ createdAt: sortDir }, { id: sortDir }];

    const rows = await this.prisma.lead.findMany({
      where,
      orderBy,
      take: input.limit + 1
    });

    const hasNext = rows.length > input.limit;
    const window = rows.slice(0, input.limit);

    return {
      items: window.map((row) => ({
        id: row.id,
        primaryName: input.role === 'MARKETING' ? maskName(row.primaryName) : row.primaryName,
        primaryEmail: input.role === 'MARKETING' ? maskEmail(row.primaryEmail) : row.primaryEmail,
        primaryPhone: input.role === 'MARKETING' ? maskPhone(row.primaryPhone) : row.primaryPhone,
        consentMarketing: row.consentMarketing,
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor:
        sortBy === 'createdAt' && hasNext && window.length > 0
          ? encodeCursor(window[window.length - 1].createdAt.toISOString(), window[window.length - 1].id)
          : null,
      meta: {
        generatedAt: nowIso(),
        rowCount: window.length,
        filters: {
          q: query || null,
          consentMarketing: typeof input.consentMarketing === 'boolean' ? String(input.consentMarketing) : null,
          sortBy,
          sortDir,
          role: input.role
        }
      }
    };
  }

  async listAuditLogs(input: ListAuditLogsInput): Promise<PaginatedResponse<Record<string, unknown>>> {
    const query = input.q?.trim() ?? '';
    const createdFrom = parseDateBound(input.createdFrom);
    const createdTo = parseDateBound(input.createdTo);
    const sortBy = input.sortBy ?? 'createdAt';
    const sortDir = input.sortDir ?? 'desc';
    const direction = sortDir === 'asc' ? 1 : -1;
    const cursor = sortBy === 'createdAt' ? decodeCursor(input.cursor) : null;

    if (!this.prisma) {
      const filtered = [...this.memory.auditLogs].filter((row) => {
        if (input.actorRole && row.actorRole !== input.actorRole) {
          return false;
        }

        if (input.entityType && row.entityType !== input.entityType) {
          return false;
        }

        const createdAt = new Date(row.createdAt);
        if (createdFrom && createdAt < createdFrom) {
          return false;
        }
        if (createdTo && createdAt > createdTo) {
          return false;
        }

        if (
          query.length > 0 &&
          !includesText(row.action, query) &&
          !includesText(row.entityType, query) &&
          !includesText(row.entityId, query) &&
          !includesText(row.actorUserId, query)
        ) {
          return false;
        }

        return true;
      });

      const sorted = filtered.sort((left, right) => {
        if (sortBy === 'action') {
          return direction * compareText(left.action, right.action);
        }
        return direction * compareText(left.createdAt, right.createdAt);
      });

      const cursorIndex =
        cursor === null
          ? -1
          : sorted.findIndex((item) => item.createdAt === cursor.createdAt && item.id === cursor.id);

      const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      const window = sorted.slice(startIndex, startIndex + input.limit + 1);
      const hasNext = window.length > input.limit;
      const items = window.slice(0, input.limit);

      return {
        items: items.map((row) => ({
          id: row.id,
          actorUserId: row.actorUserId,
          actorRole: row.actorRole,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          changedFields: row.changedFields,
          beforeRedacted: row.beforeRedacted,
          afterRedacted: row.afterRedacted,
          beforeFull: row.beforeFull,
          afterFull: row.afterFull,
          requestId: row.requestId,
          correlationId: row.correlationId,
          ipHash: row.ipHash,
          userAgent: row.userAgent,
          createdAt: row.createdAt
        })),
        nextCursor:
          sortBy === 'createdAt' && hasNext
            ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
            : null,
        meta: {
          generatedAt: nowIso(),
          rowCount: items.length,
          filters: {
            q: query || null,
            actorRole: input.actorRole ?? null,
            entityType: input.entityType ?? null,
            sortBy,
            sortDir
          }
        }
      };
    }

    const whereAnd: Prisma.AuditLogWhereInput[] = [];

    if (input.actorRole) {
      whereAnd.push({ actorRole: input.actorRole });
    }

    if (input.entityType) {
      whereAnd.push({ entityType: input.entityType });
    }

    if (createdFrom || createdTo) {
      whereAnd.push({
        createdAt: {
          ...(createdFrom ? { gte: createdFrom } : {}),
          ...(createdTo ? { lte: createdTo } : {})
        }
      });
    }

    if (query.length > 0) {
      whereAnd.push({
        OR: [
          { action: { contains: query, mode: 'insensitive' } },
          { entityType: { contains: query, mode: 'insensitive' } },
          { entityId: { contains: query, mode: 'insensitive' } },
          { actorUserId: { contains: query, mode: 'insensitive' } }
        ]
      });
    }

    if (sortBy === 'createdAt' && cursor) {
      whereAnd.push({
        OR: [
          {
            createdAt: {
              [sortDir === 'asc' ? 'gt' : 'lt']: new Date(cursor.createdAt)
            }
          },
          {
            createdAt: new Date(cursor.createdAt),
            id: {
              [sortDir === 'asc' ? 'gt' : 'lt']: cursor.id
            }
          }
        ]
      });
    }

    const where: Prisma.AuditLogWhereInput = whereAnd.length > 0 ? { AND: whereAnd } : {};
    const orderBy: Prisma.AuditLogOrderByWithRelationInput[] =
      sortBy === 'action'
        ? [{ action: sortDir }, { createdAt: 'desc' }]
        : [{ createdAt: sortDir }, { id: sortDir }];

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy,
      take: input.limit + 1
    });

    const hasNext = rows.length > input.limit;
    const window = rows.slice(0, input.limit);

    return {
      items: window.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        changedFields: row.changedFields,
        beforeRedacted: row.beforeRedacted,
        afterRedacted: row.afterRedacted,
        requestId: row.requestId,
        correlationId: row.correlationId,
        ipHash: row.ipHash,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString()
      })),
      nextCursor:
        sortBy === 'createdAt' && hasNext && window.length > 0
          ? encodeCursor(window[window.length - 1].createdAt.toISOString(), window[window.length - 1].id)
          : null,
      meta: {
        generatedAt: nowIso(),
        rowCount: window.length,
        filters: {
          q: query || null,
          actorRole: input.actorRole ?? null,
          entityType: input.entityType ?? null,
          sortBy,
          sortDir
        }
      }
    };
  }

  async addQuoteNote(input: AddQuoteNoteInput) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      const note = {
        id: nanoid(14),
        quoteId: quote.id,
        note: input.note,
        createdBy: input.actor.userId,
        createdAt: nowIso()
      };

      this.memory.quoteNotes.push(note);

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.note_added',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: ['note']
      });

      return note;
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    const note = await this.prisma.quoteNote.create({
      data: {
        id: nanoid(14),
        quoteId: quote.id,
        note: input.note,
        createdBy: input.actor.userId
      }
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.note_added',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: ['note']
    });

    return {
      id: note.id,
      quoteId: quote.publicQuoteId,
      note: note.note,
      createdBy: note.createdBy,
      createdAt: note.createdAt.toISOString()
    };
  }

  async updateQuoteStatus(input: UpdateQuoteStatusInput) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      assertAllowedTransition(quote.status, input.nextStatus);
      const beforeStatus = quote.status;

      quote.status = input.nextStatus;
      quote.updatedAt = nowIso();

      if (input.nextStatus === 'verified') {
        quote.verifiedAt = nowIso();
        quote.verifiedBy = input.actor.userId;
        quote.customerStatus = 'awaiting_payment';
      }

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.status_updated',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: ['status'],
        beforeRedacted: { status: beforeStatus },
        afterRedacted: { status: quote.status }
      });

      return {
        quoteId: quote.publicQuoteId,
        status: quote.status,
        customerStatus: quote.customerStatus,
        verifiedAt: quote.verifiedAt,
        verifiedBy: quote.verifiedBy
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    assertAllowedTransition(quote.status, input.nextStatus);

    const updated = await this.prisma.quote.update({
      where: {
        id: quote.id
      },
      data: {
        status: input.nextStatus,
        customerStatus: input.nextStatus === 'verified' ? 'awaiting_payment' : quote.customerStatus,
        verifiedAt: input.nextStatus === 'verified' ? new Date() : quote.verifiedAt,
        verifiedBy: input.nextStatus === 'verified' ? input.actor.userId : quote.verifiedBy
      }
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.status_updated',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: ['status'],
      beforeRedacted: {
        status: quote.status
      },
      afterRedacted: {
        status: updated.status
      }
    });

    return {
      quoteId: updated.publicQuoteId,
      status: updated.status,
      customerStatus: updated.customerStatus,
      verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      verifiedBy: updated.verifiedBy
    };
  }

  async getQuoteEditor(input: GetQuoteEditorInput) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      const lead = this.memory.leads.get(quote.leadId);
      const editorGeometry = resolveEditorGeometryForLocation(quote.polygon, quote.location);
      const { polygonSource, fallbackUsed } = resolvePolygonSourceForEditor(
        quote.polygonSourceJson,
        editorGeometry
      );
      const calculatedPerSessionTotal = computeCalculatedPerSessionTotal(quote.areaM2, quote.perimeterM);
      const calculatedRange = computeSessionRangePricing(calculatedPerSessionTotal, quote.serviceFrequency);

      const versions = this.memory.quoteVersions
        .filter((version) => version.quoteId === quote.id)
        .sort((left, right) => right.versionNumber - left.versionNumber)
        .map((version) => {
          const versionGeometry = resolveEditorGeometryForLocation(version.polygon, quote.location);
          const versionSource = resolvePolygonSourceForEditor(version.polygonSourceJson, versionGeometry);
          return {
            versionNumber: version.versionNumber,
            actorType: version.actorType,
            changeType: version.changeType,
            changedBy: version.changedBy,
            changedAt: version.changedAt,
            serviceFrequency: version.serviceFrequency,
            sessionsMin: version.sessionsMin,
            sessionsMax: version.sessionsMax,
            perSessionTotal: version.perSessionTotal,
            seasonalTotalMin: version.seasonalTotalMin,
            seasonalTotalMax: version.seasonalTotalMax,
            finalTotal: version.finalTotal,
            overrideReason: version.overrideReason,
            areaM2: version.areaM2,
            perimeterM: version.perimeterM,
            recommendedPlan: version.recommendedPlan,
            polygonSource: versionSource.polygonSource,
            polygonSourceFallback: versionSource.fallbackUsed
          };
        });

      const leadName = input.role === 'MARKETING' ? maskName(lead?.primaryName ?? null) : lead?.primaryName ?? null;
      const leadEmail = input.role === 'MARKETING' ? maskEmail(lead?.primaryEmail ?? null) : lead?.primaryEmail ?? null;
      const leadPhone = input.role === 'MARKETING' ? maskPhone(lead?.primaryPhone ?? null) : lead?.primaryPhone ?? null;

      return {
        quoteId: quote.publicQuoteId,
        status: quote.status,
        customerStatus: quote.customerStatus,
        createdAt: quote.createdAt,
        submittedAt: quote.submittedAt,
        verifiedAt: quote.verifiedAt,
        verifiedBy: quote.verifiedBy,
        addressText: quote.addressText,
        lead: {
          id: quote.leadId,
          name: leadName,
          email: leadEmail,
          phone: leadPhone
        },
        editable: {
          serviceFrequency: quote.serviceFrequency,
          perSessionTotal: quote.perSessionTotal,
          finalTotal: quote.finalTotal,
          overrideReason: quote.overrideReason
        },
        calculated: {
          areaM2: quote.areaM2,
          perimeterM: quote.perimeterM,
          recommendedPlan: quote.recommendedPlan,
          baseTotal: quote.baseTotal,
          perSessionTotal: calculatedPerSessionTotal,
          sessionsMin: calculatedRange.sessionsMin,
          sessionsMax: calculatedRange.sessionsMax,
          seasonalTotalMin: calculatedRange.seasonalTotalMin,
          seasonalTotalMax: calculatedRange.seasonalTotalMax
        },
        polygonSource,
        polygonSourceFallback: fallbackUsed,
        versions
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      },
      include: {
        lead: true,
        versions: {
          orderBy: {
            versionNumber: 'desc'
          }
        }
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    const geometryRow = await this.prisma.$queryRaw<
      Array<{ polygon_geojson: string | null; location_geojson: string | null }>
    >(
      Prisma.sql`
        SELECT ST_AsGeoJSON("polygon_geom") AS polygon_geojson,
               ST_AsGeoJSON(("location_geog"::geometry)) AS location_geojson
        FROM "quotes"
        WHERE "id" = ${quote.id}
      `
    );
    const quoteGeometry = parseQuoteGeometryJson(geometryRow[0]?.polygon_geojson ?? null);
    if (!quoteGeometry) {
      throw new Error('QUOTE_EDITOR_GEOMETRY_INVALID');
    }
    const quoteLocation = parsePointGeoJson(geometryRow[0]?.location_geojson ?? null);
    const editorGeometry = resolveEditorGeometryForLocation(quoteGeometry, quoteLocation);

    const { polygonSource, fallbackUsed } = resolvePolygonSourceForEditor(
      quote.polygonSourceJson,
      editorGeometry
    );
    const areaM2 = parseDecimal(quote.areaM2);
    const perimeterM = parseDecimal(quote.perimeterM);
    const calculatedPerSessionTotal = computeCalculatedPerSessionTotal(areaM2, perimeterM);
    const calculatedRange = computeSessionRangePricing(
      calculatedPerSessionTotal,
      normalizeServiceFrequency(quote.serviceFrequency)
    );

    const versions = quote.versions.map((version) => {
      const parsedVersionSource = normalizePolygonSource(version.polygonSourceJson);
      return {
        versionNumber: version.versionNumber,
        actorType: version.actorType,
        changeType: version.changeType,
        changedBy: version.changedBy,
        changedAt: version.changedAt.toISOString(),
        serviceFrequency: normalizeServiceFrequency(version.serviceFrequency),
        sessionsMin: version.sessionsMin,
        sessionsMax: version.sessionsMax,
        perSessionTotal: parseDecimal(version.perSessionTotal),
        seasonalTotalMin: parseDecimal(version.seasonalTotalMin),
        seasonalTotalMax: parseDecimal(version.seasonalTotalMax),
        finalTotal: parseDecimal(version.finalTotal),
        overrideReason: version.overrideReason,
        areaM2: parseDecimal(version.areaM2),
        perimeterM: parseDecimal(version.perimeterM),
        recommendedPlan: version.recommendedPlan,
        polygonSource: parsedVersionSource ? clonePolygonSource(parsedVersionSource) : null,
        polygonSourceFallback: !parsedVersionSource
      };
    });

    const leadName =
      input.role === 'MARKETING' ? maskName(quote.lead.primaryName) : quote.lead.primaryName;
    const leadEmail =
      input.role === 'MARKETING' ? maskEmail(quote.lead.primaryEmail) : quote.lead.primaryEmail;
    const leadPhone =
      input.role === 'MARKETING' ? maskPhone(quote.lead.primaryPhone) : quote.lead.primaryPhone;

    return {
      quoteId: quote.publicQuoteId,
      status: quote.status,
      customerStatus: quote.customerStatus,
      createdAt: quote.createdAt.toISOString(),
      submittedAt: quote.submittedAt?.toISOString() ?? null,
      verifiedAt: quote.verifiedAt?.toISOString() ?? null,
      verifiedBy: quote.verifiedBy,
      addressText: quote.addressText,
      lead: {
        id: quote.lead.id,
        name: leadName,
        email: leadEmail,
        phone: leadPhone
      },
      editable: {
        serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
        perSessionTotal: parseDecimal(quote.perSessionTotal),
        finalTotal: parseDecimal(quote.finalTotal),
        overrideReason: quote.overrideReason
      },
      calculated: {
        areaM2,
        perimeterM,
        recommendedPlan: quote.recommendedPlan,
        baseTotal: parseDecimal(quote.baseTotal),
        perSessionTotal: calculatedPerSessionTotal,
        sessionsMin: calculatedRange.sessionsMin,
        sessionsMax: calculatedRange.sessionsMax,
        seasonalTotalMin: calculatedRange.seasonalTotalMin,
        seasonalTotalMax: calculatedRange.seasonalTotalMax
      },
      polygonSource,
      polygonSourceFallback: fallbackUsed,
      versions
    };
  }

  async createQuoteVersion(input: CreateQuoteVersionInput) {
    const normalizedSource = normalizePolygonSource(input.polygonSource);
    if (!normalizedSource) {
      throw new Error('QUOTE_EDITOR_SOURCE_INVALID');
    }

    const effectiveGeometry = polygonSourceToEffectiveGeometry(normalizedSource);
    const measured = validateAndMeasureGeometry(effectiveGeometry);
    const normalizedGeometry = toMultiPolygonGeometry(measured.normalizedGeometry);
    const centroid = getCentroidFromGeometry(normalizedGeometry);
    const recommendedPlan = getRecommendedPlanFromArea(measured.areaM2);
    const sessionPricing = computeSessionRangePricing(input.perSessionTotal, input.serviceFrequency);
    const finalTotal = roundMoney(input.finalTotal);
    const calculatedPerSessionTotal = computeCalculatedPerSessionTotal(measured.areaM2, measured.perimeterM);
    const overrideAmount = Math.max(0, roundMoney(calculatedPerSessionTotal - sessionPricing.perSessionTotal));

    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      if (quote.status !== 'in_review') {
        throw new Error('QUOTE_NOT_IN_REVIEW');
      }

      const before = {
        serviceFrequency: quote.serviceFrequency,
        perSessionTotal: quote.perSessionTotal,
        finalTotal: quote.finalTotal,
        areaM2: quote.areaM2,
        perimeterM: quote.perimeterM
      };

      quote.polygon = normalizedGeometry;
      quote.polygonSourceJson = clonePolygonSource(normalizedSource);
      quote.polygonCentroid = centroid;
      quote.areaM2 = measured.areaM2;
      quote.perimeterM = measured.perimeterM;
      quote.recommendedPlan = recommendedPlan;
      quote.serviceFrequency = sessionPricing.serviceFrequency;
      quote.sessionsMin = sessionPricing.sessionsMin;
      quote.sessionsMax = sessionPricing.sessionsMax;
      quote.perSessionTotal = sessionPricing.perSessionTotal;
      quote.seasonalTotalMin = sessionPricing.seasonalTotalMin;
      quote.seasonalTotalMax = sessionPricing.seasonalTotalMax;
      quote.finalTotal = finalTotal;
      quote.overrideAmount = overrideAmount;
      quote.overrideReason = input.overrideReason ?? null;
      quote.customerStatus = 'updated';
      quote.updatedAt = nowIso();

      const latestVersion = this.memory.quoteVersions
        .filter((version) => version.quoteId === quote.id)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
      const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

      this.memory.quoteVersions.push({
        id: nanoid(14),
        quoteId: quote.id,
        versionNumber: nextVersion,
        changeType: 'admin_revision',
        actorType: 'admin',
        polygon: normalizedGeometry,
        polygonSourceJson: clonePolygonSource(normalizedSource),
        polygonCentroid: centroid,
        areaM2: measured.areaM2,
        perimeterM: measured.perimeterM,
        recommendedPlan,
        serviceFrequency: sessionPricing.serviceFrequency,
        sessionsMin: sessionPricing.sessionsMin,
        sessionsMax: sessionPricing.sessionsMax,
        perSessionTotal: sessionPricing.perSessionTotal,
        seasonalTotalMin: sessionPricing.seasonalTotalMin,
        seasonalTotalMax: sessionPricing.seasonalTotalMax,
        baseTotal: quote.baseTotal,
        finalTotal,
        overrideAmount,
        overrideReason: input.overrideReason ?? null,
        changedBy: input.actor.userId,
        changedAt: nowIso()
      });

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.version_created',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: [
          'polygon',
          'service_frequency',
          'per_session_total',
          'final_total',
          'customer_status'
        ],
        beforeRedacted: before,
        afterRedacted: {
          serviceFrequency: quote.serviceFrequency,
          perSessionTotal: quote.perSessionTotal,
          finalTotal: quote.finalTotal,
          areaM2: quote.areaM2,
          perimeterM: quote.perimeterM
        }
      });

      return {
        quoteId: quote.publicQuoteId,
        status: quote.status,
        customerStatus: quote.customerStatus,
        version: nextVersion,
        serviceFrequency: quote.serviceFrequency,
        perSessionTotal: quote.perSessionTotal,
        finalTotal: quote.finalTotal,
        sessionsMin: quote.sessionsMin,
        sessionsMax: quote.sessionsMax,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        areaM2: quote.areaM2,
        perimeterM: quote.perimeterM,
        recommendedPlan: quote.recommendedPlan
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== 'in_review') {
      throw new Error('QUOTE_NOT_IN_REVIEW');
    }

    const polygonGeoJson = JSON.stringify(normalizedGeometry);
    const polygonSourceJson = JSON.stringify(clonePolygonSource(normalizedSource));
    const centroidSql = centroid
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${centroid.lng}, ${centroid.lat}), 4326)::geography`
      : Prisma.sql`NULL`;

    const dbMetrics = await this.prisma.$queryRaw<
      Array<{ is_valid: boolean; area_m2: number; perimeter_m: number }>
    >(
      Prisma.sql`
        WITH geom_input AS (
          SELECT ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326)::geometry(MultiPolygon,4326) AS geom
        )
        SELECT
          ST_IsValid(geom) AS is_valid,
          ST_Area(geom::geography)::float8 AS area_m2,
          ST_Perimeter(geom::geography)::float8 AS perimeter_m
        FROM geom_input;
      `
    );

    const measuredDb = dbMetrics[0];
    if (!measuredDb || !measuredDb.is_valid) {
      throw new Error('Polygon geometry is invalid.');
    }

    const areaDrift = Math.abs(measuredDb.area_m2 - measured.areaM2) / measuredDb.area_m2;
    const perimeterDrift = Math.abs(measuredDb.perimeter_m - measured.perimeterM) / measuredDb.perimeter_m;
    if (areaDrift > METRIC_DRIFT_TOLERANCE || perimeterDrift > METRIC_DRIFT_TOLERANCE) {
      throw new Error('Submitted geometry metrics differ from server measurement.');
    }

    const latestVersion = await this.prisma.quoteVersion.findFirst({
      where: {
        quoteId: quote.id
      },
      orderBy: {
        versionNumber: 'desc'
      }
    });
    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "quotes"
          SET
            "polygon_geom" = ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON(${polygonGeoJson})), 4326)::geometry(MultiPolygon,4326),
            "polygon_source_json" = ${polygonSourceJson}::jsonb,
            "polygon_centroid_geog" = ${centroidSql},
            "area_m2" = ${measuredDb.area_m2},
            "perimeter_m" = ${measuredDb.perimeter_m},
            "recommended_plan" = ${recommendedPlan},
            "service_frequency" = ${sessionPricing.serviceFrequency}::"ServiceFrequency",
            "sessions_min" = ${sessionPricing.sessionsMin},
            "sessions_max" = ${sessionPricing.sessionsMax},
            "per_session_total" = ${sessionPricing.perSessionTotal},
            "seasonal_total_min" = ${sessionPricing.seasonalTotalMin},
            "seasonal_total_max" = ${sessionPricing.seasonalTotalMax},
            "final_total" = ${finalTotal},
            "override_amount" = ${overrideAmount},
            "override_reason" = ${input.overrideReason ?? null},
            "customer_status" = 'updated'::"CustomerStatus",
            "updated_at" = now()
          WHERE "id" = ${quote.id}
        `
      );

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "quote_versions" (
            "id",
            "quote_id",
            "version_number",
            "change_type",
            "actor_type",
            "polygon_geom",
            "polygon_source_json",
            "polygon_centroid_geog",
            "area_m2",
            "perimeter_m",
            "recommended_plan",
            "service_frequency",
            "sessions_min",
            "sessions_max",
            "per_session_total",
            "seasonal_total_min",
            "seasonal_total_max",
            "base_total",
            "final_total",
            "override_amount",
            "override_reason",
            "changed_by",
            "changed_at"
          )
          SELECT
            ${nanoid(14)},
            q."id",
            ${nextVersion},
            'admin_revision'::"QuoteVersionChangeType",
            'admin'::"QuoteVersionActorType",
            q."polygon_geom",
            q."polygon_source_json",
            q."polygon_centroid_geog",
            q."area_m2",
            q."perimeter_m",
            q."recommended_plan",
            q."service_frequency",
            q."sessions_min",
            q."sessions_max",
            q."per_session_total",
            q."seasonal_total_min",
            q."seasonal_total_max",
            q."base_total",
            q."final_total",
            q."override_amount",
            q."override_reason",
            ${input.actor.userId},
            now()
          FROM "quotes" q
          WHERE q."id" = ${quote.id}
        `
      );
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.version_created',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: [
        'polygon',
        'service_frequency',
        'per_session_total',
        'final_total',
        'customer_status'
      ],
      beforeRedacted: {
        serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
        perSessionTotal: parseDecimal(quote.perSessionTotal),
        finalTotal: parseDecimal(quote.finalTotal),
        areaM2: parseDecimal(quote.areaM2),
        perimeterM: parseDecimal(quote.perimeterM)
      },
      afterRedacted: {
        serviceFrequency: sessionPricing.serviceFrequency,
        perSessionTotal: sessionPricing.perSessionTotal,
        finalTotal,
        areaM2: measuredDb.area_m2,
        perimeterM: measuredDb.perimeter_m
      }
    });

    return {
      quoteId: quote.publicQuoteId,
      status: quote.status,
      customerStatus: 'updated',
      version: nextVersion,
      serviceFrequency: sessionPricing.serviceFrequency,
      perSessionTotal: sessionPricing.perSessionTotal,
      finalTotal,
      sessionsMin: sessionPricing.sessionsMin,
      sessionsMax: sessionPricing.sessionsMax,
      seasonalTotalMin: sessionPricing.seasonalTotalMin,
      seasonalTotalMax: sessionPricing.seasonalTotalMax,
      areaM2: measuredDb.area_m2,
      perimeterM: measuredDb.perimeter_m,
      recommendedPlan
    };
  }

  async submitQuoteVersion(input: SubmitQuoteVersionInput) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      if (quote.status !== 'in_review') {
        throw new Error('QUOTE_NOT_IN_REVIEW');
      }

      const selectedVersion = this.memory.quoteVersions.find(
        (version) => version.quoteId === quote.id && version.versionNumber === input.versionNumber
      );
      if (!selectedVersion) {
        throw new Error('QUOTE_VERSION_NOT_FOUND');
      }

      const beforeStatus = quote.status;
      quote.polygon = selectedVersion.polygon;
      quote.polygonSourceJson = selectedVersion.polygonSourceJson;
      quote.polygonCentroid = selectedVersion.polygonCentroid;
      quote.areaM2 = selectedVersion.areaM2;
      quote.perimeterM = selectedVersion.perimeterM;
      quote.recommendedPlan = selectedVersion.recommendedPlan;
      quote.serviceFrequency = selectedVersion.serviceFrequency;
      quote.sessionsMin = selectedVersion.sessionsMin;
      quote.sessionsMax = selectedVersion.sessionsMax;
      quote.perSessionTotal = selectedVersion.perSessionTotal;
      quote.seasonalTotalMin = selectedVersion.seasonalTotalMin;
      quote.seasonalTotalMax = selectedVersion.seasonalTotalMax;
      quote.baseTotal = selectedVersion.baseTotal;
      quote.finalTotal = selectedVersion.finalTotal;
      quote.overrideAmount = selectedVersion.overrideAmount;
      quote.overrideReason = selectedVersion.overrideReason;
      quote.status = 'verified';
      quote.customerStatus = 'awaiting_payment';
      quote.verifiedAt = nowIso();
      quote.verifiedBy = input.actor.userId;
      quote.updatedAt = nowIso();

      const latestVersion = this.memory.quoteVersions
        .filter((version) => version.quoteId === quote.id)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
      const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

      this.memory.quoteVersions.push({
        id: nanoid(14),
        quoteId: quote.id,
        versionNumber: nextVersion,
        changeType: 'verification',
        actorType: 'admin',
        polygon: selectedVersion.polygon,
        polygonSourceJson: selectedVersion.polygonSourceJson,
        polygonCentroid: selectedVersion.polygonCentroid,
        areaM2: selectedVersion.areaM2,
        perimeterM: selectedVersion.perimeterM,
        recommendedPlan: selectedVersion.recommendedPlan,
        serviceFrequency: selectedVersion.serviceFrequency,
        sessionsMin: selectedVersion.sessionsMin,
        sessionsMax: selectedVersion.sessionsMax,
        perSessionTotal: selectedVersion.perSessionTotal,
        seasonalTotalMin: selectedVersion.seasonalTotalMin,
        seasonalTotalMax: selectedVersion.seasonalTotalMax,
        baseTotal: selectedVersion.baseTotal,
        finalTotal: selectedVersion.finalTotal,
        overrideAmount: selectedVersion.overrideAmount,
        overrideReason: selectedVersion.overrideReason,
        changedBy: input.actor.userId,
        changedAt: nowIso()
      });

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.version_submitted',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: ['status', 'customer_status', 'verified_at', 'verified_by'],
        beforeRedacted: {
          status: beforeStatus
        },
        afterRedacted: {
          status: quote.status,
          customerStatus: quote.customerStatus,
          selectedVersion: input.versionNumber
        }
      });

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.verification_email_deferred',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: [],
        afterRedacted: {
          quoteId: quote.publicQuoteId,
          selectedVersion: input.versionNumber,
          delivery: 'deferred'
        }
      });

      return {
        quoteId: quote.publicQuoteId,
        status: quote.status,
        customerStatus: quote.customerStatus,
        verifiedAt: quote.verifiedAt,
        verifiedBy: quote.verifiedBy,
        selectedVersion: input.versionNumber
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== 'in_review') {
      throw new Error('QUOTE_NOT_IN_REVIEW');
    }

    const selectedVersion = await this.prisma.quoteVersion.findUnique({
      where: {
        quoteId_versionNumber: {
          quoteId: quote.id,
          versionNumber: input.versionNumber
        }
      }
    });
    if (!selectedVersion) {
      throw new Error('QUOTE_VERSION_NOT_FOUND');
    }

    const latestVersion = await this.prisma.quoteVersion.findFirst({
      where: {
        quoteId: quote.id
      },
      orderBy: {
        versionNumber: 'desc'
      }
    });
    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "quotes" q
          SET
            "polygon_geom" = v."polygon_geom",
            "polygon_source_json" = v."polygon_source_json",
            "polygon_centroid_geog" = v."polygon_centroid_geog",
            "area_m2" = v."area_m2",
            "perimeter_m" = v."perimeter_m",
            "recommended_plan" = v."recommended_plan",
            "service_frequency" = v."service_frequency",
            "sessions_min" = v."sessions_min",
            "sessions_max" = v."sessions_max",
            "per_session_total" = v."per_session_total",
            "seasonal_total_min" = v."seasonal_total_min",
            "seasonal_total_max" = v."seasonal_total_max",
            "base_total" = v."base_total",
            "final_total" = v."final_total",
            "override_amount" = v."override_amount",
            "override_reason" = v."override_reason",
            "status" = 'verified'::"QuoteStatus",
            "customer_status" = 'awaiting_payment'::"CustomerStatus",
            "verified_at" = now(),
            "verified_by" = ${input.actor.userId},
            "updated_at" = now()
          FROM "quote_versions" v
          WHERE
            q."id" = ${quote.id}
            AND v."quote_id" = q."id"
            AND v."version_number" = ${input.versionNumber}
        `
      );

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "quote_versions" (
            "id",
            "quote_id",
            "version_number",
            "change_type",
            "actor_type",
            "polygon_geom",
            "polygon_source_json",
            "polygon_centroid_geog",
            "area_m2",
            "perimeter_m",
            "recommended_plan",
            "service_frequency",
            "sessions_min",
            "sessions_max",
            "per_session_total",
            "seasonal_total_min",
            "seasonal_total_max",
            "base_total",
            "final_total",
            "override_amount",
            "override_reason",
            "changed_by",
            "changed_at"
          )
          SELECT
            ${nanoid(14)},
            v."quote_id",
            ${nextVersion},
            'verification'::"QuoteVersionChangeType",
            'admin'::"QuoteVersionActorType",
            v."polygon_geom",
            v."polygon_source_json",
            v."polygon_centroid_geog",
            v."area_m2",
            v."perimeter_m",
            v."recommended_plan",
            v."service_frequency",
            v."sessions_min",
            v."sessions_max",
            v."per_session_total",
            v."seasonal_total_min",
            v."seasonal_total_max",
            v."base_total",
            v."final_total",
            v."override_amount",
            v."override_reason",
            ${input.actor.userId},
            now()
          FROM "quote_versions" v
          WHERE
            v."quote_id" = ${quote.id}
            AND v."version_number" = ${input.versionNumber}
        `
      );
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.version_submitted',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: ['status', 'customer_status', 'verified_at', 'verified_by'],
      beforeRedacted: {
        status: quote.status
      },
      afterRedacted: {
        status: 'verified',
        customerStatus: 'awaiting_payment',
        selectedVersion: input.versionNumber
      }
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.verification_email_deferred',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: [],
      afterRedacted: {
        quoteId: quote.publicQuoteId,
        selectedVersion: input.versionNumber,
        delivery: 'deferred'
      }
    });

    return {
      quoteId: quote.publicQuoteId,
      status: 'verified',
      customerStatus: 'awaiting_payment',
      verifiedAt: nowIso(),
      verifiedBy: input.actor.userId,
      selectedVersion: input.versionNumber
    };
  }

  async reviseQuote(input: ReviseQuoteInput) {
    if (!this.prisma) {
      const quote = [...this.memory.quotes.values()].find((item) => item.publicQuoteId === input.quotePublicId);
      if (!quote) {
        throw new Error('QUOTE_NOT_FOUND');
      }

      if (quote.status !== 'in_review') {
        throw new Error('QUOTE_NOT_IN_REVIEW');
      }

      const before = {
        serviceFrequency: quote.serviceFrequency,
        perSessionTotal: quote.perSessionTotal,
        sessionsMin: quote.sessionsMin,
        sessionsMax: quote.sessionsMax,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        finalTotal: quote.finalTotal,
        overrideAmount: quote.overrideAmount,
        overrideReason: quote.overrideReason
      };

      const sessionPricing = computeSessionRangePricing(input.perSessionTotal, quote.serviceFrequency);
      const finalTotal = roundMoney(input.finalTotal ?? input.perSessionTotal);
      quote.perSessionTotal = sessionPricing.perSessionTotal;
      quote.sessionsMin = sessionPricing.sessionsMin;
      quote.sessionsMax = sessionPricing.sessionsMax;
      quote.seasonalTotalMin = sessionPricing.seasonalTotalMin;
      quote.seasonalTotalMax = sessionPricing.seasonalTotalMax;
      quote.finalTotal = finalTotal;
      quote.overrideAmount = input.overrideAmount ?? null;
      quote.overrideReason = input.overrideReason ?? null;
      quote.customerStatus = 'updated';
      quote.updatedAt = nowIso();

      const latestVersion = this.memory.quoteVersions
        .filter((version) => version.quoteId === quote.id)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];

      const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

      this.memory.quoteVersions.push({
        id: nanoid(14),
        quoteId: quote.id,
        versionNumber: nextVersion,
        changeType: 'admin_revision',
        actorType: 'admin',
        polygon: quote.polygon,
        polygonSourceJson: quote.polygonSourceJson,
        polygonCentroid: quote.polygonCentroid,
        areaM2: quote.areaM2,
        perimeterM: quote.perimeterM,
        recommendedPlan: quote.recommendedPlan,
        serviceFrequency: quote.serviceFrequency,
        sessionsMin: quote.sessionsMin,
        sessionsMax: quote.sessionsMax,
        perSessionTotal: quote.perSessionTotal,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        baseTotal: quote.baseTotal,
        finalTotal,
        overrideAmount: quote.overrideAmount,
        overrideReason: quote.overrideReason,
        changedBy: input.actor.userId,
        changedAt: nowIso()
      });

      await this.writeAuditLog({
        actor: input.actor,
        action: 'quote.revised',
        entityType: 'quote',
        entityId: quote.id,
        changedFields: [
          'per_session_total',
          'sessions_min',
          'sessions_max',
          'seasonal_total_min',
          'seasonal_total_max',
          'final_total',
          'override_amount',
          'override_reason',
          'customer_status'
        ],
        beforeRedacted: before,
        afterRedacted: {
          serviceFrequency: quote.serviceFrequency,
          perSessionTotal: quote.perSessionTotal,
          sessionsMin: quote.sessionsMin,
          sessionsMax: quote.sessionsMax,
          seasonalTotalMin: quote.seasonalTotalMin,
          seasonalTotalMax: quote.seasonalTotalMax,
          finalTotal,
          overrideAmount: quote.overrideAmount,
          overrideReason: quote.overrideReason
        },
        beforeFull: before,
        afterFull: {
          serviceFrequency: quote.serviceFrequency,
          perSessionTotal: quote.perSessionTotal,
          sessionsMin: quote.sessionsMin,
          sessionsMax: quote.sessionsMax,
          seasonalTotalMin: quote.seasonalTotalMin,
          seasonalTotalMax: quote.seasonalTotalMax,
          finalTotal,
          overrideAmount: quote.overrideAmount,
          overrideReason: quote.overrideReason
        }
      });

      return {
        quoteId: quote.publicQuoteId,
        status: quote.status,
        customerStatus: quote.customerStatus,
        serviceFrequency: quote.serviceFrequency,
        perSessionTotal: quote.perSessionTotal,
        sessionsMin: quote.sessionsMin,
        sessionsMax: quote.sessionsMax,
        seasonalTotalMin: quote.seasonalTotalMin,
        seasonalTotalMax: quote.seasonalTotalMax,
        finalTotal,
        overrideAmount: quote.overrideAmount,
        overrideReason: quote.overrideReason,
        version: nextVersion
      };
    }

    const quote = await this.prisma.quote.findUnique({
      where: {
        publicQuoteId: input.quotePublicId
      }
    });

    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== 'in_review') {
      throw new Error('QUOTE_NOT_IN_REVIEW');
    }

    const before = {
      serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
      perSessionTotal: parseDecimal(quote.perSessionTotal),
      sessionsMin: quote.sessionsMin,
      sessionsMax: quote.sessionsMax,
      seasonalTotalMin: parseDecimal(quote.seasonalTotalMin),
      seasonalTotalMax: parseDecimal(quote.seasonalTotalMax),
      finalTotal: parseDecimal(quote.finalTotal),
      overrideAmount: quote.overrideAmount ? parseDecimal(quote.overrideAmount) : null,
      overrideReason: quote.overrideReason
    };

    const latestVersion = await this.prisma.quoteVersion.findFirst({
      where: {
        quoteId: quote.id
      },
      orderBy: {
        versionNumber: 'desc'
      }
    });

    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;
    const finalTotal = roundMoney(input.finalTotal ?? input.perSessionTotal);
    const sessionPricing = computeSessionRangePricing(
      input.perSessionTotal,
      normalizeServiceFrequency(quote.serviceFrequency)
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: {
          id: quote.id
        },
        data: {
          perSessionTotal: sessionPricing.perSessionTotal,
          sessionsMin: sessionPricing.sessionsMin,
          sessionsMax: sessionPricing.sessionsMax,
          seasonalTotalMin: sessionPricing.seasonalTotalMin,
          seasonalTotalMax: sessionPricing.seasonalTotalMax,
          finalTotal,
          overrideAmount: input.overrideAmount ?? null,
          overrideReason: input.overrideReason ?? null,
          customerStatus: 'updated'
        }
      });

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "quote_versions" (
            "id",
            "quote_id",
            "version_number",
            "change_type",
            "actor_type",
            "polygon_geom",
            "polygon_source_json",
            "polygon_centroid_geog",
            "area_m2",
            "perimeter_m",
            "recommended_plan",
            "service_frequency",
            "sessions_min",
            "sessions_max",
            "per_session_total",
            "seasonal_total_min",
            "seasonal_total_max",
            "base_total",
            "final_total",
            "override_amount",
            "override_reason",
            "changed_by",
            "changed_at"
          )
          SELECT
            ${nanoid(14)},
            q."id",
            ${nextVersion},
            'admin_revision'::"QuoteVersionChangeType",
            'admin'::"QuoteVersionActorType",
            q."polygon_geom",
            q."polygon_source_json",
            q."polygon_centroid_geog",
            q."area_m2",
            q."perimeter_m",
            q."recommended_plan",
            q."service_frequency",
            ${sessionPricing.sessionsMin},
            ${sessionPricing.sessionsMax},
            ${sessionPricing.perSessionTotal},
            ${sessionPricing.seasonalTotalMin},
            ${sessionPricing.seasonalTotalMax},
            q."base_total",
            ${finalTotal},
            ${input.overrideAmount ?? null},
            ${input.overrideReason ?? null},
            ${input.actor.userId},
            now()
          FROM "quotes" q
          WHERE q."id" = ${quote.id}
        `
      );
    });

    await this.writeAuditLog({
      actor: input.actor,
      action: 'quote.revised',
      entityType: 'quote',
      entityId: quote.id,
      changedFields: [
        'per_session_total',
        'sessions_min',
        'sessions_max',
        'seasonal_total_min',
        'seasonal_total_max',
        'final_total',
        'override_amount',
        'override_reason',
        'customer_status'
      ],
      beforeRedacted: {
        serviceFrequency: before.serviceFrequency,
        perSessionTotal: before.perSessionTotal,
        sessionsMin: before.sessionsMin,
        sessionsMax: before.sessionsMax,
        seasonalTotalMin: before.seasonalTotalMin,
        seasonalTotalMax: before.seasonalTotalMax,
        finalTotal: before.finalTotal,
        overrideAmount: before.overrideAmount,
        overrideReason: before.overrideReason
      },
      afterRedacted: {
        serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
        perSessionTotal: sessionPricing.perSessionTotal,
        sessionsMin: sessionPricing.sessionsMin,
        sessionsMax: sessionPricing.sessionsMax,
        seasonalTotalMin: sessionPricing.seasonalTotalMin,
        seasonalTotalMax: sessionPricing.seasonalTotalMax,
        finalTotal,
        overrideAmount: input.overrideAmount ?? null,
        overrideReason: input.overrideReason ?? null
      },
      beforeFull: before,
      afterFull: {
        serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
        perSessionTotal: sessionPricing.perSessionTotal,
        sessionsMin: sessionPricing.sessionsMin,
        sessionsMax: sessionPricing.sessionsMax,
        seasonalTotalMin: sessionPricing.seasonalTotalMin,
        seasonalTotalMax: sessionPricing.seasonalTotalMax,
        finalTotal,
        overrideAmount: input.overrideAmount ?? null,
        overrideReason: input.overrideReason ?? null
      }
    });

    return {
      quoteId: quote.publicQuoteId,
      status: quote.status,
      customerStatus: 'updated',
      serviceFrequency: normalizeServiceFrequency(quote.serviceFrequency),
      perSessionTotal: sessionPricing.perSessionTotal,
      sessionsMin: sessionPricing.sessionsMin,
      sessionsMax: sessionPricing.sessionsMax,
      seasonalTotalMin: sessionPricing.seasonalTotalMin,
      seasonalTotalMax: sessionPricing.seasonalTotalMax,
      finalTotal,
      overrideAmount: input.overrideAmount ?? null,
      overrideReason: input.overrideReason ?? null,
      version: nextVersion
    };
  }

  async getAttributionSummary(input: AttributionSummaryInput = {}) {
    const launchAt = input.launchAt;

    if (!this.prisma) {
      const grouped = new Map<string, { utmSource: string | null; utmCampaign: string | null; count: number }>();

      this.memory.attributionTouches
        .filter((touch) => touch.touchType === 'submit_snapshot')
        .forEach((touch) => {
          const key = `${touch.attribution.utmSource ?? 'direct'}|${touch.attribution.utmCampaign ?? 'none'}`;
          const current = grouped.get(key) ?? {
            utmSource: touch.attribution.utmSource ?? null,
            utmCampaign: touch.attribution.utmCampaign ?? null,
            count: 0
          };

          current.count += 1;
          grouped.set(key, current);
        });

      return {
        items: [...grouped.values()].sort((a, b) => b.count - a.count),
        generatedAt: nowIso(),
        launchAt: launchAt?.toISOString() ?? null
      };
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ utm_source: string | null; utm_campaign: string | null; quote_count: number }>
    >(
      Prisma.sql`
        SELECT
          at."utm_source",
          at."utm_campaign",
          COUNT(*)::int AS quote_count
        FROM "attribution_touches" at
        JOIN "quotes" q ON q."id" = at."quote_id"
        WHERE at."touch_type" = 'submit_snapshot'
        ${launchAt ? Prisma.sql`AND q."created_at" >= ${launchAt}` : Prisma.sql``}
        GROUP BY at."utm_source", at."utm_campaign"
        ORDER BY quote_count DESC
      `
    );

    return {
      items: rows.map((row) => ({
        utmSource: row.utm_source,
        utmCampaign: row.utm_campaign,
        count: row.quote_count
      })),
      generatedAt: nowIso(),
      launchAt: launchAt?.toISOString() ?? null
    };
  }

  async exportQuotesCsv(role: AdminRole) {
    const canViewFullPii = role === 'OWNER' || role === 'ADMIN' || role === 'REVIEWER';

    const rows = await this.listQuotes({
      limit: 5000,
      role,
      status: undefined
    });

    const headers = [
      'quote_id',
      'status',
      'customer_status',
      'created_at',
      'submitted_at',
      'address_text',
      'service_frequency',
      'sessions_min',
      'sessions_max',
      'per_session_total',
      'seasonal_total_min',
      'seasonal_total_max',
      'final_total',
      'area_m2',
      'perimeter_m',
      'lead_name',
      'lead_email',
      'lead_phone'
    ];

    const escapeCsv = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) {
        return '';
      }

      const text = String(value);
      if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) {
        return text;
      }

      return `"${text.replaceAll('"', '""')}"`;
    };

    const lines = [headers.join(',')];

    rows.items.forEach((item) => {
      const lead = item.lead as { name?: string | null; email?: string | null; phone?: string | null } | undefined;

      lines.push(
        [
          item.quoteId,
          item.status,
          item.customerStatus,
          item.createdAt,
          item.submittedAt,
          item.addressText,
          item.serviceFrequency,
          item.sessionsMin,
          item.sessionsMax,
          item.perSessionTotal,
          item.seasonalTotalMin,
          item.seasonalTotalMax,
          item.finalTotal,
          item.areaM2,
          item.perimeterM,
          canViewFullPii ? lead?.name : maskName(lead?.name ?? null),
          canViewFullPii ? lead?.email : maskEmail(lead?.email ?? null),
          canViewFullPii ? lead?.phone : maskPhone(lead?.phone ?? null)
        ]
          .map((value) => escapeCsv(value as string | number | null | undefined))
          .join(',')
      );
    });

    return {
      csv: lines.join('\n'),
      rowCount: rows.items.length,
      generatedAt: nowIso(),
      piiMode: canViewFullPii ? 'full' : 'masked'
    };
  }
}

export const createDataStore = (baseStations: BaseStationConfig[]) => new DataStore(baseStations);
