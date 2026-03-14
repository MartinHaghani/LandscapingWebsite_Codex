import { Link } from 'react-router-dom';

const quickLinks = [
  { label: 'Services', to: '/services' },
  { label: 'Instant Quote', to: '/instant-quote' },
  { label: 'Contact', to: '/contact' },
  { label: 'How Pricing Works', to: '/how-rate-is-calculated' }
];

export const Footer = () => (
  <footer className="border-t border-white/10 bg-black/95">
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
      <div>
        <p className="font-display text-lg font-semibold text-white">Autoscape</p>
        <p className="mt-2 max-w-md text-sm text-white/65">
          Autonomous lawn care with deterministic quote measurement, route precision, and dependable
          recurring service.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
          Quick Links
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-white/75 transition-colors hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-white/60">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Contact</p>
        <p className="mt-3">Greater Toronto Area, Ontario</p>
        <p className="mt-2">
          <a className="transition-colors hover:text-brand" href="tel:+14168482841">
            +1 (416) 848-2841
          </a>
        </p>
        <p className="mt-2">
          <a className="transition-colors hover:text-brand" href="mailto:contact@autoscape.ca">
            contact@autoscape.ca
          </a>
        </p>
        <p className="mt-3 text-xs text-white/45">Mon-Sat 7:00 AM - 7:00 PM</p>
      </div>
    </div>
  </footer>
);
