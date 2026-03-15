import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { getAccountPhone, hasRequiredPhone } from '../lib/accountProfile';

const phonePattern = /^[0-9+().\-\s]{7,40}$/;

const getSafeRedirect = (value: string | null) => {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }

  return value;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const redirectUrl = getSafeRedirect(new URLSearchParams(location.search).get('redirect_url'));

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    const existingPhone = getAccountPhone(user);
    if (existingPhone.length > 0) {
      setPhone(existingPhone);
    }
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="bg-black/70 p-8 text-sm text-white/75">Loading account details...</Card>
      </div>
    );
  }

  if (!isSignedIn) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect_url=${redirectPath}`} replace />;
  }

  if (hasRequiredPhone(user)) {
    return <Navigate to={redirectUrl} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPhone = phone.trim();

    if (!phonePattern.test(trimmedPhone)) {
      setError('Enter a valid phone number so we can contact you about your quote.');
      return;
    }

    if (!user) {
      setError('Unable to load your account.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const unsafeMetadata = toRecord(user.unsafeMetadata);
      const profileMetadata = toRecord(unsafeMetadata.autoscapeProfile);

      await user.update({
        unsafeMetadata: {
          ...unsafeMetadata,
          autoscapeProfile: {
            ...profileMetadata,
            phone: trimmedPhone
          }
        }
      });

      navigate(redirectUrl, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save phone number right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 md:px-8 md:py-20">
      <Card className="space-y-6 bg-black/70 p-7 md:p-10">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand">Complete Profile</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Add your phone number to continue</h1>
          <p className="mt-3 text-sm text-white/75">
            We require a phone number on every account before dashboard access and quote finalization.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="complete-profile-phone" className="mb-2 block text-sm text-white/80">
              Phone
            </label>
            <input
              id="complete-profile-phone"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/50 px-4 py-3 text-white placeholder:text-white/35 focus:border-brand focus:outline-none"
              placeholder="+1 416 000 0000"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save and Continue'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
