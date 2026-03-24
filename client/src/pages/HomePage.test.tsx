import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage hero', () => {
  it('includes the no-sign-up helper copy alongside the curated CAD hero artwork', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/">
        <HomePage />
      </StaticRouter>
    );

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
