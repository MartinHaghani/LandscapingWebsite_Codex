import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuoteDoneButton } from './QuoteDoneButton';

describe('QuoteDoneButton', () => {
  it('renders the stronger primary map completion action', () => {
    const markup = renderToStaticMarkup(
      <QuoteDoneButton disabled={false} onClick={() => {}} />
    );

    expect(markup).toContain('data-quote-done-button="true"');
    expect(markup).toContain('Done');
    expect(markup).toContain('✓');
  });
});
