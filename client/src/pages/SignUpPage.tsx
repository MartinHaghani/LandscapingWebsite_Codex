import { SignUp } from '@clerk/clerk-react';

export const SignUpPage = () => (
  <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
    <div className="mx-auto mb-8 max-w-xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account</p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">Create your account</h1>
      <p className="mt-3 text-sm text-copy-muted">
        Save and track your quotes, then finalize in just a few steps.
      </p>
    </div>
    <div className="flex justify-center">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/complete-profile"
      />
    </div>
  </div>
);
