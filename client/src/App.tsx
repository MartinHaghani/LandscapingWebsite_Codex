import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { InstantQuotePage } from './pages/InstantQuotePage';
import { QuoteConfirmationPage } from './pages/QuoteConfirmationPage';
import { ServicesPage } from './pages/ServicesPage';

const App = () => (
  <Routes>
    <Route element={<SiteLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/instant-quote" element={<InstantQuotePage />} />
      <Route path="/quote-confirmation/:quoteId" element={<QuoteConfirmationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

export default App;
