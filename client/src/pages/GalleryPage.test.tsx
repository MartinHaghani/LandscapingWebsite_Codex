import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { GalleryPage, galleryItems } from './GalleryPage';

describe('GalleryPage', () => {
  it('renders the unique before and after gallery items with location captions', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/gallery">
        <GalleryPage />
      </StaticRouter>
    );

    expect(galleryItems).toHaveLength(9);
    expect(markup.match(/\/images\/gallery\/gallery-\d{2}\.png/g)).toHaveLength(9);
    expect(markup).toContain('Before / After');
    expect(markup).toContain('Vaughan, ON');
    expect(markup).toContain('Richmond Hill, ON');
    expect(markup.indexOf('Richmond Hill, ON')).toBeLessThan(markup.indexOf('Vaughan, ON'));
    expect(markup).not.toContain('Front Walk Reset');
    expect(markup).not.toContain('gallery-10.png');
  });
});
