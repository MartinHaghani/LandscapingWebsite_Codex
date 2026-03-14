export type AdminRole = 'OWNER' | 'ADMIN' | 'REVIEWER' | 'MARKETING';

export type AuthTokenProvider = () => Promise<string | null>;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

class AdminApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const request = async <T>(
  path: string,
  getToken: AuthTokenProvider,
  init?: RequestInit
): Promise<T> => {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getToken();
  if (!token) {
    throw new AdminApiError('Authentication is required.', 401);
  }
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
    throw new AdminApiError(errorBody.error ?? 'Admin request failed.', response.status);
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
};

export interface CursorResponse<T> {
  items: T[];
  nextCursor: string | null;
  meta: {
    generatedAt: string;
    rowCount: number;
    filters: Record<string, string | number | null | undefined>;
  };
}

export interface AdminQuoteItem {
  quoteId: string;
  status: string;
  customerStatus: string;
  contactPending: boolean;
  createdAt: string;
  submittedAt: string | null;
  addressText: string;
  serviceFrequency: 'weekly' | 'biweekly';
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  finalTotal: number;
  areaM2: number;
  perimeterM: number;
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export type AdminPolygonKind = 'service' | 'obstacle';
export type AdminLngLat = [number, number];

export interface AdminPolygonSourcePolygon {
  id: string;
  kind: AdminPolygonKind;
  points: AdminLngLat[];
}

export interface AdminPolygonSource {
  schemaVersion: 1;
  polygons: AdminPolygonSourcePolygon[];
  activePolygonId: string | null;
}

export interface AdminQuoteVersionItem {
  versionNumber: number;
  actorType: 'client' | 'admin';
  changeType: string;
  changedBy: string;
  changedAt: string;
  serviceFrequency: 'weekly' | 'biweekly';
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalTotalMin: number;
  seasonalTotalMax: number;
  finalTotal: number;
  overrideReason: string | null;
  areaM2: number;
  perimeterM: number;
  recommendedPlan: string;
  polygonSource: AdminPolygonSource | null;
  polygonSourceFallback: boolean;
}

export interface AdminQuoteEditorResponse {
  quoteId: string;
  status: string;
  customerStatus: string;
  createdAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  addressText: string;
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  editable: {
    serviceFrequency: 'weekly' | 'biweekly';
    perSessionTotal: number;
    finalTotal: number;
    overrideReason: string | null;
  };
  calculated: {
    areaM2: number;
    perimeterM: number;
    recommendedPlan: string;
    baseTotal: number;
    perSessionTotal: number;
    sessionsMin: number;
    sessionsMax: number;
    seasonalTotalMin: number;
    seasonalTotalMax: number;
  };
  polygonSource: AdminPolygonSource;
  polygonSourceFallback: boolean;
  versions: AdminQuoteVersionItem[];
}

export interface AdminRequestItem {
  id: string;
  addressText: string;
  source: string;
  status: string;
  createdAt: string;
  distanceToNearestStationM: number;
  isInServiceAreaAtCapture: boolean;
}

export interface AdminRequestMapPoint {
  id: string;
  addressText: string;
  lat: number;
  lng: number;
  createdAt: string;
  source: string;
  status: string;
}

export interface AdminRequestMapHotspot {
  id: string;
  lat: number;
  lng: number;
  count: number;
}

export interface AdminRequestMapResponse {
  points: AdminRequestMapPoint[];
  hotspots: AdminRequestMapHotspot[];
  meta: {
    generatedAt: string;
    pointCount: number;
    filters: Record<string, string | number | null | undefined>;
  };
}

export interface AdminContactItem {
  id: string;
  channel: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  addressText: string | null;
  message: string | null;
  createdAt: string;
}

export interface AdminLeadItem {
  id: string;
  primaryName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  consentMarketing: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

export interface AdminAuditItem {
  id: string;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  changedFields: string[];
  beforeRedacted: unknown;
  afterRedacted: unknown;
  requestId: string | null;
  correlationId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminAttributionSummaryRow {
  utmSource: string | null;
  utmCampaign: string | null;
  count: number;
}

export interface QuoteListParams {
  cursor?: string;
  limit?: number;
  q?: string;
  status?: string;
  serviceFrequency?: 'weekly' | 'biweekly';
  contactPending?: boolean;
  createdFrom?: string;
  createdTo?: string;
  submittedFrom?: string;
  submittedTo?: string;
  sortBy?: 'createdAt' | 'submittedAt' | 'perSessionTotal' | 'seasonalTotalMax';
  sortDir?: 'asc' | 'desc';
}

export interface RequestListParams {
  cursor?: string;
  limit?: number;
  q?: string;
  source?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'distanceToNearestStationM';
  sortDir?: 'asc' | 'desc';
}

export interface ContactListParams {
  cursor?: string;
  limit?: number;
  q?: string;
  channel?: 'quote_finalize' | 'contact_form';
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortDir?: 'asc' | 'desc';
}

export interface LeadListParams {
  cursor?: string;
  limit?: number;
  q?: string;
  consentMarketing?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'firstSeenAt' | 'lastSeenAt';
  sortDir?: 'asc' | 'desc';
}

export interface AuditListParams {
  cursor?: string;
  limit?: number;
  q?: string;
  actorRole?: AdminRole | 'SYSTEM';
  entityType?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'createdAt' | 'action';
  sortDir?: 'asc' | 'desc';
}

const appendParam = (query: URLSearchParams, key: string, value: string | number | boolean | undefined) => {
  if (value === undefined || value === '') {
    return;
  }

  query.set(key, String(value));
};

export const adminApi = {
  getHealth(getToken: AuthTokenProvider) {
    return request<{
      ok: boolean;
      role: AdminRole;
      capabilities: {
        viewPiiFull: boolean;
        viewAttribution: boolean;
        exportPiiFull: boolean;
        exportMarketingSafe: boolean;
      };
    }>('/api/admin/health', getToken);
  },

  listQuotes(getToken: AuthTokenProvider, params: QuoteListParams) {
    const query = new URLSearchParams();
    appendParam(query, 'cursor', params.cursor);
    appendParam(query, 'limit', params.limit);
    appendParam(query, 'q', params.q);
    appendParam(query, 'status', params.status);
    appendParam(query, 'serviceFrequency', params.serviceFrequency);
    appendParam(query, 'contactPending', params.contactPending);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'submittedFrom', params.submittedFrom);
    appendParam(query, 'submittedTo', params.submittedTo);
    appendParam(query, 'sortBy', params.sortBy);
    appendParam(query, 'sortDir', params.sortDir);

    return request<CursorResponse<AdminQuoteItem>>(`/api/admin/quotes?${query.toString()}`, getToken);
  },

  listRequests(getToken: AuthTokenProvider, params: RequestListParams) {
    const query = new URLSearchParams();
    appendParam(query, 'cursor', params.cursor);
    appendParam(query, 'limit', params.limit);
    appendParam(query, 'q', params.q);
    appendParam(query, 'source', params.source);
    appendParam(query, 'status', params.status);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'sortBy', params.sortBy);
    appendParam(query, 'sortDir', params.sortDir);

    return request<CursorResponse<AdminRequestItem>>(`/api/admin/service-area-requests?${query.toString()}`, getToken);
  },

  getRequestMap(
    getToken: AuthTokenProvider,
    params: Omit<RequestListParams, 'cursor' | 'limit' | 'sortBy' | 'sortDir'> & { bbox?: string }
  ) {
    const query = new URLSearchParams();
    appendParam(query, 'q', params.q);
    appendParam(query, 'source', params.source);
    appendParam(query, 'status', params.status);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'bbox', params.bbox);

    return request<AdminRequestMapResponse>(`/api/admin/service-area-requests/map?${query.toString()}`, getToken);
  },

  listContacts(getToken: AuthTokenProvider, params: ContactListParams) {
    const query = new URLSearchParams();
    appendParam(query, 'cursor', params.cursor);
    appendParam(query, 'limit', params.limit);
    appendParam(query, 'q', params.q);
    appendParam(query, 'channel', params.channel);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'sortBy', params.sortBy);
    appendParam(query, 'sortDir', params.sortDir);

    return request<CursorResponse<AdminContactItem>>(`/api/admin/contacts?${query.toString()}`, getToken);
  },

  listLeads(getToken: AuthTokenProvider, params: LeadListParams) {
    const query = new URLSearchParams();
    appendParam(query, 'cursor', params.cursor);
    appendParam(query, 'limit', params.limit);
    appendParam(query, 'q', params.q);
    appendParam(query, 'consentMarketing', params.consentMarketing);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'sortBy', params.sortBy);
    appendParam(query, 'sortDir', params.sortDir);

    return request<CursorResponse<AdminLeadItem>>(`/api/admin/leads?${query.toString()}`, getToken);
  },

  listAuditLogs(getToken: AuthTokenProvider, params: AuditListParams) {
    const query = new URLSearchParams();
    appendParam(query, 'cursor', params.cursor);
    appendParam(query, 'limit', params.limit);
    appendParam(query, 'q', params.q);
    appendParam(query, 'actorRole', params.actorRole);
    appendParam(query, 'entityType', params.entityType);
    appendParam(query, 'createdFrom', params.createdFrom);
    appendParam(query, 'createdTo', params.createdTo);
    appendParam(query, 'sortBy', params.sortBy);
    appendParam(query, 'sortDir', params.sortDir);

    return request<CursorResponse<AdminAuditItem>>(`/api/admin/audit-logs?${query.toString()}`, getToken);
  },

  getAttributionSummary(getToken: AuthTokenProvider) {
    return request<{
      items: AdminAttributionSummaryRow[];
      generatedAt: string;
      launchAt: string | null;
    }>('/api/admin/attribution/summary', getToken);
  },

  updateQuoteStatus(getToken: AuthTokenProvider, quoteId: string, status: string) {
    return request<{ quoteId: string; status: string }>(`/api/admin/quotes/${encodeURIComponent(quoteId)}/status`, getToken, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  getQuoteEditor(getToken: AuthTokenProvider, quoteId: string) {
    return request<AdminQuoteEditorResponse>(
      `/api/admin/quotes/${encodeURIComponent(quoteId)}/editor`,
      getToken
    );
  },

  createQuoteVersion(
    getToken: AuthTokenProvider,
    quoteId: string,
    payload: {
      polygonSource: AdminPolygonSource;
      serviceFrequency: 'weekly' | 'biweekly';
      perSessionTotal: number;
      finalTotal: number;
      overrideReason?: string;
    }
  ) {
    return request<{
      quoteId: string;
      status: string;
      customerStatus: string;
      version: number;
      serviceFrequency: 'weekly' | 'biweekly';
      perSessionTotal: number;
      finalTotal: number;
      sessionsMin: number;
      sessionsMax: number;
      seasonalTotalMin: number;
      seasonalTotalMax: number;
      areaM2: number;
      perimeterM: number;
      recommendedPlan: string;
    }>(`/api/admin/quotes/${encodeURIComponent(quoteId)}/versions`, getToken, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  submitQuoteVersion(getToken: AuthTokenProvider, quoteId: string, versionNumber: number) {
    return request<{
      quoteId: string;
      status: string;
      customerStatus: string;
      verifiedAt: string | null;
      verifiedBy: string | null;
      selectedVersion: number;
    }>(`/api/admin/quotes/${encodeURIComponent(quoteId)}/versions/${versionNumber}/submit`, getToken, {
      method: 'POST'
    });
  },

  addQuoteNote(getToken: AuthTokenProvider, quoteId: string, note: string) {
    return request<{ ok: boolean; note: unknown }>(`/api/admin/quotes/${encodeURIComponent(quoteId)}/notes`, getToken, {
      method: 'POST',
      body: JSON.stringify({ note })
    });
  },

  reviseQuote(
    getToken: AuthTokenProvider,
    quoteId: string,
    payload: {
      perSessionTotal?: number;
      finalTotal?: number;
      overrideAmount?: number;
      overrideReason?: string;
    }
  ) {
    return request<{ quoteId: string; status: string; customerStatus: string }>(
      `/api/admin/quotes/${encodeURIComponent(quoteId)}/revise`,
      getToken,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  },

  async downloadQuotesCsv(getToken: AuthTokenProvider) {
    const token = await getToken();
    if (!token) {
      throw new AdminApiError('Authentication is required.', 401);
    }

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE_URL}/api/admin/exports/quotes.csv`, {
      headers
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AdminApiError(errorBody.error ?? 'Export failed.', response.status);
    }

    return {
      content: await response.text(),
      filename: response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'quotes.csv'
    };
  }
};

export { AdminApiError };
