import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

const renderHomePage = () =>
  renderToStaticMarkup(
    <StaticRouter location="/">
      <HomePage />
    </StaticRouter>
  );

describe('HomePage hero', () => {
  it('includes the no-sign-up helper copy alongside the curated CAD hero artwork', () => {
    const markup = renderHomePage();

    expect(markup).toContain('Autonomous Landscaping Service');
    expect(markup).toContain('Talk to the Team');
    expect(markup).toContain('No sign-up required.');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-measurement-count="8"');
    expect(markup).toContain('learning your lawn');
    expect(markup).toContain('data-hero-lawn-stack="true"');
    expect(markup).toContain('data-hero-status-stack="true"');
    expect(markup).toContain('data-status-motion="tickerFlip"');
    expect(markup).not.toContain('data-motion-preview="true"');
    expect(markup).not.toContain('Quote Time');
  });
});

describe('HomePage sustainability proof', () => {
  it('renders the electric-vs-gas comparison section with qualified claims', () => {
    const markup = renderHomePage();

    expect(markup).toContain('Why Electric');
    expect(markup).toContain('Cleaner, quieter lawn care without the gas tradeoffs.');
    expect(markup).toContain('Point-of-use exhaust');
    expect(markup).toContain('0 exhaust while mowing');
    expect(markup).toContain('Combustion exhaust on site');
    expect(markup).toContain('Noise at 25 ft');
    expect(markup).toContain('65.5 dBA');
    expect(markup).toContain('72.5 dBA');
    expect(markup).toContain('10-year lifecycle CO2e (push mower study)');
    expect(markup).toContain('354 kg');
    expect(markup).toContain('707 kg');
    expect(markup).toContain(
      'Based on field noise measurements and peer-reviewed lifecycle modeling. &quot;Zero emissions&quot; refers to exhaust at the point of use; lifecycle impact varies by equipment and local electricity mix.'
    );
  });

  it('avoids silent claims and keeps zero-emissions language qualified', () => {
    const markup = renderHomePage();

    expect(markup.toLowerCase()).not.toContain('silent');
    expect(markup.match(/Zero emissions/g) ?? []).toHaveLength(1);
  });
});
