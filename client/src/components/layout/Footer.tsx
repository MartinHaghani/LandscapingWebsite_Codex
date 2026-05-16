import { Link } from 'react-router-dom';

type FooterVariant = 'full' | 'compact';

interface FooterProps {
  variant?: FooterVariant;
}

const quickLinks = [
  { label: 'Services', to: '/services' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Instant Quote', to: '/instant-quote' },
  { label: 'Contact', to: '/contact' },
  { label: 'How Pricing Works', to: '/how-rate-is-calculated' }
];

export const Footer = ({ variant = 'full' }: FooterProps) => {
  if (variant === 'compact') {
    return (
      <footer className="mt-10 border-t border-stroke bg-surface-muted/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-7 text-sm text-copy-muted md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <img
              src="/images/brand/autoscape-horizontal-brand.png"
              alt="Autoscape"
              className="h-7 w-auto max-w-[9.5rem]"
            />
            <p className="mt-2 max-w-xl">
              Deterministic lawn measurement, reviewed quotes, and secure payment handoff.
            </p>
          </div>

          <div className="flex flex-col gap-2 font-medium sm:flex-row sm:flex-wrap sm:gap-x-5">
            <a className="transition-colors hover:text-brand" href="tel:+14168482841">
              +1 (416) 848-2841
            </a>
            <a className="transition-colors hover:text-brand" href="mailto:contact@autoscape.ca">
              contact@autoscape.ca
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-16 border-t border-stroke bg-surface-muted/70">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
      <div>
        <img
          src="/images/brand/autoscape-horizontal-brand.png"
          alt="Autoscape"
          className="h-8 w-auto max-w-[10.5rem]"
        />
        <p className="mt-2 max-w-md text-sm text-copy-muted">
          Autonomous lawn care with deterministic quote measurement, route precision, and dependable
          recurring service.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">
          Quick Links
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm text-copy-muted transition-colors hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-copy-muted">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Contact</p>
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
        <p className="mt-3 text-xs text-copy-soft">Mon-Sat 7:00 AM - 7:00 PM</p>
      </div>
    </div>
    </footer>
  );
};
