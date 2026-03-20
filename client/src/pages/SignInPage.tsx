import { SignIn } from '@clerk/clerk-react';

export const SignInPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
    <div className="mx-auto mb-8 max-w-xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">Welcome back</h1>
      <p className="mt-3 text-sm text-copy-muted">Sign in to continue your quote and dashboard activity.</p>
    </div>
    <div className="flex justify-center">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/complete-profile"
      />
    </div>
  </div>
);
