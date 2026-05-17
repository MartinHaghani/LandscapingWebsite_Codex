import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' }
];

export const Navbar = () => {
  const { user } = useUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountName = (() => {
    const firstName = user?.firstName?.trim();
    const lastName = user?.lastName?.trim();

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }

    const fullName = user?.fullName?.trim();
    if (fullName) {
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length > 1) {
        return `${nameParts[0]} ${nameParts.slice(1).join(' ')}`;
      }
      return fullName;
    }

    if (firstName) {
      return firstName;
    }

    if (lastName) {
      return lastName;
    }

    const username = user?.username?.trim();
    if (username) {
      return username;
    }

    const email = user?.primaryEmailAddress?.emailAddress;
    return email ? email.split('@')[0] : 'Autoscape Customer';
  })();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-stroke/90 bg-surface/95 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center" aria-label="Autoscape home">
          <img
            src="/images/brand/autoscape-horizontal-brand.png"
            alt="Autoscape"
            className="h-8 w-auto max-w-[9.75rem] sm:h-9 sm:max-w-[11.25rem]"
          />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'text-sm font-medium text-copy-muted transition-colors hover:text-ink',
                  isActive && 'text-brand'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/instant-quote" className="hidden md:block">
            <Button variant="primary">Get Instant Quote</Button>
          </Link>

          <SignedOut>
            <div className="hidden items-center gap-2 text-sm font-semibold text-copy-muted md:flex">
              <Link to="/sign-in" className="transition-colors hover:text-brand">
                Sign In
              </Link>
              <span className="h-4 w-px bg-stroke" aria-hidden="true" />
              <Link to="/sign-up" className="transition-colors hover:text-brand">
                Sign Up
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <Link to="/dashboard" className="hidden md:block">
              <span className="text-sm font-semibold text-copy-muted transition-colors hover:text-brand">
                {accountName}
              </span>
            </Link>
          </SignedIn>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-stroke text-ink transition-colors hover:border-brand hover:text-brand md:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-menu"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          id="mobile-nav-menu"
          className="border-t border-stroke bg-surface px-4 pb-5 pt-3 shadow-[0_26px_40px_-30px_rgba(16,23,19,0.45)] md:hidden"
        >
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-3 text-base font-medium text-copy-muted transition-colors hover:bg-surface-muted hover:text-ink',
                    isActive && 'bg-brand/10 text-brand'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="my-3 h-px bg-stroke/80" aria-hidden="true" />
            <Link to="/instant-quote">
              <Button className="w-full">Get Instant Quote</Button>
            </Link>
            <SignedOut>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to="/sign-in">
                  <Button variant="secondary" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link to="/sign-up">
                  <Button variant="secondary" className="w-full">
                    Sign Up
                  </Button>
                </Link>
              </div>
            </SignedOut>
            <SignedIn>
              <Link
                to="/dashboard"
                className="mt-3 block rounded-xl border border-stroke/90 bg-surface-muted px-4 py-3 text-center text-sm font-semibold text-copy-muted transition-colors hover:border-brand/45 hover:text-brand"
              >
                {accountName}
              </Link>
            </SignedIn>
          </nav>
        </div>
      ) : null}
    </header>
  );
};
