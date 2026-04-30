import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardAccountPage } from './DashboardAccountPage';

const authState = {
  isLoaded: true,
  isSignedIn: true
};

const userState = {
  user: {
    fullName: 'Jane Customer',
    primaryPhoneNumber: {
      phoneNumber: '+1 416 555 0100'
    },
    unsafeMetadata: {}
  }
};

vi.mock('@clerk/clerk-react', () => ({
  UserProfile: (props: { appearance?: unknown; path?: string }) => (
    <div>
      Mock Clerk UserProfile {props.path} {props.appearance ? 'with appearance' : ''}
    </div>
  ),
  useAuth: () => authState,
  useUser: () => userState
}));

describe('DashboardAccountPage', () => {
  beforeEach(() => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    userState.user = {
      fullName: 'Jane Customer',
      primaryPhoneNumber: {
        phoneNumber: '+1 416 555 0100'
      },
      unsafeMetadata: {}
    };
  });

  it('renders the Clerk profile management surface inside the dashboard route', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/dashboard/account">
        <DashboardAccountPage />
      </StaticRouter>
    );

    expect(markup).toContain('Profile and security');
    expect(markup).toContain('Mock Clerk UserProfile /dashboard/account');
    expect(markup).toContain('with appearance');
    expect(markup).toContain('Back to Dashboard');
  });
});
