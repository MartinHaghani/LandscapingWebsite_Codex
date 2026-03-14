import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const ServicesPage = lazy(() => import('./pages/ServicesPage').then((module) => ({ default: module.ServicesPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const InstantQuotePage = lazy(() =>
  import('./pages/InstantQuotePage').then((module) => ({ default: module.InstantQuotePage }))
);
const QuoteContactPage = lazy(() =>
  import('./pages/QuoteContactPage').then((module) => ({ default: module.QuoteContactPage }))
);
const OutOfServiceAreaPage = lazy(() =>
  import('./pages/OutOfServiceAreaPage').then((module) => ({ default: module.OutOfServiceAreaPage }))
);
const ServiceCheckErrorPage = lazy(() =>
  import('./pages/ServiceCheckErrorPage').then((module) => ({ default: module.ServiceCheckErrorPage }))
);
const ServiceAreaRequestedPage = lazy(() =>
  import('./pages/ServiceAreaRequestedPage').then((module) => ({ default: module.ServiceAreaRequestedPage }))
);
const HowRateCalculatedPage = lazy(() =>
  import('./pages/HowRateCalculatedPage').then((module) => ({ default: module.HowRateCalculatedPage }))
);
const QuoteConfirmationPage = lazy(() =>
  import('./pages/QuoteConfirmationPage').then((module) => ({ default: module.QuoteConfirmationPage }))
);
const SignInPage = lazy(() => import('./pages/SignInPage').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((module) => ({ default: module.SignUpPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const DashboardQuoteDetailPage = lazy(() =>
  import('./pages/DashboardQuoteDetailPage').then((module) => ({ default: module.DashboardQuoteDetailPage }))
);

const App = () => (
  <Suspense
    fallback={
      <div className="mx-auto flex min-h-[45vh] w-full max-w-7xl items-center justify-center px-4 text-sm text-white/70">
        Loading...
      </div>
    }
  >
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/instant-quote" element={<InstantQuotePage />} />
        <Route path="/quote-contact/:quoteId" element={<QuoteContactPage />} />
        <Route path="/service-unavailable" element={<OutOfServiceAreaPage />} />
        <Route path="/service-check-error" element={<ServiceCheckErrorPage />} />
        <Route path="/service-area-requested" element={<ServiceAreaRequestedPage />} />
        <Route path="/how-rate-is-calculated" element={<HowRateCalculatedPage />} />
        <Route path="/quote-confirmation/:quoteId" element={<QuoteConfirmationPage />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/quotes/:quoteId" element={<DashboardQuoteDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </Suspense>
);

export default App;
