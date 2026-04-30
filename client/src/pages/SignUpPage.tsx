import { SignUp } from '@clerk/clerk-react';
import { autoscapeClerkAppearance } from '../lib/clerkAppearance';

export const SignUpPage = () => (
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
        signInUrl="/sign-in"
        fallbackRedirectUrl="/complete-profile"
      />
    </div>
  </div>
);
