import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuoteMapActionCluster } from './QuoteMapActionCluster';

describe('QuoteMapActionCluster', () => {
  it('renders Guide beside the Done action', () => {
    const markup = renderToStaticMarkup(
      <QuoteMapActionCluster
        doneDisabled={false}
        onDoneClick={() => {}}
        onGuideClick={() => {}}
      />
    );

    expect(markup).toContain('data-quote-map-action-cluster="true"');
    expect(markup).toContain('data-quote-guide-button="true"');
    expect(markup).toContain('data-quote-done-button="true"');
    expect(markup).toContain('Guide');
    expect(markup).toContain('Done');
  });
});
