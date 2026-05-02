import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClaimQuotePage } from './ClaimQuotePage';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: false,
    getToken: vi.fn()
  }),
  useUser: () => ({
    user: null
  })
}));

describe('ClaimQuotePage', () => {
  it('renders the SMS-style six-character Quote ID entry with one Continue button', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/claim-quote">
        <ClaimQuotePage />
      </StaticRouter>
    );

    expect(markup).toContain('Open your Autoscape quote');
    expect(markup).toContain('shown like ABC 123');
    expect(markup.match(/Quote ID character/g) ?? []).toHaveLength(6);
    expect(markup.match(/Continue/g) ?? []).toHaveLength(1);
    expect(markup).not.toContain('Preview quote');
    expect(markup).not.toContain('Q-...');
  });
});
