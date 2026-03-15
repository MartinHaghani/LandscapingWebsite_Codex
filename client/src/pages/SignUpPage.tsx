import { SignUp } from '@clerk/clerk-react';

export const SignUpPage = () => (
  <div className="mx-auto flex w-full max-w-7xl justify-center px-4 py-14 md:px-8 md:py-20">
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/complete-profile"
    />
  </div>
);
