import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './SiteLayout';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  useUser: () => ({ user: null })
}));

describe('SiteLayout footer variants', () => {
  it('renders crawlable legal links on the home page footer', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/">
        <SiteLayout />
      </StaticRouter>
    );

    expect(markup).toContain('href="/legal/privacy-policy"');
    expect(markup).toContain('Privacy Policy');
    expect(markup).toContain('href="/legal/terms-of-service"');
    expect(markup).toContain('Terms of Service');
  });

  it('uses the compact footer on quote/auth/payment funnel routes', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/payment-complete">
        <SiteLayout />
      </StaticRouter>
    );

    expect(markup).toContain('Deterministic lawn measurement, reviewed quotes');
    expect(markup).toContain('href="/legal/privacy-policy"');
    expect(markup).toContain('href="/legal/terms-of-service"');
    expect(markup).not.toContain('Quick Links');
  });

  it('keeps the full footer on marketing routes', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/services">
        <SiteLayout />
      </StaticRouter>
    );

    expect(markup).toContain('Quick Links');
    expect(markup).toContain('Autonomous lawn care with deterministic quote measurement');
  });
});
