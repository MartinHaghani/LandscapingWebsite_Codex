import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
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
  const { user } = useUser();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountName = (() => {
    const firstName = user?.firstName?.trim();
    const lastName = user?.lastName?.trim();

    if (firstName && lastName) {
      return `${firstName}, ${lastName}`;
    }

    const fullName = user?.fullName?.trim();
    if (fullName) {
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length > 1) {
        return `${nameParts[0]}, ${nameParts.slice(1).join(' ')}`;
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
        <Link to="/" className="flex items-center">
          <span className="font-display text-xl font-bold tracking-wide text-ink">AUTOSCAPE</span>
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
              <span className="text-copy-soft">,</span>
              <Link to="/sign-up" className="transition-colors hover:text-brand">
                Sign Up
              </Link>
            </div>
          </SignedOut>

          <SignedIn>
            <Link to="/dashboard" className="hidden md:block">
              <span className="font-script text-[1.55rem] leading-none text-brand transition-colors hover:text-brand-muted">
                {accountName}
              </span>
            </Link>
          </SignedIn>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-stroke px-3 text-xs font-semibold uppercase tracking-[0.08em] text-copy-muted transition-colors hover:border-brand hover:text-brand md:hidden"
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
          className="border-t border-stroke bg-surface px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-copy-muted transition-colors hover:border-stroke hover:text-ink',
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
              <Link to="/sign-up" className="mt-2">
                <Button variant="secondary" className="w-full">
                  Sign Up
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                to="/dashboard"
                className="mt-3 block rounded-xl border border-stroke/90 bg-surface-muted px-4 py-3 text-center"
              >
                <span className="font-script text-[1.6rem] leading-none text-brand">{accountName}</span>
              </Link>
            </SignedIn>
          </nav>
        </div>
      ) : null}
    </header>
  );
};
