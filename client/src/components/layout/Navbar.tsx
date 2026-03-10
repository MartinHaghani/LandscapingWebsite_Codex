import { Link, NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' }
];

export const Navbar = () => (
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

      <Link to="/instant-quote" className="hidden md:block">
        <Button variant="primary">Get Instant Quote</Button>
      </Link>
    </div>
  </header>
);
