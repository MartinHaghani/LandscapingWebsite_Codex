import { UserProfile, useAuth, useUser } from '@clerk/clerk-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { hasRequiredPhone } from '../lib/accountProfile';
import { autoscapeClerkAppearance } from '../lib/clerkAppearance';

export const DashboardAccountPage = () => {
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const profileHasRequiredPhone = hasRequiredPhone(user);

  if (!isLoaded) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <Card className="bg-surface p-8 text-sm text-copy-muted">Loading account settings...</Card>
      </div>
    );
  }

  if (!isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectPath}`} replace />;
  }

  if (!profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/complete-profile?redirect_url=${redirectPath}`} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">Profile and security</h1>
          <p className="mt-3 max-w-2xl text-sm text-copy-muted">
            Manage your password, profile details, and security settings through your Autoscape account.
          </p>
        </div>
        <Link to="/dashboard" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full sm:w-auto">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-4xl justify-center">
        <UserProfile
          appearance={autoscapeClerkAppearance}
          path="/dashboard/account"
          routing="path"
        />
      </div>
    </div>
  );
};
