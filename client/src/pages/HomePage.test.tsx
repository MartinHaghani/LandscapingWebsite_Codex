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
  it('renders the generic landscaping hero with tagline, CTAs, and curated lawn photo', () => {
    const markup = renderHomePage();

    expect(markup).toContain('Premium Lawn Care');
    expect(markup).toContain("A Lawn You&#x27;ll Love");
    expect(markup).toContain(
      'Reliable weekly mowing, edging, and clean up for an affordable price'
    );
    expect(markup).toContain('Get Instant Quote');
    expect(markup).toContain('Call or Send a Message');
    expect(markup).toContain('data-home-hero-media="true"');
    expect(markup).toContain('data-home-hero-badge="true"');
    expect(markup).toContain('Trusted by Vaughan homeowners');
    expect(markup).toContain('/images/gallery/gallery-08.png');
    expect(markup).toContain('min-[375px]:flex-row');

    // No autonomous / robot mower messaging anywhere on the page.
    expect(markup).not.toContain('Autonomous');
    expect(markup).not.toContain('autonomous');
    expect(markup).not.toContain('lawnmower');
    expect(markup).not.toContain('learning your lawn');
    expect(markup).not.toContain('Generating path');
    expect(markup).not.toContain('data-hero-lawn-stack="true"');
    expect(markup).not.toContain('data-measurement-count');
  });
});

describe('HomePage results section', () => {
  it('renders the before/after results section after pricing and before the why-us section', () => {
    const markup = renderHomePage();
    const heroIndex = markup.indexOf("A Lawn You&#x27;ll Love");
    const pricingIndex = markup.indexOf('Save with Autoscape');
    const resultsIndex = markup.indexOf('Reliable. Consistent. Every Time.');
    const whyIndex = markup.indexOf('Why homeowners choose Autoscape');
    const servicesIndex = markup.indexOf('Maintenance designed for premium residential properties');

    expect(resultsIndex).toBeGreaterThan(heroIndex);
    expect(resultsIndex).toBeGreaterThan(pricingIndex);
    expect(resultsIndex).toBeLessThan(whyIndex);
    expect(whyIndex).toBeLessThan(servicesIndex);
    expect(markup).toContain('data-home-results="true"');
    expect(markup).toContain('data-home-results-media="true"');
    expect(markup).toContain('Real Results');
    expect(markup).toContain(
      'The same clean, even cut every single week. No rushed jobs and no missed spots, just steady and reliable maintenance that keeps your lawn looking sharp without you having to think about it.'
    );
    expect(markup).toContain('/images/gallery/gallery-04.png');
    expect(markup).toContain('bg-white/70 shadow-[0_20px_44px_-40px_rgba(16,23,19,0.32)]');
    expect(markup).toContain('origin-top-left scale-[1.025] object-cover');

    // The autonomous mower video must be gone.
    expect(markup).not.toContain('/videos/home/lawnmower-in-action.mp4');
    expect(markup).not.toContain('<video');
    expect(markup).not.toContain('In Action');
  });
});

describe('HomePage pricing comparison', () => {
  it('renders the unchanged pricing comparison directly after the hero and before the results section', () => {
    const markup = renderHomePage();
    const heroIndex = markup.indexOf("A Lawn You&#x27;ll Love");
    const comparisonIndex = markup.indexOf('Save with Autoscape');
    const resultsIndex = markup.indexOf('Reliable. Consistent. Every Time.');
    const servicesIndex = markup.indexOf('Maintenance designed for premium residential properties');
    const contextIndex = markup.indexOf('data-home-pricing-context="true"');
    const lawnIndex = markup.indexOf('data-home-pricing-lawn="true"');
    const panelIndex = markup.indexOf('data-home-pricing-panel="true"');

    expect(comparisonIndex).toBeGreaterThan(heroIndex);
    expect(comparisonIndex).toBeLessThan(resultsIndex);
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
    expect(markup).toContain(
      'Benchmark uses the current public posted weekly mowing rate. Taxes, extras, drawn area, perimeter, cadence, and service distance can change a final quote.'
    );
  });
});

describe('HomePage why-us section', () => {
  it('renders the generic why-us section between results and services with no robot specs', () => {
    const markup = renderHomePage();
    const resultsIndex = markup.indexOf('Reliable. Consistent. Every Time.');
    const whyIndex = markup.indexOf('Why homeowners choose Autoscape');
    const servicesIndex = markup.indexOf('Maintenance designed for premium residential properties');

    expect(whyIndex).toBeGreaterThan(resultsIndex);
    expect(whyIndex).toBeLessThan(servicesIndex);
    expect(markup).toContain('data-home-why-section="true"');
    expect(markup).toContain('data-home-why-points="true"');
    expect(markup).toContain('data-home-why-artwork="true"');
    expect(markup).toContain('Crisp, even results');
    expect(markup).toContain('Dependable weekly schedule');
    expect(markup).toContain('Local &amp; fully insured');
    expect(markup).toContain('Satisfaction guaranteed');
    expect(markup).toContain('data-home-why-icon="measure"');
    expect(markup).toContain('data-home-why-icon="signal"');
    expect(markup).toContain('data-home-why-icon="flask"');
    expect(markup).toContain('data-home-why-icon="shield"');
    expect(markup.match(/data-home-why-icon=/g)).toHaveLength(4);
    expect(markup).toContain('/images/gallery/gallery-03.png');

    // The robot mower technology content must be gone.
    expect(markup).not.toContain('/images/home/mower-technology-transparent.png');
    expect(markup).not.toContain('Meet our lawnmowers');
    expect(markup).not.toContain('5 sensor types');
    expect(markup).not.toContain('Centimetre precision');
    expect(markup).not.toContain('sensor fusion');
  });
});

describe('HomePage streamlined content', () => {
  it('keeps the services cards generic with no autonomous mowing card', () => {
    const markup = renderHomePage();

    expect(markup).not.toContain('Why Electric');
    expect(markup).not.toContain('How It Works');
    expect(markup).not.toContain('Testimonials');
    expect(markup).toContain('Weekly Mowing');
    expect(markup).toContain('Cleanup &amp; Debris');
    expect(markup).toContain('Edging');
    expect(markup).not.toContain('Autonomous Mowing');
  });
});

describe('HomePage FAQ', () => {
  it('renders the customer FAQ with generic lawn-care language', () => {
    const markup = renderHomePage();

    expect(markup).toContain('Common questions');
    expect(markup).toContain('How often do you mow?');
    expect(markup).toContain('What areas do you serve?');
    expect(markup).toContain('Do I need to be home for service?');
    expect(markup).toContain('Is your service safe for kids and pets?');
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
    expect(markup).not.toContain('How often do autonomous cuts run?');
    expect(markup).not.toContain('Is autonomous lawn care safe for kids and pets?');
  });
});
