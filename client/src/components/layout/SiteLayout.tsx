import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

export const SiteLayout = () => (
  <div className="min-h-screen bg-ink">
    <Navbar />
    <main>
      <Outlet />
    </main>
    <Footer />
  </div>
);
