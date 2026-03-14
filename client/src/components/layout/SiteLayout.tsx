import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { ScrollToTop } from './ScrollToTop';

export const SiteLayout = () => (
  <div className="min-h-screen bg-ink">
    <ScrollToTop />
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
    >
      Skip to content
    </a>
    <Navbar />
    <main id="main-content">
      <Outlet />
    </main>
    <Footer />
  </div>
);
