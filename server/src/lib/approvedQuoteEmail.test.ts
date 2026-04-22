import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildApprovedQuoteEmail,
  type ApprovedQuoteEmailTemplateInput
} from './approvedQuoteEmail.js';

const paymentPageUrl = 'https://client.autoscape.test/pay/payment-token';
const previewImageUrl = 'https://api.autoscape.test/api/approved-quote-preview/map-token';

const countOccurrences = (value: string, search: string) => value.split(search).length - 1;

const baseInput = (overrides: Partial<ApprovedQuoteEmailTemplateInput> = {}): ApprovedQuoteEmailTemplateInput => ({
  quoteId: 'AS-2026-1001',
  recipientName: 'Martin Haghani',
  addressText: '88 Review Crescent, Vaughan, ON',
  serviceFrequency: 'weekly',
  sessionsMax: 20,
  payment: {
    mode: 'seasonal_payment',
    amountCents: 319984,
    currency: 'CAD'
  },
  mapLegend: {
    hasAddedArea: false,
    hasRemovedArea: false
  },
  paymentPageUrl,
  previewImageUrl,
  ...overrides
});

describe('buildApprovedQuoteEmail', () => {
  it('renders the seasonal payment amount without alternate price clutter', () => {
    const message = buildApprovedQuoteEmail(baseInput());

    assert.equal(message.subject, 'Your Autoscape quote is ready for payment');
    assert.match(message.html, /\$3,199\.84/);
    assert.match(message.html, /Seasonal payment/);
    assert.match(message.html, /20 approved weekly visits paid upfront/);
    assert.doesNotMatch(message.html, /Per visit/i);
    assert.doesNotMatch(message.html, /Regular season/i);
    assert.doesNotMatch(message.html, /Savings/i);
  });

  it('renders per-session payment copy and visit cap language', () => {
    const message = buildApprovedQuoteEmail(
      baseInput({
        payment: {
          mode: 'per_session_subscription',
          amountCents: 19999,
          currency: 'CAD'
        }
      })
    );

    assert.match(message.html, /\$199\.99/);
    assert.match(message.html, /Weekly per-visit payment/);
    assert.match(message.html, /Charged weekly, capped at 20 visits/);
    assert.match(message.html, /Weekly billing is capped at 20 approved visits/);
    assert.doesNotMatch(message.html, /Seasonal payment/);
  });

  it('includes exactly one payment CTA in HTML and one payment URL in text', () => {
    const message = buildApprovedQuoteEmail(baseInput());

    assert.equal(countOccurrences(message.html, `href="${paymentPageUrl}"`), 1);
    assert.equal(countOccurrences(message.html, 'Review and pay securely'), 1);
    assert.equal(countOccurrences(message.html, '<a href='), 1);
    assert.equal(countOccurrences(message.text, paymentPageUrl), 1);
  });

  it('keeps the approved quote preview image source unchanged', () => {
    const message = buildApprovedQuoteEmail(baseInput());

    assert.match(message.html, new RegExp(`src="${previewImageUrl}"`));
    assert.match(message.html, /Approved quote map preview/);
  });

  it('renders added and removed legend items only when present', () => {
    const baseMessage = buildApprovedQuoteEmail(baseInput());
    assert.match(baseMessage.html, /Approved service area/);
    assert.doesNotMatch(baseMessage.html, /Added after review/);
    assert.doesNotMatch(baseMessage.html, /Removed after review/);

    const changedMessage = buildApprovedQuoteEmail(
      baseInput({
        mapLegend: {
          hasAddedArea: true,
          hasRemovedArea: true
        }
      })
    );
    assert.match(changedMessage.html, /Approved service area/);
    assert.match(changedMessage.html, /Added after review/);
    assert.match(changedMessage.html, /Removed after review/);
  });

  it('escapes customer-controlled fields in the HTML email', () => {
    const message = buildApprovedQuoteEmail(
      baseInput({
        quoteId: 'Q<&>"\'',
        recipientName: '<Martin> Test',
        addressText: '5 & 7 <Lawn> "Ave"'
      })
    );

    assert.match(message.html, /Hi &lt;Martin&gt;,/);
    assert.match(message.html, /5 &amp; 7 &lt;Lawn&gt; &quot;Ave&quot;/);
    assert.match(message.html, /Q&lt;&amp;&gt;&quot;&#39;/);
    assert.doesNotMatch(message.html, /5 & 7 <Lawn> "Ave"/);
  });
});
