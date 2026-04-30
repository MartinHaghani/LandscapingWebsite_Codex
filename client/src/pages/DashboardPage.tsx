import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { normalizeAccountQuote, type NormalizedAccountQuote } from '../lib/accountQuote';
import { hasRequiredPhone } from '../lib/accountProfile';
import { api, ApiError } from '../lib/api';
import {
  formatCurrency,
  getLifecycleStepIndex,
  getPlanPriceLabel,
  getQuoteDashboardState,
  getSeasonReadinessCopy,
  selectPrimaryDashboardQuote,
  shouldShowQuoteHistory,
  shouldShowQuotePrice
} from '../lib/dashboard';
import type { AccountQuoteListItem } from '../types';

interface DashboardPageContentProps {
  customerName: string;
  customerEmail: string;
  quotes: AccountQuoteListItem[];
  primaryQuote: AccountQuoteListItem | null;
  primaryQuoteDetail: NormalizedAccountQuote | null;
  loading: boolean;
  error: string | null;
  primaryQuoteLoading: boolean;
  primaryQuoteError: string | null;
  billingPortalLoading: boolean;
  billingPortalError: string | null;
  onManageCard: () => void;
  now?: Date;
}

const lifecycleSteps = ['Submit quote', 'Team review', 'Payment', 'Season ready'];

const formatStatus = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeDisplayQuote = (quote: AccountQuoteListItem | NormalizedAccountQuote) => {
  const seasonalDiscountedTotal =
    typeof quote.seasonalDiscountedTotal === 'number' && Number.isFinite(quote.seasonalDiscountedTotal)
      ? quote.seasonalDiscountedTotal
      : quote.seasonalTotalMax;

  return {
    ...quote,
    seasonalDiscountedTotal
  };
};

const getDashboardActionContent = (quote: AccountQuoteListItem | null, now: Date) => {
  if (!quote) {
    return {
      title: 'Get instant quote',
      body: 'Start with your address, map your lawn, and we will turn it into a reviewed Autoscape quote.',
      ctaLabel: 'Get instant quote',
      ctaHref: '/instant-quote'
    };
  }

  const quoteState = getQuoteDashboardState(quote);

  if (quoteState === 'draft') {
    return {
      title: 'Finish submitting your quote',
      body: 'You already mapped this property. Complete the final handoff so the Autoscape team can review it.',
      ctaLabel: 'Resume quote',
      ctaHref: `/quote-confirmation/${quote.id}`
    };
  }

  if (quoteState === 'in_review') {
    return {
      title: 'Quote is in review',
      body: 'Your quote has been submitted. We will review the property details and follow up with final payment options within 24 hours.',
      ctaLabel: 'Open quote details',
      ctaHref: `/dashboard/quotes/${quote.id}`
    };
  }

  if (quoteState === 'waiting_for_payment') {
    return {
      title: 'Waiting for payment',
      body: 'Your quote is approved and ready for checkout. Review the selected plan and complete payment to lock in service.',
      ctaLabel: 'Open payment link',
      ctaHref: quote.paymentPageUrl ?? `/dashboard/quotes/${quote.id}/payment`
    };
  }

  return {
    title: 'All done',
    body:
      now.getMonth() < 4
        ? 'Your plan is paid and mowing starts the first week of May.'
        : 'Your plan is paid and ready for the current service season.',
    ctaLabel: 'Open quote details',
    ctaHref: `/dashboard/quotes/${quote.id}`
  };
};

const ActionLinkButton = ({
  href,
  label,
  secondary = false
}: {
  href: string;
  label: string;
  secondary?: boolean;
}) => (
  <Link to={href} className="w-full sm:w-auto">
    <Button variant={secondary ? 'secondary' : 'primary'} className="w-full sm:w-auto">
      {label}
    </Button>
  </Link>
);

export const DashboardPageContent = ({
  customerName,
  customerEmail,
  quotes,
  primaryQuote,
  primaryQuoteDetail,
  loading,
  error,
  primaryQuoteLoading,
  primaryQuoteError,
  billingPortalLoading,
  billingPortalError,
  onManageCard,
  now = new Date()
}: DashboardPageContentProps) => {
  const action = getDashboardActionContent(primaryQuote, now);
  const primaryQuoteState = primaryQuote ? getQuoteDashboardState(primaryQuote) : null;
  const activeQuote = primaryQuoteDetail ? normalizeDisplayQuote(primaryQuoteDetail) : primaryQuote ? normalizeDisplayQuote(primaryQuote) : null;
  const quoteHistory =
    primaryQuote && shouldShowQuoteHistory(quotes, primaryQuote)
      ? quotes.filter((quote) => quote.id !== primaryQuote.id)
      : [];
  const lifecycleStepIndex = primaryQuote ? getLifecycleStepIndex(primaryQuote) : 0;
  const cardOnFile = primaryQuoteDetail?.billing.cardOnFile ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-20">
      <section className="rounded-[1.75rem] bg-[#111813] px-5 py-7 text-white shadow-soft md:rounded-none md:px-10 md:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9fd8b0]">Customer dashboard</p>
        <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="w-full min-w-0 max-w-3xl sm:flex-1">
            <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl">{action.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 md:text-base">{action.body}</p>
            <p className="mt-4 break-words text-xs uppercase tracking-[0.14em] text-white/45">
              {customerName} · {customerEmail}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <ActionLinkButton href={action.ctaHref} label={action.ctaLabel} />
            <ActionLinkButton href="/dashboard/account" label="Manage account" secondary />
          </div>
        </div>
      </section>

      {loading ? <p className="mt-6 text-sm text-copy-muted">Loading your dashboard...</p> : null}
      {error ? <p className="mt-6 text-sm font-medium text-red-700">{error}</p> : null}

      {!loading ? (
        <div className="space-y-6">
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            {activeQuote ? (
              <Card className="bg-surface p-5 md:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-copy-soft">Active property</p>
                    <h2 className="mt-3 text-xl font-semibold leading-snug text-ink md:text-3xl">{activeQuote.address}</h2>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-copy-soft">
                      Quote ID: {activeQuote.id}
                    </p>
                  </div>

                  <div className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                    {primaryQuoteState === 'waiting_for_payment'
                      ? 'Waiting for payment'
                      : primaryQuoteState === 'in_review'
                        ? 'In review'
                        : primaryQuoteState === 'draft'
                          ? 'Needs submit'
                          : 'Paid'}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Billing plan</p>
                    <p className="mt-2 text-base font-semibold text-ink">
                      {activeQuote.billingMode === 'per_session' ? 'Per visit' : 'Per season'}
                    </p>
                    {shouldShowQuotePrice(activeQuote) ? (
                      <p className="mt-1 text-sm text-copy-muted">{getPlanPriceLabel(activeQuote)}</p>
                    ) : (
                      <p className="mt-1 text-sm text-copy-muted">Pricing appears after the quote is fully submitted.</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Current status</p>
                    <p className="mt-2 text-base font-semibold text-ink">{formatStatus(activeQuote.status)}</p>
                    <p className="mt-1 text-sm text-copy-muted">
                      {activeQuote.contactPending
                        ? 'Still waiting for the final submission handoff.'
                        : activeQuote.customerStatus
                          ? formatStatus(activeQuote.customerStatus)
                          : 'Pending'}
                    </p>
                  </div>
                </div>

                {shouldShowQuotePrice(activeQuote) ? (
                  <div className="mt-6 grid gap-4 border-t border-stroke pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Per visit</p>
                      <p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(activeQuote.perSessionTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Season total</p>
                      <p className="mt-2 text-lg font-semibold text-ink">
                        {formatCurrency(activeQuote.seasonalDiscountedTotal)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card className="bg-surface p-5 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-copy-soft">Dashboard</p>
                <h2 className="mt-3 text-2xl font-semibold text-ink">No active property yet</h2>
                <p className="mt-3 text-sm leading-7 text-copy-muted">
                  Once you submit a quote, this page will track review, payment, and season readiness for that property.
                </p>
                <div className="mt-6">
                  <ActionLinkButton href="/instant-quote" label="Start instant quote" secondary />
                </div>
              </Card>
            )}

            <Card className="bg-surface p-5 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-copy-soft">Account</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Profile and security</h2>
              <p className="mt-3 text-sm leading-7 text-copy-muted">
                Update your password, profile details, and security settings through Clerk.
              </p>
              <div className="mt-5 space-y-2 text-sm text-copy-muted">
                <p>{customerName}</p>
                <p>{customerEmail}</p>
              </div>
              <div className="mt-6">
                <ActionLinkButton href="/dashboard/account" label="Manage account" secondary />
              </div>
            </Card>
          </div>

          {primaryQuote && primaryQuoteState !== 'complete' ? (
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <Card className="bg-surface p-5 md:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Lifecycle</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Where your quote stands</h2>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {lifecycleSteps.map((step, index) => {
                    const isComplete = index < lifecycleStepIndex;
                    const isCurrent = index === lifecycleStepIndex;

                    return (
                      <div key={step} className="min-w-0">
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold ${
                            isComplete || isCurrent
                              ? 'border-brand bg-brand text-ink'
                              : 'border-stroke bg-surface-muted text-copy-soft'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-ink">{step}</p>
                        <p className="mt-1 text-sm text-copy-muted">
                          {isCurrent ? 'Current step' : isComplete ? 'Complete' : 'Up next'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="grid gap-6">
                <Card className="bg-surface p-5 md:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Season schedule</p>
                  <h2 className="mt-3 text-xl font-semibold text-ink">May through September</h2>
                  <p className="mt-3 text-sm leading-7 text-copy-muted">{getSeasonReadinessCopy(primaryQuote, now)}</p>
                </Card>

                <Card className="bg-surface p-5 md:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Need help?</p>
                  <h2 className="mt-3 text-xl font-semibold text-ink">Reach Autoscape directly</h2>
                  <div className="mt-4 space-y-2 text-sm text-copy-muted">
                    <p>
                      <a className="font-semibold text-ink hover:text-brand" href="tel:+14168482841">
                        +1 (416) 848-2841
                      </a>
                    </p>
                    <p>
                      <a className="font-semibold text-ink hover:text-brand" href="mailto:contact@autoscape.ca">
                        contact@autoscape.ca
                      </a>
                    </p>
                  </div>
                </Card>
              </div>
            </section>
          ) : null}

          {primaryQuoteState === 'complete' ? (
            <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <Card className="bg-surface p-5 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Plan summary</p>
                <h2 className="mt-3 text-xl font-semibold text-ink">
                  {primaryQuote?.billingMode === 'per_session' ? 'Per visit plan' : 'Seasonal plan'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-copy-muted">
                  {primaryQuote ? getSeasonReadinessCopy(primaryQuote, now) : null}
                </p>
                {activeQuote && shouldShowQuotePrice(activeQuote) ? (
                  <p className="mt-4 text-lg font-semibold text-ink">{getPlanPriceLabel(activeQuote)}</p>
                ) : null}
              </Card>

              <Card className="bg-surface p-5 md:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Need help?</p>
                <h2 className="mt-3 text-xl font-semibold text-ink">Reach Autoscape directly</h2>
                <div className="mt-4 space-y-2 text-sm text-copy-muted">
                  <p>
                    <a className="font-semibold text-ink hover:text-brand" href="tel:+14168482841">
                      +1 (416) 848-2841
                    </a>
                  </p>
                  <p>
                    <a className="font-semibold text-ink hover:text-brand" href="mailto:contact@autoscape.ca">
                      contact@autoscape.ca
                    </a>
                  </p>
                </div>
              </Card>

              {cardOnFile ? (
                <Card className="bg-surface p-5 md:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Card on file</p>
                  <h2 className="mt-3 text-xl font-semibold text-ink">
                    {cardOnFile.brand.charAt(0).toUpperCase() + cardOnFile.brand.slice(1)} ending in {cardOnFile.last4}
                  </h2>
                  <p className="mt-3 text-sm text-copy-muted">
                    Expires {String(cardOnFile.expMonth).padStart(2, '0')}/{cardOnFile.expYear}
                  </p>
                  <div className="mt-6">
                    <Button onClick={onManageCard} disabled={billingPortalLoading}>
                      {billingPortalLoading ? 'Opening Stripe...' : 'Manage card'}
                    </Button>
                  </div>
                  {billingPortalError ? <p className="mt-4 text-sm font-medium text-red-700">{billingPortalError}</p> : null}
                </Card>
              ) : null}
            </section>
          ) : null}

          {primaryQuoteLoading ? <p className="text-sm text-copy-muted">Loading billing details...</p> : null}
          {primaryQuoteError ? <p className="text-sm text-copy-muted">{primaryQuoteError}</p> : null}

          {quoteHistory.length > 0 ? (
            <Card className="bg-surface p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">Quote history</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Other quotes on this account</h2>
                </div>
                <ActionLinkButton href="/instant-quote" label="Create new quote" secondary />
              </div>

              <div className="mt-6 grid gap-3">
                {quoteHistory.map((quote) => {
                  const quoteState = getQuoteDashboardState(quote);
                  return (
                    <Link key={quote.id} to={`/dashboard/quotes/${quote.id}`}>
                      <article className="rounded-xl border border-stroke bg-surface-raised p-4 transition-colors hover:border-brand/45">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">{quote.address}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-copy-soft">
                              Quote ID: {quote.id}
                            </p>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copy-soft">
                            {quoteState === 'waiting_for_payment'
                              ? 'Waiting for payment'
                              : quoteState === 'in_review'
                                ? 'In review'
                                : quoteState === 'draft'
                                  ? 'Needs submit'
                                  : 'Paid'}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-copy-muted">
                          <span>{quote.billingMode === 'per_session' ? 'Per visit' : 'Per season'}</span>
                          {shouldShowQuotePrice(quote) ? <span>{getPlanPriceLabel(quote)}</span> : null}
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {!loading && quotes.length === 0 ? (
            <Card className="bg-surface p-7">
              <p className="text-sm text-copy-muted">
                No quotes yet. Start your first instant quote to get an address-based property review and pricing.
              </p>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const DashboardPage = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();
  const [quotes, setQuotes] = useState<AccountQuoteListItem[]>([]);
  const [primaryQuoteDetail, setPrimaryQuoteDetail] = useState<NormalizedAccountQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primaryQuoteLoading, setPrimaryQuoteLoading] = useState(false);
  const [primaryQuoteError, setPrimaryQuoteError] = useState<string | null>(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [billingPortalError, setBillingPortalError] = useState<string | null>(null);
  const profileHasRequiredPhone = hasRequiredPhone(user);

  const customerName = user?.fullName?.trim() || user?.firstName?.trim() || 'Autoscape Customer';
  const customerEmail = user?.primaryEmailAddress?.emailAddress ?? 'No email on file';
  const primaryQuote = useMemo(() => selectPrimaryDashboardQuote(quotes), [quotes]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !profileHasRequiredPhone) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      setPrimaryQuoteError(null);
      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        const response = await api.getAccountQuotes(token);
        if (!mounted) {
          return;
        }

        setQuotes(response.items);
      } catch (loadError) {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof ApiError ? loadError.message : 'Unable to load account quotes.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn, getToken, profileHasRequiredPhone]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !profileHasRequiredPhone) {
      setPrimaryQuoteDetail(null);
      setPrimaryQuoteLoading(false);
      return;
    }

    if (!primaryQuote) {
      setPrimaryQuoteDetail(null);
      setPrimaryQuoteLoading(false);
      setPrimaryQuoteError(null);
      return;
    }

    let mounted = true;

    const loadPrimaryQuote = async () => {
      setPrimaryQuoteLoading(true);
      setPrimaryQuoteError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new ApiError('Authentication is required.', 401);
        }

        const result = await api.getAccountQuote(primaryQuote.id, token);
        if (!mounted) {
          return;
        }

        setPrimaryQuoteDetail(normalizeAccountQuote(result));
      } catch (quoteError) {
        if (!mounted) {
          return;
        }

        setPrimaryQuoteDetail(null);
        setPrimaryQuoteError(
          quoteError instanceof ApiError ? quoteError.message : 'Unable to load billing details for this quote.'
        );
      } finally {
        if (mounted) {
          setPrimaryQuoteLoading(false);
        }
      }
    };

    void loadPrimaryQuote();

    return () => {
      mounted = false;
    };
  }, [primaryQuote?.id, isLoaded, isSignedIn, profileHasRequiredPhone, getToken]);

  const handleManageCard = async () => {
    if (!primaryQuote) {
      return;
    }

    setBillingPortalLoading(true);
    setBillingPortalError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new ApiError('Authentication is required.', 401);
      }

      const result = await api.createAccountQuoteBillingPortal(primaryQuote.id, token);
      window.location.assign(result.portalUrl);
    } catch (portalError) {
      setBillingPortalError(portalError instanceof ApiError ? portalError.message : 'Unable to open Stripe right now.');
    } finally {
      setBillingPortalLoading(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="space-y-5 bg-surface p-8">
          <h1 className="text-3xl font-semibold text-ink">Sign in to access your dashboard</h1>
          <div className="flex flex-wrap gap-3">
            <Link to="/sign-in">
              <Button>Sign In</Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="secondary">Create Account</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoaded && isSignedIn && !profileHasRequiredPhone) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 md:px-8 md:py-20">
        <Card className="space-y-5 bg-surface p-8">
          <h1 className="text-3xl font-semibold text-ink">Phone number required</h1>
          <p className="text-sm text-copy-muted">Add your phone number to unlock dashboard access.</p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/complete-profile?redirect_url=${redirectPath}`}>
              <Button>Complete Profile</Button>
            </Link>
            <Link to="/instant-quote">
              <Button variant="secondary">Back to quote builder</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <DashboardPageContent
      customerName={customerName}
      customerEmail={customerEmail}
      quotes={quotes}
      primaryQuote={primaryQuote}
      primaryQuoteDetail={primaryQuoteDetail}
      loading={loading}
      error={error}
      primaryQuoteLoading={primaryQuoteLoading}
      primaryQuoteError={primaryQuoteError}
      billingPortalLoading={billingPortalLoading}
      billingPortalError={billingPortalError}
      onManageCard={handleManageCard}
    />
  );
};
