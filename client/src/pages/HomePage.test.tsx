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

describe('HomePage pricing comparison', () => {
  it('renders a tighter pricing comparison directly after the hero and before the services section', () => {
    const markup = renderHomePage();
    const heroIndex = markup.indexOf('Autonomous Landscaping Service');
    const comparisonIndex = markup.indexOf('Save with Autoscape');
    const servicesIndex = markup.indexOf('Maintenance designed for premium residential properties');
    const contextIndex = markup.indexOf('data-home-pricing-context="true"');
    const lawnIndex = markup.indexOf('data-home-pricing-lawn="true"');
    const panelIndex = markup.indexOf('data-home-pricing-panel="true"');

    expect(comparisonIndex).toBeGreaterThan(heroIndex);
    expect(comparisonIndex).toBeLessThan(servicesIndex);
    expect(markup).toContain('data-home-pricing-comparison="true"');
    expect(markup).toContain('data-home-pricing-band="true"');
    expect(markup).toContain('data-home-pricing-context="true"');
    expect(markup).toContain('data-home-pricing-lawn="true"');
    expect(markup).toContain('data-home-pricing-panel="true"');
    expect(markup).toContain('data-home-pricing-standard-grid="true"');
    expect(lawnIndex).toBeGreaterThan(comparisonIndex);
    expect(contextIndex).toBeGreaterThan(comparisonIndex);
    expect(panelIndex).toBeGreaterThan(contextIndex);
    expect(markup).toContain('md:items-stretch');
    expect(markup).toContain('h-full rounded-2xl');
    expect(markup).toContain('flex h-full flex-col');
    expect(markup).toContain('3,000 sq ft');
    expect(markup).toContain('Autoscape');
    expect(markup).toContain('Local competitors');
    expect(markup).toContain('Price Check');
    expect(markup).toContain(
      'Get a cheaper visit rate and 20% off when you choose the seasonal plan.'
    );
    expect(markup).toContain('$45');
    expect(markup).toContain('$55');
    expect(markup).toContain('$720');
    expect(markup).toContain('$1,100');
    expect(markup).toContain('$10');
    expect(markup).toContain('$380');
    expect(markup).toContain('Per season');
    expect(markup).toContain('Includes 20% seasonal savings');
    expect(markup).toContain('Save $10 per visit and $380 per season.');
    expect(markup).toContain(
      'Benchmark uses the current public posted weekly mowing rate. Taxes, extras, drawn area, perimeter, cadence, and service distance can change a final quote.'
    );
    expect(markup).not.toContain('A simple weekly mowing example');
    expect(markup).not.toContain('Sample Pricing');
    expect(markup).not.toContain('Autoscape seasonal plan');
    expect(markup).not.toContain('Example based on a 3,000 sq ft lawn with 20 weekly visits.');
    expect(markup).not.toContain('$900');
    expect(markup).not.toContain('data-home-pricing-card=');
    expect(markup).not.toContain('data-home-pricing-seasonal-plan=');
    expect(markup).not.toContain('lg:grid-cols-3');
    expect(markup).not.toContain('rgba(230,239,232,0.68)');
    expect(markup).not.toContain('home-pricing-lawn-fill');
    expect(markup).not.toContain('M112 84H210M430 88H522');
    expect(markup).not.toContain('Ontario medium-lawn range');
    expect(markup).not.toContain('$45-$65');
    expect(markup).not.toContain('$1,170-$1,690');
  });
});

describe('HomePage mower technology section', () => {
  it('renders the mower technology section between pricing and services with the cleaned asset copy', () => {
    const markup = renderHomePage();
    const comparisonIndex = markup.indexOf('Save with Autoscape');
    const mowersIndex = markup.indexOf('Meet our lawnmowers');
    const servicesIndex = markup.indexOf('Maintenance designed for premium residential properties');

    expect(mowersIndex).toBeGreaterThan(comparisonIndex);
    expect(mowersIndex).toBeLessThan(servicesIndex);
    expect(markup).toContain('data-home-mowers-section="true"');
    expect(markup).toContain('data-home-mowers-points="true"');
    expect(markup).toContain('data-home-mowers-artwork="true"');
    expect(markup).toContain('Centimetre precision');
    expect(markup).toContain('5 sensor types');
    expect(markup).toContain('Tested rigorously');
    expect(markup).toContain('Built-in safety features');
    expect(markup).toContain(
      'Autoscape mowers combine repeatable route execution, property-aware sensing, and disciplined coverage to deliver a consistent premium cut week after week.'
    );
    expect(markup).toContain('/images/home/mower-technology-transparent.png');
    expect(markup).toContain('Autoscape autonomous lawnmower');
    expect(markup).not.toContain('data-home-mowers-image-panel=');
    expect(markup).not.toContain('Technology');
    expect(markup).not.toContain('Low-noise electric operation');
    expect(markup).not.toContain('sm:grid-cols-[3rem_minmax(0,1fr)]');
  });
});

describe('HomePage streamlined content', () => {
  it('removes the retired marketing sections from the homepage', () => {
    const markup = renderHomePage();

    expect(markup).not.toContain('Why Electric');
    expect(markup).not.toContain('How It Works');
    expect(markup).not.toContain('Why Autoscape');
    expect(markup).not.toContain('Testimonials');
  });
});
