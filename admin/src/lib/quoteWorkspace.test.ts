import { describe, expect, it } from 'vitest';
import {
  formatQuoteOrigin,
  quoteOriginForSubtab,
  quoteRequestStartPath,
  quoteRequestStatusLabel,
  quoteSubtabs,
  quoteWorkspaceModeForSubtab
} from './quoteWorkspace';

describe('quote workspace tabs', () => {
  it('keeps the admin quote tabs in the expected order', () => {
    expect(quoteSubtabs.map((tab) => tab.label)).toEqual([
      'All',
      'Manual quote requests',
      'Instant quote tool quotes',
      'Admin generated quotes'
    ]);
  });

  it('maps quote subtabs to the correct quote origin filters', () => {
    expect(quoteOriginForSubtab('all')).toBeUndefined();
    expect(quoteOriginForSubtab('manual_requests')).toBeUndefined();
    expect(quoteOriginForSubtab('instant_tool')).toBe('instant_tool');
    expect(quoteOriginForSubtab('admin_generated')).toBe('admin_generated');
  });

  it('decides whether a subtab should load quotes, assisted requests, or both', () => {
    expect(quoteWorkspaceModeForSubtab('all')).toEqual({
      includeQuoteRequests: true,
      includeQuotes: true,
      quoteOrigin: undefined
    });
    expect(quoteWorkspaceModeForSubtab('manual_requests')).toEqual({
      includeQuoteRequests: true,
      includeQuotes: false,
      quoteOrigin: undefined
    });
    expect(quoteWorkspaceModeForSubtab('instant_tool')).toEqual({
      includeQuoteRequests: false,
      includeQuotes: true,
      quoteOrigin: 'instant_tool'
    });
    expect(quoteWorkspaceModeForSubtab('admin_generated')).toEqual({
      includeQuoteRequests: false,
      includeQuotes: true,
      quoteOrigin: 'admin_generated'
    });
  });
});

describe('quote workspace labels and links', () => {
  it('labels quote origins for the admin quote table', () => {
    expect(formatQuoteOrigin('instant_tool')).toBe('Instant tool');
    expect(formatQuoteOrigin('admin_generated')).toBe('Admin generated');
    expect(formatQuoteOrigin('assisted_request')).toBe('Assisted request');
  });

  it('labels assisted request statuses for manual request rows', () => {
    expect(quoteRequestStatusLabel('requested')).toBe('Requested');
    expect(quoteRequestStatusLabel('in_progress')).toBe('In Progress');
    expect(quoteRequestStatusLabel('quoted')).toBe('Quoted');
    expect(quoteRequestStatusLabel('canceled')).toBe('Canceled');
  });

  it('builds the assisted quote creator handoff URL safely', () => {
    expect(quoteRequestStartPath('qr assisted/001')).toBe('/quotes/new?requestId=qr%20assisted%2F001');
  });
});
