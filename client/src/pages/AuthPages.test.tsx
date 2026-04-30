import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';

vi.mock('@clerk/clerk-react', () => ({
  SignIn: (props: { appearance?: unknown; path?: string }) => (
    <div>
      Mock SignIn {props.path} {props.appearance ? 'with appearance' : ''}
    </div>
  ),
  SignUp: (props: { appearance?: unknown; path?: string }) => (
    <div>
      Mock SignUp {props.path} {props.appearance ? 'with appearance' : ''}
    </div>
  )
}));

describe('auth pages', () => {
  it('passes the Autoscape Clerk appearance to sign in and sign up', () => {
    const signInMarkup = renderToStaticMarkup(<SignInPage />);
    const signUpMarkup = renderToStaticMarkup(<SignUpPage />);

    expect(signInMarkup).toContain('Mock SignIn /sign-in with appearance');
    expect(signUpMarkup).toContain('Mock SignUp /sign-up with appearance');
  });
});
