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
    expect(markup).toContain('Quote Time');
  });
});
