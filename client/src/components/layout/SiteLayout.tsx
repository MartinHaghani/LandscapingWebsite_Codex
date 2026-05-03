import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { ScrollToTop } from './ScrollToTop';
import { installAnalyticsUnloadFlush, useAnalyticsPageView } from '../../lib/analytics';

const compactFooterRoutePatterns = [
  /^\/instant-quote(?:\/summary)?$/,
  /^\/quote-confirmation(?:\/|$)/,
  /^\/sign-in(?:\/|$)/,
  /^\/sign-up(?:\/|$)/,
  /^\/complete-profile(?:\/|$)/,
  /^\/pay(?:\/|$)/,
  /^\/payment-complete\/?$/,
  /^\/dashboard\/quotes\/[^/]+\/payment\/?$/
];

export const SiteLayout = () => {
  const { pathname } = useLocation();
  useAnalyticsPageView();
  useEffect(() => installAnalyticsUnloadFlush(), []);

  const footerVariant = compactFooterRoutePatterns.some((pattern) => pattern.test(pathname))
    ? 'compact'
    : 'full';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <ScrollToTop />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer variant={footerVariant} />
    </div>
  );
};
