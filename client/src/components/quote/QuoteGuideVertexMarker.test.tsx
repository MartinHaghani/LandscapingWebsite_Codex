import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuoteGuideVertexMarker } from './QuoteGuideVertexMarker';

describe('QuoteGuideVertexMarker', () => {
  it('renders a larger live-tool-style treatment when selected for service polygons', () => {
    const markup = renderToStaticMarkup(
      <QuoteGuideVertexMarker
        cx={12}
        cy={24}
        filterId="vertex-shadow"
        markerKey="selected-marker"
        selected={true}
      />
    );

    expect(markup).toContain('data-guide-selected-vertex="true"');
    expect(markup).toContain('r="15.6"');
    expect(markup).toContain('stroke="#D1FAE1"');
    expect(markup).toContain('stroke="#FFFFFF"');
  });

  it('renders obstacle markers with red live-tool styling', () => {
    const markup = renderToStaticMarkup(
      <QuoteGuideVertexMarker
        cx={12}
        cy={24}
        filterId="vertex-shadow"
        markerKey="obstacle-marker"
        selected={true}
        kind="obstacle"
      />
    );

    expect(markup).toContain('fill="#DC2626"');
    expect(markup).toContain('stroke="#FFF7F7"');
  });
});
