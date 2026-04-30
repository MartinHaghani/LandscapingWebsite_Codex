import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { InstantQuotePage } from './InstantQuotePage';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: async () => null
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

describe('InstantQuotePage progress header', () => {
  it('renders the 3-step progress rail without the old intro copy', () => {
    const markup = renderInstantQuotePage();

    expect(markup).toContain('data-quote-progress="true"');
    expect(markup).toContain('data-step-state="current"');
    expect(markup).toContain('data-step-state="upcoming"');
    expect(markup).toContain('Step 1 of 3');
    expect(markup).toContain('Review quote');
    expect(markup).toContain('Current step');
    expect(markup).toContain('Up next');
    expect(markup).toContain('flex flex-col gap-3 sm:flex-row sm:items-start');
    expect(markup).toContain('w-full shrink-0 whitespace-nowrap px-5 py-3 sm:w-auto');
    expect(markup).not.toContain('Select a property address to lock the map center.');
    expect(markup).not.toContain('Draw service polygons and obstacles, then request your quote.');
    expect(markup).not.toContain('Map your property and generate a quote instantly');
    expect(markup).not.toContain('No sign-up required to build your draft quote.');
  });
});
