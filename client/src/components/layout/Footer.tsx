import { Link } from 'react-router-dom';

const socialLinks = [
  { label: 'X', href: '#' },
  { label: 'In', href: '#' },
  { label: 'YT', href: '#' }
];

export const Footer = () => (
  <footer className="border-t border-white/10 bg-black/95">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
      <div>
        <p className="font-display text-lg font-semibold text-white">Autoscape</p>
        <p className="mt-2 max-w-md text-sm text-white/65">
          Placeholder copy: premium autonomous mowing and landscape maintenance with precision route planning.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-sm font-semibold text-white/85 transition-colors hover:border-brand hover:text-brand"
            aria-label={link.label}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="text-sm text-white/55">
        <p>Placeholder Address, Smart City, USA</p>
        <p>
          <Link className="hover:text-brand" to="/contact">
            hello@autoscape.example
          </Link>
        </p>
      </div>
    </div>
  </footer>
);
