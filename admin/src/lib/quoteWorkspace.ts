import type { AdminQuoteOrigin, AdminQuoteRequestStatus } from './api';

export type QuoteSubtabKey = 'all' | 'manual_requests' | 'instant_tool' | 'admin_generated';

export const quoteSubtabs: Array<{ key: QuoteSubtabKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'manual_requests', label: 'Manual quote requests' },
  { key: 'instant_tool', label: 'Instant quote tool quotes' },
  { key: 'admin_generated', label: 'Admin generated quotes' }
];

export const formatQuoteOrigin = (origin: AdminQuoteOrigin) => {
  if (origin === 'instant_tool') {
    return 'Instant tool';
  }
  if (origin === 'admin_generated') {
    return 'Admin generated';
  }
  return 'Assisted request';
};

export const quoteOriginForSubtab = (subtab: QuoteSubtabKey): AdminQuoteOrigin | undefined => {
  if (subtab === 'instant_tool') {
    return 'instant_tool';
  }
  if (subtab === 'admin_generated') {
    return 'admin_generated';
  }

  return undefined;
};

export const quoteWorkspaceModeForSubtab = (subtab: QuoteSubtabKey) => ({
  includeQuoteRequests: subtab === 'all' || subtab === 'manual_requests',
  includeQuotes: subtab !== 'manual_requests',
  quoteOrigin: quoteOriginForSubtab(subtab)
});

export const quoteRequestStatusLabel = (status: AdminQuoteRequestStatus) =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const quoteRequestStartPath = (requestId: string) => `/quotes/new?requestId=${encodeURIComponent(requestId)}`;
