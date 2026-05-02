import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { PaymentCompletePage, paymentCompleteMessage } from './PaymentCompletePage';

describe('PaymentCompletePage', () => {
  it('renders the shared post-checkout thank-you page', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/payment-complete">
        <PaymentCompletePage />
      </StaticRouter>
    );

    expect(markup).toContain('Payment Complete');
    expect(markup).toContain(paymentCompleteMessage);
    expect(markup).toContain('Stripe Checkout');
    expect(markup).toContain('href="/dashboard"');
    expect(markup).not.toContain('Approved Quote Payment');
    expect(markup).not.toContain('All done');
  });
});
