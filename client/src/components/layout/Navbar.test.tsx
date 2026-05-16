import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  useUser: () => ({ user: null })
}));

describe('Navbar', () => {
  it('uses a slim divider between signed-out auth links', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/contact">
        <Navbar />
      </StaticRouter>
    );

    expect(markup).toContain('Sign In');
    expect(markup).toContain('Sign Up');
    expect(markup).toContain('/images/brand/autoscape-horizontal-brand.png');
    expect(markup).toContain('aria-label="Autoscape home"');
    expect(markup).toContain('href="/gallery"');
    expect(markup).toContain('h-4 w-px bg-stroke');
    expect(markup).not.toContain('text-copy-soft">,</span>');

    const servicesIndex = markup.indexOf('href="/services"');
    const galleryIndex = markup.indexOf('href="/gallery"');
    const contactIndex = markup.indexOf('href="/contact"');

    expect(servicesIndex).toBeLessThan(galleryIndex);
    expect(galleryIndex).toBeLessThan(contactIndex);
  });
});
