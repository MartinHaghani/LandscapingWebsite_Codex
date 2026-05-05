import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InstantQuotePage } from './InstantQuotePage';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: false,
    getToken: async () => null
  }),
  useUser: () => ({
    user: null
  })
}));

vi.mock('../components/quote/QuoteMap', () => ({
  QuoteMap: () => null
}));

const renderInstantQuotePage = () =>
  renderToStaticMarkup(
    <StaticRouter location="/instant-quote">
      <InstantQuotePage />
    </StaticRouter>
  );

describe('InstantQuotePage address header', () => {
  it('renders the address-first privacy reassurance without the progress rail', () => {
    const markup = renderInstantQuotePage();

    expect(markup).toContain('start with an address');
    expect(markup).toContain('Your privacy is important to us.');
    expect(markup).toContain('stay with Autoscape');
    expect(markup).toContain('We do not sell your information');
    expect(markup).not.toContain('data-quote-progress="true"');
    expect(markup).not.toContain('Step 1 of 3');
    expect(markup).toContain('flex flex-col gap-3 sm:flex-row sm:items-start');
    expect(markup).toContain('w-full shrink-0 whitespace-nowrap px-5 py-3 sm:w-auto');
    expect(markup).not.toContain('Select a property address to lock the map center.');
    expect(markup).not.toContain('Draw service polygons and obstacles, then request your quote.');
    expect(markup).not.toContain('Map your property and generate a quote instantly');
    expect(markup).not.toContain('No sign-up required to build your draft quote.');
  });
});
