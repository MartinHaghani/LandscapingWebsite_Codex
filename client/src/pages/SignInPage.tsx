import { SignIn } from '@clerk/clerk-react';

export const SignInPage = () => (
  <div className="mx-auto flex w-full max-w-7xl justify-center px-4 py-14 md:px-8 md:py-20">
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/complete-profile"
    />
  </div>
);
