import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RequestsMap } from './components/RequestsMap';
import {
  adminApi,
  type AdminAttributionSummaryRow,
  type AdminAuditItem,
  type AdminContactItem,
  type AdminLeadItem,
  type AdminQuoteItem,
  type AdminRequestItem,
  type AdminRequestMapResponse,
  type AdminRole,
  type AdminSession,
  type AuditListParams,
  type ContactListParams,
  type LeadListParams,
  type QuoteListParams,
  type RequestListParams
} from './lib/api';

const SESSION_KEY = 'autoscape_admin_session_v1';

type ThemeMode = 'system' | 'light' | 'dark';
type TabKey = 'quotes' | 'requests' | 'contacts' | 'leads' | 'attribution' | 'audit';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'quotes', label: 'Quotes' },
  { key: 'requests', label: 'Requests' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'leads', label: 'Leads' },
  { key: 'attribution', label: 'Attribution' },
  { key: 'audit', label: 'Audit' }
];

const readStoredSession = (): AdminSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
};

const storeSession = (session: AdminSession | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2
  }).format(value);

const makeCsvDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const parseBoolFilter = (value: string): boolean | undefined => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  return undefined;
};

const MetricCard = ({ label, value }: { label: string; value: string | number }) => (
  <article className="metric-card">
    <p className="metric-label">{label}</p>
    <p className="metric-value">{value}</p>
  </article>
);

const Toolbar = ({
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortDir,
  onSortDirChange,
  sortOptions,
  onApply,
  onClear,
  children
}: {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortDir: 'asc' | 'desc';
  onSortDirChange: (value: 'asc' | 'desc') => void;
  sortOptions: Array<{ label: string; value: string }>;
  onApply: () => void;
  onClear: () => void;
  children?: ReactNode;
}) => (
  <section className="toolbar">
    <div className="toolbar-row">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search"
        className="toolbar-search"
      />
      <select value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>
      <select value={sortDir} onChange={(event) => onSortDirChange(event.target.value as 'asc' | 'desc')}>
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </select>
      <button type="button" className="button primary" onClick={onApply}>
        Apply
      </button>
      <button type="button" className="button" onClick={onClear}>
        Clear
      </button>
    </div>
    {children ? <div className="toolbar-filters">{children}</div> : null}
  </section>
);

const LoginPanel = ({ onLogin }: { onLogin: (session: AdminSession) => void }) => {
  const [role, setRole] = useState<AdminRole>('OWNER');
  const [userId, setUserId] = useState('admin-owner');
  const [token, setToken] = useState(import.meta.env.VITE_ADMIN_API_TOKEN ?? '');

  return (
    <main className="login-shell">
      <section className="login-card">
        <h1>Autoscape Admin</h1>
        <p>Use your assigned role to access quotes, requests, contacts, leads, and audit trails.</p>

        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="REVIEWER">REVIEWER</option>
            <option value="MARKETING">MARKETING</option>
          </select>
        </label>

        <label>
          User ID
          <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="admin-owner" />
        </label>

        <label>
          Admin API token (optional in local dev)
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Token"
          />
        </label>

        <button
          type="button"
          className="button primary"
          onClick={() =>
            onLogin({ role, userId: userId.trim() || `admin-${role.toLowerCase()}`, token: token.trim() || undefined })
          }
        >
          Sign in
        </button>
      </section>
    </main>
  );
};

const App = () => {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());
  const [tab, setTab] = useState<TabKey>('quotes');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const [health, setHealth] = useState<{
    role: AdminRole;
    capabilities: {
      viewPiiFull: boolean;
      viewAttribution: boolean;
      exportPiiFull: boolean;
      exportMarketingSafe: boolean;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<AdminQuoteItem[]>([]);
  const [quoteCursor, setQuoteCursor] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const [requests, setRequests] = useState<AdminRequestItem[]>([]);
  const [requestMap, setRequestMap] = useState<AdminRequestMapResponse>({ points: [], hotspots: [], meta: { generatedAt: '', pointCount: 0, filters: {} } });
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  const [contacts, setContacts] = useState<AdminContactItem[]>([]);
  const [contactCursor, setContactCursor] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [leads, setLeads] = useState<AdminLeadItem[]>([]);
  const [leadCursor, setLeadCursor] = useState<string | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AdminAuditItem[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [attributionSummary, setAttributionSummary] = useState<AdminAttributionSummaryRow[]>([]);
  const [loadingAttribution, setLoadingAttribution] = useState(false);

  const [quoteFilters, setQuoteFilters] = useState<QuoteListParams>({
    q: '',
    status: '',
    serviceFrequency: undefined,
    contactPending: undefined,
    sortBy: 'createdAt',
    sortDir: 'desc'
  });

  const [requestFilters, setRequestFilters] = useState<RequestListParams>({
    q: '',
    source: '',
    status: '',
    sortBy: 'createdAt',
    sortDir: 'desc'
  });

  const [contactFilters, setContactFilters] = useState<ContactListParams>({
    q: '',
    channel: undefined,
    sortBy: 'createdAt',
    sortDir: 'desc'
  });

  const [leadFilters, setLeadFilters] = useState<LeadListParams>({
    q: '',
    consentMarketing: undefined,
    sortBy: 'createdAt',
    sortDir: 'desc'
  });

  const [auditFilters, setAuditFilters] = useState<AuditListParams>({
    q: '',
    actorRole: undefined,
    entityType: '',
    sortBy: 'createdAt',
    sortDir: 'desc'
  });

  const [attributionSearch, setAttributionSearch] = useState('');
  const [attributionSortBy, setAttributionSortBy] = useState<'count' | 'source' | 'campaign'>('count');
  const [attributionSortDir, setAttributionSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    storeSession(session);
  }, [session]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeMode;
  }, [themeMode]);

  const loadHealth = async (activeSession: AdminSession) => {
    try {
      const response = await adminApi.getHealth(activeSession);
      setHealth({ role: response.role, capabilities: response.capabilities });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin health.');
      setHealth(null);
    }
  };

  const loadQuotes = async (activeSession: AdminSession, options?: { append?: boolean; cursor?: string }) => {
    setLoadingQuotes(true);
    setError(null);

    try {
      const response = await adminApi.listQuotes(activeSession, {
        ...quoteFilters,
        status: quoteFilters.status || undefined,
        q: quoteFilters.q || undefined,
        cursor: options?.cursor,
        limit: 25
      });

      setQuotes((current) => (options?.append ? [...current, ...response.items] : response.items));
      setQuoteCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load quotes.');
    } finally {
      setLoadingQuotes(false);
    }
  };

  const loadRequests = async (activeSession: AdminSession, options?: { append?: boolean; cursor?: string }) => {
    setLoadingRequests(true);
    setError(null);

    try {
      const [listResponse, mapResponse] = await Promise.all([
        adminApi.listRequests(activeSession, {
          ...requestFilters,
          q: requestFilters.q || undefined,
          source: requestFilters.source || undefined,
          status: requestFilters.status || undefined,
          cursor: options?.cursor,
          limit: 25
        }),
        adminApi.getRequestMap(activeSession, {
          q: requestFilters.q || undefined,
          source: requestFilters.source || undefined,
          status: requestFilters.status || undefined,
          createdFrom: requestFilters.createdFrom,
          createdTo: requestFilters.createdTo
        })
      ]);

      setRequests((current) => (options?.append ? [...current, ...listResponse.items] : listResponse.items));
      setRequestCursor(listResponse.nextCursor);
      setRequestMap(mapResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load service area requests.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadContacts = async (activeSession: AdminSession, options?: { append?: boolean; cursor?: string }) => {
    setLoadingContacts(true);
    setError(null);

    try {
      const response = await adminApi.listContacts(activeSession, {
        ...contactFilters,
        q: contactFilters.q || undefined,
        cursor: options?.cursor,
        limit: 25
      });

      setContacts((current) => (options?.append ? [...current, ...response.items] : response.items));
      setContactCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load contacts.');
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadLeads = async (activeSession: AdminSession, options?: { append?: boolean; cursor?: string }) => {
    setLoadingLeads(true);
    setError(null);

    try {
      const response = await adminApi.listLeads(activeSession, {
        ...leadFilters,
        q: leadFilters.q || undefined,
        cursor: options?.cursor,
        limit: 25
      });

      setLeads((current) => (options?.append ? [...current, ...response.items] : response.items));
      setLeadCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load leads.');
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadAudit = async (activeSession: AdminSession, options?: { append?: boolean; cursor?: string }) => {
    setLoadingAudit(true);
    setError(null);

    try {
      const response = await adminApi.listAuditLogs(activeSession, {
        ...auditFilters,
        q: auditFilters.q || undefined,
        entityType: auditFilters.entityType || undefined,
        cursor: options?.cursor,
        limit: 25
      });

      setAuditLogs((current) => (options?.append ? [...current, ...response.items] : response.items));
      setAuditCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadAttribution = async (activeSession: AdminSession) => {
    setLoadingAttribution(true);
    setError(null);

    try {
      const response = await adminApi.getAttributionSummary(activeSession);
      setAttributionSummary(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attribution summary.');
    } finally {
      setLoadingAttribution(false);
    }
  };

  const loadTab = async (activeSession: AdminSession, activeTab: TabKey) => {
    if (activeTab === 'quotes') {
      await loadQuotes(activeSession);
      return;
    }
    if (activeTab === 'requests') {
      await loadRequests(activeSession);
      return;
    }
    if (activeTab === 'contacts') {
      await loadContacts(activeSession);
      return;
    }
    if (activeTab === 'leads') {
      await loadLeads(activeSession);
      return;
    }
    if (activeTab === 'attribution') {
      await loadAttribution(activeSession);
      return;
    }

    await loadAudit(activeSession);
  };

  useEffect(() => {
    if (!session) {
      setHealth(null);
      setQuotes([]);
      setRequests([]);
      setContacts([]);
      setLeads([]);
      setAuditLogs([]);
      setAttributionSummary([]);
      return;
    }

    void loadHealth(session);
    void loadTab(session, tab);
  }, [session, tab]);

  const stats = useMemo(() => {
    const submitted = quotes.filter((quote) => quote.status === 'submitted').length;
    const inReview = quotes.filter((quote) => quote.status === 'in_review').length;
    const verified = quotes.filter((quote) => quote.status === 'verified').length;

    return {
      submitted,
      inReview,
      verified,
      requestsOpen: requests.filter((request) => request.status === 'open').length
    };
  }, [quotes, requests]);

  const filteredAttribution = useMemo(() => {
    const query = attributionSearch.trim().toLowerCase();
    const direction = attributionSortDir === 'asc' ? 1 : -1;

    const filtered = attributionSummary.filter((row) => {
      if (!query) {
        return true;
      }

      return `${row.utmSource ?? 'direct'} ${row.utmCampaign ?? 'none'}`.toLowerCase().includes(query);
    });

    return filtered.sort((left, right) => {
      if (attributionSortBy === 'source') {
        return direction * (left.utmSource ?? '').localeCompare(right.utmSource ?? '');
      }
      if (attributionSortBy === 'campaign') {
        return direction * (left.utmCampaign ?? '').localeCompare(right.utmCampaign ?? '');
      }

      return direction * (left.count - right.count);
    });
  }, [attributionSearch, attributionSortBy, attributionSortDir, attributionSummary]);

  if (!session) {
    return <LoginPanel onLogin={setSession} />;
  }

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Autoscape Admin</h1>
          <p>
            {session.userId} ({session.role})
          </p>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`sidebar-link ${tab === item.key ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <p>Launch cutoff</p>
          <strong>{import.meta.env.VITE_SYSTEM_LAUNCH_AT ?? 'not configured'}</strong>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <h2>{tabs.find((item) => item.key === tab)?.label}</h2>
            <p className="hint">
              PII: {health?.capabilities.viewPiiFull ? 'full' : 'masked'} | Attribution:{' '}
              {health?.capabilities.viewAttribution ? 'enabled' : 'disabled'}
            </p>
          </div>
          <div className="topbar-actions">
            <select value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>
              <option value="system">Theme: System</option>
              <option value="light">Theme: Light</option>
              <option value="dark">Theme: Dark</option>
            </select>
            <button
              type="button"
              className="button"
              onClick={async () => {
                try {
                  const exportResult = await adminApi.downloadQuotesCsv(session);
                  makeCsvDownload(exportResult.filename, exportResult.content);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Export failed.');
                }
              }}
            >
              Export Quotes CSV
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setSession(null);
                setTab('quotes');
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <MetricCard label="Submitted" value={stats.submitted} />
          <MetricCard label="In Review" value={stats.inReview} />
          <MetricCard label="Verified" value={stats.verified} />
          <MetricCard label="Open Requests" value={stats.requestsOpen} />
        </section>

        {error ? <p className="error-banner">{error}</p> : null}

        {tab === 'quotes' ? (
          <section className="panel">
            <Toolbar
              search={quoteFilters.q ?? ''}
              onSearchChange={(value) => setQuoteFilters((current) => ({ ...current, q: value }))}
              sortBy={quoteFilters.sortBy ?? 'createdAt'}
              onSortByChange={(value) =>
                setQuoteFilters((current) => ({
                  ...current,
                  sortBy: value as QuoteListParams['sortBy']
                }))
              }
              sortDir={quoteFilters.sortDir ?? 'desc'}
              onSortDirChange={(value) => setQuoteFilters((current) => ({ ...current, sortDir: value }))}
              sortOptions={[
                { label: 'Created', value: 'createdAt' },
                { label: 'Submitted', value: 'submittedAt' },
                { label: 'Per-session price', value: 'perSessionTotal' },
                { label: 'Seasonal max', value: 'seasonalTotalMax' }
              ]}
              onApply={() => {
                void loadQuotes(session);
              }}
              onClear={() => {
                setQuoteFilters({
                  q: '',
                  status: '',
                  serviceFrequency: undefined,
                  contactPending: undefined,
                  sortBy: 'createdAt',
                  sortDir: 'desc'
                });
                setTimeout(() => {
                  void loadQuotes(session);
                }, 0);
              }}
            >
              <select
                value={quoteFilters.status ?? ''}
                onChange={(event) => setQuoteFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={quoteFilters.serviceFrequency ?? ''}
                onChange={(event) =>
                  setQuoteFilters((current) => ({
                    ...current,
                    serviceFrequency:
                      event.target.value === 'weekly' || event.target.value === 'biweekly'
                        ? event.target.value
                        : undefined
                  }))
                }
              >
                <option value="">All cadence</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
              </select>
              <select
                value={quoteFilters.contactPending === undefined ? '' : String(quoteFilters.contactPending)}
                onChange={(event) =>
                  setQuoteFilters((current) => ({
                    ...current,
                    contactPending: parseBoolFilter(event.target.value)
                  }))
                }
              >
                <option value="">All contact states</option>
                <option value="true">Contact pending</option>
                <option value="false">Contact complete</option>
              </select>
            </Toolbar>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Status</th>
                    <th>Lead</th>
                    <th>Address</th>
                    <th>Cadence</th>
                    <th>Per Session</th>
                    <th>Seasonal Range</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.quoteId}>
                      <td>{quote.quoteId}</td>
                      <td>
                        {quote.status}
                        <br />
                        <small>{quote.customerStatus}</small>
                      </td>
                      <td>
                        <div>{quote.lead.name ?? 'N/A'}</div>
                        <div>{quote.lead.email ?? 'N/A'}</div>
                        <div>{quote.lead.phone ?? 'N/A'}</div>
                      </td>
                      <td>{quote.addressText}</td>
                      <td>{quote.serviceFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'}</td>
                      <td>{toCurrency(quote.perSessionTotal)}</td>
                      <td>
                        {toCurrency(quote.seasonalTotalMin)} - {toCurrency(quote.seasonalTotalMax)}
                        <br />
                        <small>
                          {quote.sessionsMin}-{quote.sessionsMax} sessions
                        </small>
                      </td>
                      <td>{formatDate(quote.createdAt)}</td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="button"
                            disabled={quote.status !== 'submitted'}
                            onClick={async () => {
                              try {
                                await adminApi.updateQuoteStatus(session, quote.quoteId, 'in_review');
                                await loadQuotes(session);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Status update failed.');
                              }
                            }}
                          >
                            Move to In Review
                          </button>

                          <button
                            type="button"
                            className="button"
                            disabled={quote.status !== 'in_review'}
                            onClick={async () => {
                              try {
                                await adminApi.updateQuoteStatus(session, quote.quoteId, 'verified');
                                await loadQuotes(session);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Status update failed.');
                              }
                            }}
                          >
                            Verify
                          </button>

                          <button
                            type="button"
                            className="button"
                            disabled={quote.status !== 'in_review'}
                            onClick={async () => {
                              const totalInput = window.prompt(
                                'Enter revised per-session total (CAD):',
                                String(quote.perSessionTotal)
                              );
                              if (!totalInput) {
                                return;
                              }

                              const perSessionTotal = Number(totalInput);
                              if (!Number.isFinite(perSessionTotal) || perSessionTotal < 0) {
                                setError('Per-session total must be a valid number.');
                                return;
                              }

                              const reason = window.prompt('Optional revision reason:', '') ?? undefined;

                              try {
                                await adminApi.reviseQuote(session, quote.quoteId, {
                                  perSessionTotal,
                                  overrideAmount: Math.max(0, quote.perSessionTotal - perSessionTotal),
                                  overrideReason: reason
                                });
                                await loadQuotes(session);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Revision failed.');
                              }
                            }}
                          >
                            Revise
                          </button>

                          <button
                            type="button"
                            className="button"
                            onClick={async () => {
                              const note = window.prompt('Add internal quote note:', '');
                              if (!note || note.trim().length === 0) {
                                return;
                              }

                              try {
                                await adminApi.addQuoteNote(session, quote.quoteId, note.trim());
                                await loadAudit(session);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Unable to add note.');
                              }
                            }}
                          >
                            Add Note
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {quotes.length === 0 && !loadingQuotes ? (
                    <tr>
                      <td colSpan={9}>No quotes found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button type="button" className="button" onClick={() => void loadQuotes(session)} disabled={loadingQuotes}>
                {loadingQuotes ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => quoteCursor && void loadQuotes(session, { append: true, cursor: quoteCursor })}
                disabled={!quoteCursor || loadingQuotes}
              >
                Load more
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'requests' ? (
          <section className="panel">
            <Toolbar
              search={requestFilters.q ?? ''}
              onSearchChange={(value) => setRequestFilters((current) => ({ ...current, q: value }))}
              sortBy={requestFilters.sortBy ?? 'createdAt'}
              onSortByChange={(value) =>
                setRequestFilters((current) => ({
                  ...current,
                  sortBy: value as RequestListParams['sortBy']
                }))
              }
              sortDir={requestFilters.sortDir ?? 'desc'}
              onSortDirChange={(value) => setRequestFilters((current) => ({ ...current, sortDir: value }))}
              sortOptions={[
                { label: 'Created', value: 'createdAt' },
                { label: 'Distance to station', value: 'distanceToNearestStationM' }
              ]}
              onApply={() => {
                void loadRequests(session);
              }}
              onClear={() => {
                setRequestFilters({
                  q: '',
                  source: '',
                  status: '',
                  sortBy: 'createdAt',
                  sortDir: 'desc'
                });
                setTimeout(() => {
                  void loadRequests(session);
                }, 0);
              }}
            >
              <select
                value={requestFilters.source ?? ''}
                onChange={(event) => setRequestFilters((current) => ({ ...current, source: event.target.value }))}
              >
                <option value="">All sources</option>
                <option value="out_of_area_page">Out-of-area page</option>
                <option value="coverage_checker">Coverage checker</option>
                <option value="instant_quote">Instant quote</option>
                <option value="contact_form">Contact form</option>
              </select>
              <select
                value={requestFilters.status ?? ''}
                onChange={(event) => setRequestFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All status</option>
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="planned">Planned</option>
                <option value="rejected">Rejected</option>
              </select>
              <label className="toggle-inline">
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(event) => setShowHeatmap(event.target.checked)}
                />
                Heatmap
              </label>
              <label className="toggle-inline">
                <input
                  type="checkbox"
                  checked={showClusters}
                  onChange={(event) => setShowClusters(event.target.checked)}
                />
                Cluster points
              </label>
            </Toolbar>

            <div className="map-card">
              <RequestsMap points={requestMap.points} showHeatmap={showHeatmap} showClusters={showClusters} />
              <aside className="hotspot-list">
                <h3>Hotspots</h3>
                <p className="hint">Grouped into 0.01° grid cells for quick expansion planning.</p>
                <ul>
                  {requestMap.hotspots.slice(0, 10).map((hotspot) => (
                    <li key={hotspot.id}>
                      <span>
                        {hotspot.lat.toFixed(2)}, {hotspot.lng.toFixed(2)}
                      </span>
                      <strong>{hotspot.count}</strong>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Address</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Distance (m)</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.id}</td>
                      <td>{request.addressText}</td>
                      <td>{request.source}</td>
                      <td>{request.status}</td>
                      <td>{Math.round(request.distanceToNearestStationM)}</td>
                      <td>{formatDate(request.createdAt)}</td>
                    </tr>
                  ))}
                  {requests.length === 0 && !loadingRequests ? (
                    <tr>
                      <td colSpan={6}>No service area requests found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button type="button" className="button" onClick={() => void loadRequests(session)} disabled={loadingRequests}>
                {loadingRequests ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => requestCursor && void loadRequests(session, { append: true, cursor: requestCursor })}
                disabled={!requestCursor || loadingRequests}
              >
                Load more
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'contacts' ? (
          <section className="panel">
            <Toolbar
              search={contactFilters.q ?? ''}
              onSearchChange={(value) => setContactFilters((current) => ({ ...current, q: value }))}
              sortBy={contactFilters.sortBy ?? 'createdAt'}
              onSortByChange={(value) =>
                setContactFilters((current) => ({
                  ...current,
                  sortBy: value as ContactListParams['sortBy']
                }))
              }
              sortDir={contactFilters.sortDir ?? 'desc'}
              onSortDirChange={(value) => setContactFilters((current) => ({ ...current, sortDir: value }))}
              sortOptions={[
                { label: 'Created', value: 'createdAt' },
                { label: 'Name', value: 'name' },
                { label: 'Email', value: 'email' }
              ]}
              onApply={() => {
                void loadContacts(session);
              }}
              onClear={() => {
                setContactFilters({
                  q: '',
                  channel: undefined,
                  sortBy: 'createdAt',
                  sortDir: 'desc'
                });
                setTimeout(() => {
                  void loadContacts(session);
                }, 0);
              }}
            >
              <select
                value={contactFilters.channel ?? ''}
                onChange={(event) =>
                  setContactFilters((current) => ({
                    ...current,
                    channel:
                      event.target.value === 'quote_finalize' || event.target.value === 'contact_form'
                        ? event.target.value
                        : undefined
                  }))
                }
              >
                <option value="">All channels</option>
                <option value="quote_finalize">Quote finalize</option>
                <option value="contact_form">Contact form</option>
              </select>
            </Toolbar>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Channel</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Message</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{contact.id}</td>
                      <td>{contact.channel}</td>
                      <td>{contact.name ?? 'N/A'}</td>
                      <td>{contact.email ?? 'N/A'}</td>
                      <td>{contact.phone ?? 'N/A'}</td>
                      <td>{contact.addressText ?? 'N/A'}</td>
                      <td className="truncate-cell">{contact.message ?? 'N/A'}</td>
                      <td>{formatDate(contact.createdAt)}</td>
                    </tr>
                  ))}
                  {contacts.length === 0 && !loadingContacts ? (
                    <tr>
                      <td colSpan={8}>No contacts found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button type="button" className="button" onClick={() => void loadContacts(session)} disabled={loadingContacts}>
                {loadingContacts ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => contactCursor && void loadContacts(session, { append: true, cursor: contactCursor })}
                disabled={!contactCursor || loadingContacts}
              >
                Load more
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'leads' ? (
          <section className="panel">
            <Toolbar
              search={leadFilters.q ?? ''}
              onSearchChange={(value) => setLeadFilters((current) => ({ ...current, q: value }))}
              sortBy={leadFilters.sortBy ?? 'createdAt'}
              onSortByChange={(value) =>
                setLeadFilters((current) => ({
                  ...current,
                  sortBy: value as LeadListParams['sortBy']
                }))
              }
              sortDir={leadFilters.sortDir ?? 'desc'}
              onSortDirChange={(value) => setLeadFilters((current) => ({ ...current, sortDir: value }))}
              sortOptions={[
                { label: 'Created', value: 'createdAt' },
                { label: 'First seen', value: 'firstSeenAt' },
                { label: 'Last seen', value: 'lastSeenAt' }
              ]}
              onApply={() => {
                void loadLeads(session);
              }}
              onClear={() => {
                setLeadFilters({
                  q: '',
                  consentMarketing: undefined,
                  sortBy: 'createdAt',
                  sortDir: 'desc'
                });
                setTimeout(() => {
                  void loadLeads(session);
                }, 0);
              }}
            >
              <select
                value={leadFilters.consentMarketing === undefined ? '' : String(leadFilters.consentMarketing)}
                onChange={(event) =>
                  setLeadFilters((current) => ({
                    ...current,
                    consentMarketing: parseBoolFilter(event.target.value)
                  }))
                }
              >
                <option value="">All consent states</option>
                <option value="true">Consent true</option>
                <option value="false">Consent false</option>
              </select>
            </Toolbar>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Consent</th>
                    <th>First Seen</th>
                    <th>Last Seen</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.id}</td>
                      <td>{lead.primaryName ?? 'N/A'}</td>
                      <td>{lead.primaryEmail ?? 'N/A'}</td>
                      <td>{lead.primaryPhone ?? 'N/A'}</td>
                      <td>{lead.consentMarketing ? 'yes' : 'no'}</td>
                      <td>{formatDate(lead.firstSeenAt)}</td>
                      <td>{formatDate(lead.lastSeenAt)}</td>
                      <td>{formatDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && !loadingLeads ? (
                    <tr>
                      <td colSpan={8}>No leads found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button type="button" className="button" onClick={() => void loadLeads(session)} disabled={loadingLeads}>
                {loadingLeads ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => leadCursor && void loadLeads(session, { append: true, cursor: leadCursor })}
                disabled={!leadCursor || loadingLeads}
              >
                Load more
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'attribution' ? (
          <section className="panel">
            <Toolbar
              search={attributionSearch}
              onSearchChange={setAttributionSearch}
              sortBy={attributionSortBy}
              onSortByChange={(value) => setAttributionSortBy(value as 'count' | 'source' | 'campaign')}
              sortDir={attributionSortDir}
              onSortDirChange={setAttributionSortDir}
              sortOptions={[
                { label: 'Count', value: 'count' },
                { label: 'UTM source', value: 'source' },
                { label: 'UTM campaign', value: 'campaign' }
              ]}
              onApply={() => {
                void loadAttribution(session);
              }}
              onClear={() => {
                setAttributionSearch('');
                setAttributionSortBy('count');
                setAttributionSortDir('desc');
              }}
            />

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>UTM Source</th>
                    <th>UTM Campaign</th>
                    <th>Quote Count</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttribution.map((row) => (
                    <tr key={`${row.utmSource ?? 'direct'}-${row.utmCampaign ?? 'none'}`}>
                      <td>{row.utmSource ?? 'direct'}</td>
                      <td>{row.utmCampaign ?? 'none'}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                  {filteredAttribution.length === 0 && !loadingAttribution ? (
                    <tr>
                      <td colSpan={3}>No attribution snapshots yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button
                type="button"
                className="button"
                onClick={() => void loadAttribution(session)}
                disabled={loadingAttribution}
              >
                {loadingAttribution ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'audit' ? (
          <section className="panel">
            <Toolbar
              search={auditFilters.q ?? ''}
              onSearchChange={(value) => setAuditFilters((current) => ({ ...current, q: value }))}
              sortBy={auditFilters.sortBy ?? 'createdAt'}
              onSortByChange={(value) =>
                setAuditFilters((current) => ({
                  ...current,
                  sortBy: value as AuditListParams['sortBy']
                }))
              }
              sortDir={auditFilters.sortDir ?? 'desc'}
              onSortDirChange={(value) => setAuditFilters((current) => ({ ...current, sortDir: value }))}
              sortOptions={[
                { label: 'Created', value: 'createdAt' },
                { label: 'Action', value: 'action' }
              ]}
              onApply={() => {
                void loadAudit(session);
              }}
              onClear={() => {
                setAuditFilters({
                  q: '',
                  actorRole: undefined,
                  entityType: '',
                  sortBy: 'createdAt',
                  sortDir: 'desc'
                });
                setTimeout(() => {
                  void loadAudit(session);
                }, 0);
              }}
            >
              <select
                value={auditFilters.actorRole ?? ''}
                onChange={(event) =>
                  setAuditFilters((current) => ({
                    ...current,
                    actorRole:
                      event.target.value === 'OWNER' ||
                      event.target.value === 'ADMIN' ||
                      event.target.value === 'REVIEWER' ||
                      event.target.value === 'MARKETING' ||
                      event.target.value === 'SYSTEM'
                        ? (event.target.value as AdminRole | 'SYSTEM')
                        : undefined
                  }))
                }
              >
                <option value="">All roles</option>
                <option value="OWNER">OWNER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="REVIEWER">REVIEWER</option>
                <option value="MARKETING">MARKETING</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
              <input
                value={auditFilters.entityType ?? ''}
                onChange={(event) => setAuditFilters((current) => ({ ...current, entityType: event.target.value }))}
                placeholder="Entity type"
              />
            </Toolbar>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Changed fields</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((event) => (
                    <tr key={event.id}>
                      <td>{event.id}</td>
                      <td>{event.action}</td>
                      <td>
                        {event.entityType}:{event.entityId}
                      </td>
                      <td>
                        {event.actorRole}
                        <br />
                        <small>{event.actorUserId ?? 'system'}</small>
                      </td>
                      <td>{event.changedFields.join(', ') || 'none'}</td>
                      <td>{formatDate(event.createdAt)}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && !loadingAudit ? (
                    <tr>
                      <td colSpan={6}>No audit events available.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              <button type="button" className="button" onClick={() => void loadAudit(session)} disabled={loadingAudit}>
                {loadingAudit ? 'Loading...' : 'Refresh'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => auditCursor && void loadAudit(session, { append: true, cursor: auditCursor })}
                disabled={!auditCursor || loadingAudit}
              >
                Load more
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
};

export default App;
