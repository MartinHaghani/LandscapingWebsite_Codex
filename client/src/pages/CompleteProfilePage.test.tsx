import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CompleteProfilePage } from './CompleteProfilePage';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn()
  }),
  useUser: () => ({
    user: {
      primaryPhoneNumber: null,
      unsafeMetadata: {}
    }
  })
}));

describe('CompleteProfilePage', () => {
  it('renders required legal acceptance and optional marketing consent separately', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/complete-profile">
        <CompleteProfilePage />
      </StaticRouter>
    );

    expect(markup).toContain('Add your phone number to continue');
    expect(markup).toContain('id="complete-profile-email-marketing-consent"');
    expect(markup).toContain('Email me Autoscape updates and offers');
    expect(markup).toContain('id="complete-profile-legal-acceptance"');
    expect(markup).toContain('href="/legal/terms-of-service"');
    expect(markup).toContain('href="/legal/privacy-policy"');
    expect(markup).toContain('Save and Continue');
    expect(markup).toContain('disabled=""');
  });
});
