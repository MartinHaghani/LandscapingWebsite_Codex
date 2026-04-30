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
    expect(markup).toContain('Precise Cuts, Lower Costs');
    expect(markup).not.toContain('Percise Cuts, Lower Costs');
    expect(markup).toContain('Talk to the Team');
    expect(markup).toContain('No sign-up required.');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-measurement-count="8"');
    expect(markup).toContain('learning your lawn');
    expect(markup).toContain('data-hero-lawn-stack="true"');
    expect(markup).toContain('data-hero-status-stack="true"');
    expect(markup).toContain('w-full justify-center');
    expect(markup).toContain('invisible shrink-0 whitespace-nowrap');
    expect(markup).toContain('md:-translate-y-8');
    expect(markup).toContain('h-[300px]');
    expect(markup).toContain('min-[375px]:flex-row');
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
    expect(markup).toContain('mx-auto mt-12 grid');
    expect(markup).toContain(
      'grid-cols-[minmax(6.5rem,0.72fr)_minmax(0,1fr)_minmax(0,1fr)]'
    );
    expect(lawnIndex).toBeGreaterThan(comparisonIndex);
    expect(contextIndex).toBeGreaterThan(comparisonIndex);
    expect(panelIndex).toBeGreaterThan(contextIndex);
    expect(markup).toContain('md:items-stretch');
    expect(markup).toContain('h-full px-2 py-4');
    expect(markup).toContain('max-w-[10rem]');
    expect(markup).toContain('grid grid-cols-2 gap-4 border-t border-stroke/70');
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
    expect(markup).toContain('Per season');
    expect(markup).toContain('20% off');
    expect(markup).toContain('data-home-pricing-discount-cell="true"');
    expect(markup).toContain('data-home-pricing-discount-badge="true"');
    expect(markup).toContain('rounded-lg border-y border-stroke/80');
    expect(markup).toContain('absolute right-0 top-0 -translate-y-1/2');
    expect(markup).toContain(
      'Benchmark uses the current public posted weekly mowing rate. Taxes, extras, drawn area, perimeter, cadence, and service distance can change a final quote.'
    );
    expect(markup).not.toContain('A simple weekly mowing example');
    expect(markup).not.toContain('Sample Pricing');
    expect(markup).not.toContain('Autoscape seasonal plan');
    expect(markup).not.toContain('Example based on a 3,000 sq ft lawn with 20 weekly visits.');
    expect(markup).not.toContain('$900');
    expect(markup).not.toContain('rounded-full bg-brand/10 px-3 py-2');
    expect(markup).not.toContain('rounded-xl border border-stroke bg-white px-4 py-3');
    expect(markup).not.toContain('max-w-[8rem]');
    expect(markup).not.toContain('Standard weekly mowing price');
    expect(markup).not.toContain('Includes 20% seasonal savings');
    expect(markup).not.toContain('Save $10 per visit and $380 per season.');
    expect(markup).not.toContain('$380');
    expect(markup).not.toContain('flex flex-wrap items-center justify-center gap-2');
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
    expect(markup).toContain('Rigorously tested');
    expect(markup).toContain('Built-in safety features');
    expect(markup).toContain('data-home-mower-icon="measure"');
    expect(markup).toContain('data-home-mower-icon="signal"');
    expect(markup).toContain('data-home-mower-icon="flask"');
    expect(markup).toContain('data-home-mower-icon="shield"');
    expect(markup.match(/data-home-mower-icon=/g)).toHaveLength(4);
    expect(markup).toContain(
      'Uses sensor fusion to stay aware of position, route progress, surroundings, and changing conditions.'
    );
    expect(markup).toContain('/images/home/mower-technology-transparent.png');
    expect(markup).toContain('Autoscape autonomous lawnmower');
    expect(markup).not.toContain('Tested rigorously');
    expect(markup).not.toContain('Uses layered sensing');
    expect(markup).not.toContain(
      'Autoscape mowers combine repeatable route execution, property-aware sensing, and disciplined coverage to deliver a consistent premium cut week after week.'
    );
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
    expect(markup).toContain('Cleanup &amp; Debris');
    expect(markup).toContain('Edging');
    expect(markup).not.toContain('Edge + Detail Finishing');
  });
});

describe('HomePage FAQ', () => {
  it('renders the current customer FAQ with larger emphasized answers', () => {
    const markup = renderHomePage();

    expect(markup).toContain('Common questions');
    expect(markup).toContain('How often do autonomous cuts run?');
    expect(markup).toContain('What areas do you serve?');
    expect(markup).toContain('Do I need to be home for service?');
    expect(markup).toContain('Is autonomous lawn care safe for kids and pets?');
    expect(markup).toContain('What happens in rain or bad weather?');
    expect(markup).toContain('How much does it cost?');
    expect(markup).toContain('mt-2 max-w-4xl text-base leading-7 text-copy-muted');
    expect(markup).toContain('<strong class="font-semibold text-ink">weekly</strong>');
    expect(markup).toContain('<strong class="font-semibold text-ink">Vaughan area</strong>');
    expect(markup).toContain('<strong class="font-semibold text-ink">In most cases, no.</strong>');
    expect(markup).toContain('<strong class="font-semibold text-ink">Safety matters.</strong>');
    expect(markup).toContain(
      '<strong class="font-semibold text-ink">Weather can affect mowing conditions and timing.</strong>'
    );
    expect(markup).toContain('<strong class="font-semibold text-ink">Pricing depends</strong>');
    expect(markup).not.toContain('What if my yard has multiple zones?');
    expect(markup).not.toContain('Is setup disruptive?');
  });
});
