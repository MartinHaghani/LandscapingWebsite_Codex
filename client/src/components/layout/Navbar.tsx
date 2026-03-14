import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' }
];

export const Navbar = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/85 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center">
          <span className="font-display text-xl font-bold tracking-wide text-white">AUTOSCAPE</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium text-white/80 transition-colors hover:text-white',
                  isActive && 'text-brand'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <SignedOut>
            <Link to="/sign-in" className="hidden md:block">
              <Button variant="secondary">Sign In</Button>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link to="/dashboard" className="hidden md:block">
              <Button variant="secondary">Dashboard</Button>
            </Link>
            <div className="hidden md:block">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>

          <Link to="/instant-quote" className="hidden md:block">
            <Button variant="primary">Get Instant Quote</Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/25 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:border-brand hover:text-brand md:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          id="mobile-nav-menu"
          className="border-t border-white/10 bg-black/95 px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:border-white/20 hover:text-white',
                    isActive && 'border-brand/40 bg-brand/10 text-brand'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/instant-quote" className="mt-3">
              <Button className="w-full">Get Instant Quote</Button>
            </Link>
            <SignedOut>
              <Link to="/sign-in" className="mt-2">
                <Button variant="secondary" className="w-full">
                  Sign In
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link to="/dashboard" className="mt-2">
                <Button variant="secondary" className="w-full">
                  Dashboard
                </Button>
              </Link>
            </SignedIn>
          </nav>
        </div>
      ) : null}
    </header>
  );
};
