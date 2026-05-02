import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { LegalPage } from './LegalPage';

const renderLegalRoute = (location: string) =>
  renderToStaticMarkup(
    <StaticRouter location={location}>
      <Routes>
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:slug" element={<LegalPage />} />
      </Routes>
    </StaticRouter>
  );

describe('LegalPage', () => {
  it('renders the legal document index with all launch documents', () => {
    const markup = renderLegalRoute('/legal');

    expect(markup).toContain('Autoscape legal documents');
    expect(markup).toContain('Privacy Policy');
    expect(markup).toContain('Terms of Service');
    expect(markup).toContain('Cookie Policy');
    expect(markup).toContain('Refund, Cancellation, and Payment Policy');
    expect(markup).toContain('AI and Automation Disclaimer');
    expect(markup).toContain('href="/legal/third-party-services-disclosure"');
    expect(markup).not.toContain('Media Release Terms');
  });

  it('renders Markdown legal documents through the static renderer', () => {
    const markup = renderLegalRoute('/legal/privacy-policy');

    expect(markup).toContain('Privacy Policy');
    expect(markup).toContain('Last updated: May 1, 2026');
    expect(markup).toContain('1001283716 ONTARIO INC.');
    expect(markup).toContain('contact@autoscape.ca');
    expect(markup).toContain('Back to legal documents');
  });
});
