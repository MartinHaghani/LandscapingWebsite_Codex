import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  QuoteConfirmationContent,
  QuoteConfirmationPage,
  shouldTrackQuoteInReviewConversion
} from './QuoteConfirmationPage';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn()
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: {
        emailAddress: 'client@example.com'
      },
      primaryPhoneNumber: {
        phoneNumber: '+1 416 555 0100'
      },
      unsafeMetadata: {}
    }
  })
}));

const renderQuoteConfirmationPage = () =>
  renderToStaticMarkup(
    <StaticRouter location="/quote-confirmation/Q-ABC12345">
      <QuoteConfirmationContent
        loading={false}
        finalizing={false}
        error={null}
        customerEmail="client@example.com"
        quote={{
          id: 'Q-ABC12345',
          createdAt: '2026-04-16T12:00:00.000Z',
          address: '123 Greenway Blvd, Vaughan, ON',
          metrics: {
            areaM2: 420,
            perimeterM: 96
          },
          plan: 'Premium Weekly',
          serviceFrequency: 'weekly',
          sessionsMin: 20,
          sessionsMax: 20,
          perSessionTotal: 72.5,
          seasonalTotalMin: 1450,
          seasonalTotalMax: 1450,
          fullSeasonTotal: 1450,
          seasonalDiscountedTotal: 1160,
          seasonalSavingsTotal: 290,
          seasonalDiscountRate: 0.2,
          billingMode: 'seasonal',
          quoteTotal: 72.5,
          status: 'in_review',
          contactPending: false,
          submittedAt: '2026-04-16T12:05:00.000Z'
        }}
      />
    </StaticRouter>
  );

describe('QuoteConfirmationPage', () => {
  it('renders one simplified two-column confirmation block', () => {
    const markup = renderQuoteConfirmationPage();

    expect(markup).toContain('Instant Quote Confirmation');
    expect(markup).toContain('Your quote is in review.');
    expect(markup).toContain('You are done.');
    expect(markup).toContain('What happens next');
    expect(markup).toContain('We will review your quote within');
    expect(markup).toContain('client@example.com');
    expect(markup.indexOf('Your quote is in review.')).toBeLessThan(markup.indexOf('Quote ID'));
    expect(markup).toContain('Quote ID');
    expect(markup).toContain('View quote in dashboard');
    expect(markup).toContain('spam or junk');
    expect(markup).not.toContain('Confirmation email');
    expect(markup).not.toContain('Saved to your account');
    expect(markup).not.toContain('Service address');
    expect(markup).not.toContain('Selected billing option');
    expect(markup).not.toContain('Estimate snapshot');
    expect(markup).not.toContain('Build another quote');
    expect(markup).not.toContain('Quote Submitted');
    expect(markup).not.toContain('Contact finalized:');
    expect(markup).not.toContain('Area:');
    expect(markup).not.toContain('Perimeter:');
    expect(markup).not.toContain('Status:');
    expect(markup).not.toContain('Draft created:');
    expect(markup).not.toContain('Submitted:');
    expect(markup).not.toContain('Email sent');
    expect(markup).not.toContain('Payment ready');
  });

  it('requires quote claim terms before finalizing the signed-in quote', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/quote-confirmation/Q-ABC12345">
        <Routes>
          <Route path="/quote-confirmation/:quoteId" element={<QuoteConfirmationPage />} />
        </Routes>
      </StaticRouter>
    );

    expect(markup).toContain('Review the quote terms to continue');
    expect(markup).toContain('id="quote-claim-legal-acceptance"');
    expect(markup).toContain('href="/legal/refund-cancellation-payment-policy"');
    expect(markup).toContain('Claim Quote');
    expect(markup).toContain('disabled=""');
  });

  it('tracks Google Ads conversion only once the quote is in review', () => {
    expect(
      shouldTrackQuoteInReviewConversion({
        quote: {
          status: 'in_review',
          contactPending: false
        },
        loading: false,
        finalizing: false,
        error: null
      })
    ).toBe(true);

    expect(
      shouldTrackQuoteInReviewConversion({
        quote: {
          status: 'draft',
          contactPending: true
        },
        loading: false,
        finalizing: false,
        error: null
      })
    ).toBe(false);
  });
});
