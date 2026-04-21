import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuoteGuideButton } from './QuoteGuideButton';

describe('QuoteGuideButton', () => {
  it('renders the manual drawing guide action', () => {
    const markup = renderToStaticMarkup(<QuoteGuideButton onClick={() => {}} />);

    expect(markup).toContain('data-quote-guide-button="true"');
    expect(markup).toContain('Open drawing guide');
    expect(markup).toContain('Guide');
    expect(markup).toContain('?');
  });
});
