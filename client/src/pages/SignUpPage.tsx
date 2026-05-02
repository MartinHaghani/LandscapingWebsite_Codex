import { SignUp } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { autoscapeClerkAppearance } from '../lib/clerkAppearance';

const getCompletionRedirect = (search: string) => {
  const redirectUrl = new URLSearchParams(search).get('redirect_url');
  if (!redirectUrl || !redirectUrl.startsWith('/')) {
    return '/complete-profile';
  }

  return `/complete-profile?redirect_url=${encodeURIComponent(redirectUrl)}`;
};

export const SignUpPage = () => {
  const location = useLocation();
  const completionRedirect = getCompletionRedirect(location.search);
  const redirectUrl = new URLSearchParams(location.search).get('redirect_url');
  const authSwitchQuery = redirectUrl?.startsWith('/') ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : '';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto mb-8 max-w-xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">Create your account</h1>
        <p className="mt-3 text-sm text-copy-muted">
          Save and track your quotes, then have Autoscape review them in just a few steps.
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-[26rem] justify-center">
        <SignUp
          appearance={autoscapeClerkAppearance}
          path="/sign-up"
          routing="path"
          signInUrl={`/sign-in${authSwitchQuery}`}
          forceRedirectUrl={completionRedirect}
          fallbackRedirectUrl={completionRedirect}
        />
      </div>
    </div>
  );
};
