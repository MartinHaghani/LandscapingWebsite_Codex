export type ApprovedQuoteEmailPaymentMode = 'seasonal_payment' | 'per_session_subscription';
export type ApprovedQuoteEmailVariant = 'verified_quote' | 'prepared_quote';

export interface ApprovedQuoteEmailPaymentSummary {
  mode: ApprovedQuoteEmailPaymentMode;
  amountCents: number;
  currency: string;
}

export interface ApprovedQuoteEmailMapLegend {
  hasAddedArea: boolean;
  hasRemovedArea: boolean;
}

export interface ApprovedQuoteEmailTemplateInput {
  variant?: ApprovedQuoteEmailVariant;
  quoteId: string;
  recipientName: string | null;
  addressText: string;
  serviceFrequency: 'weekly';
  sessionsMax: number;
  payment: ApprovedQuoteEmailPaymentSummary;
  mapLegend?: ApprovedQuoteEmailMapLegend;
  paymentPageUrl: string;
  previewImageUrl: string;
}

export interface ApprovedQuoteEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ApprovedQuoteEmailSendResult {
  provider: 'resend';
  messageId: string | null;
}

export interface ApprovedQuoteEmailSender {
  send(message: ApprovedQuoteEmailMessage): Promise<ApprovedQuoteEmailSendResult>;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const toCurrencyFromCents = (amountCents: number, currency: string) =>
  toCurrency(amountCents / 100, currency.trim().toUpperCase() || 'CAD');

const getGreetingName = (recipientName: string | null) => {
  const trimmed = recipientName?.trim();
  if (!trimmed) {
    return 'there';
  }

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first && first.length > 0 ? first : 'there';
};

const getPaymentSummaryCopy = (input: ApprovedQuoteEmailTemplateInput, variant: ApprovedQuoteEmailVariant) => {
  const visitsDescriptor = variant === 'prepared_quote' ? 'planned' : 'approved';

  if (input.payment.mode === 'per_session_subscription') {
    return {
      label: 'Weekly per-visit payment',
      body: `Charged weekly, capped at ${input.sessionsMax} visits.`,
      billingNote: `Weekly billing is capped at ${input.sessionsMax} ${visitsDescriptor} visits for the season.`
    };
  }

  return {
    label: 'Seasonal payment',
    body: `${input.sessionsMax} ${visitsDescriptor} weekly visits paid upfront.`,
    billingNote: `One secure payment covers ${input.sessionsMax} ${visitsDescriptor} weekly visits for the season.`
  };
};

const buildLegendItem = (color: string, border: string, label: string) => `
  <td style="padding:0 16px 8px 0;font-size:12px;line-height:18px;color:#4D5F53;white-space:nowrap;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${color};border:${border};vertical-align:-1px;margin-right:7px;"></span>${label}
  </td>
`;

export const buildApprovedQuoteEmail = (
  input: ApprovedQuoteEmailTemplateInput
): ApprovedQuoteEmailMessage => {
  const variant = input.variant ?? 'verified_quote';
  const isPreparedQuote = variant === 'prepared_quote';
  const greetingName = escapeHtml(getGreetingName(input.recipientName));
  const subject = isPreparedQuote
    ? 'Your Autoscape quote is ready to view'
    : 'Your Autoscape quote is ready for payment';
  const preheader = isPreparedQuote
    ? 'Autoscape prepared your lawn care quote. View the details and choose payment when you are ready.'
    : 'Your approved lawn care quote is ready. Review the map and pay securely through Autoscape.';
  const statusLabel = isPreparedQuote ? 'Quote prepared' : 'Quote approved';
  const headline = isPreparedQuote
    ? 'Your Autoscape quote is ready to view.'
    : 'Your approved quote is ready for payment.';
  const introCopy = isPreparedQuote
    ? 'The Autoscape team mapped your lawn and prepared your quote. View the details below, then continue when you are ready.'
    : 'The Autoscape team has reviewed your lawn area. Review the approved map below, then continue to the secure payment page when you are ready.';
  const ctaLabel = isPreparedQuote ? 'View your quote' : 'Review and pay securely';
  const mapAltText = isPreparedQuote ? 'Prepared quote map preview' : 'Approved quote map preview';
  const paymentCopy = getPaymentSummaryCopy(input, variant);
  const paymentAmount = toCurrencyFromCents(input.payment.amountCents, input.payment.currency);
  const cadenceLabel = input.serviceFrequency === 'weekly' ? 'Weekly service' : input.serviceFrequency;
  const scheduleLabel = `${cadenceLabel}, May to September`;
  const mapLegendItems = isPreparedQuote
    ? ''
    : [
        buildLegendItem('#329F5B', '0', 'Approved service area'),
        input.mapLegend?.hasAddedArea ? buildLegendItem('#BFEBCF', '1px solid #FFFFFF', 'Added after review') : null,
        input.mapLegend?.hasRemovedArea ? buildLegendItem('#DC2626', '0', 'Removed after review') : null
      ]
        .filter((item): item is string => item !== null)
        .join('');
  const mapLegendMarkup = isPreparedQuote
    ? ''
    : `
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:12px;">
                  <tr>${mapLegendItems}</tr>
                </table>`;
  const actionBlockMarkup = isPreparedQuote
    ? `
                      <a href="${escapeHtml(input.paymentPageUrl)}" style="display:inline-block;background:#329F5B;color:#FFFFFF;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:999px;padding:14px 22px;">${escapeHtml(ctaLabel)}</a>`
    : `
                      <p style="margin:0 0 8px;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#329F5B;">${escapeHtml(paymentCopy.label)}</p>
                      <p style="margin:0;font-size:42px;line-height:48px;font-weight:700;color:#101713;">${escapeHtml(paymentAmount)}</p>
                      <p style="margin:10px 0 22px;font-size:14px;line-height:22px;color:#4D5F53;">${escapeHtml(paymentCopy.body)}</p>
                      <a href="${escapeHtml(input.paymentPageUrl)}" style="display:inline-block;background:#329F5B;color:#FFFFFF;font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:999px;padding:14px 22px;">${escapeHtml(ctaLabel)}</a>`;
  const billingDetailsRow = isPreparedQuote
    ? ''
    : `
                  <tr>
                    <td style="width:34%;padding:10px 20px 18px;border-top:1px solid #EFEADD;font-size:13px;line-height:20px;color:#6C7B71;">Billing</td>
                    <td style="padding:10px 20px 18px;border-top:1px solid #EFEADD;font-size:14px;line-height:21px;color:#101713;font-weight:700;">${escapeHtml(paymentCopy.billingNote)}</td>
                  </tr>`;
  const actionSectionMarkup = isPreparedQuote
    ? `
            <tr>
              <td align="center" style="padding:30px 28px 10px;background:#FFFFFF;">
${actionBlockMarkup}
              </td>
            </tr>`
    : `
            <tr>
              <td style="padding:24px 28px 0;background:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FCFAF5;border:1px solid #D6D7CF;border-radius:8px;">
                  <tr>
                    <td style="padding:22px 22px 24px;">
${actionBlockMarkup}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;

  const html = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;mso-hide:all;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background:#F7F4EE;font-family:Arial,Helvetica,sans-serif;color:#101713;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid #D6D7CF;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#101713;padding:24px 28px;color:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:18px;line-height:24px;font-weight:700;letter-spacing:0.01em;">Autoscape</td>
                    <td align="right" style="font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9FD8B0;">${escapeHtml(statusLabel)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 28px 0;background:#FFFFFF;">
                <p style="margin:0 0 10px;font-size:15px;line-height:24px;color:#233227;">Hi ${greetingName},</p>
                <h1 style="margin:0;font-size:30px;line-height:38px;font-weight:700;color:#101713;">${escapeHtml(headline)}</h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:25px;color:#4D5F53;">${escapeHtml(introCopy)}</p>
              </td>
            </tr>

${actionSectionMarkup}

            <tr>
              <td style="padding:24px 28px 0;background:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #D6D7CF;border-radius:8px;overflow:hidden;background:#F5F2EA;">
                  <tr>
                    <td>
                      <img src="${escapeHtml(input.previewImageUrl)}" alt="${escapeHtml(mapAltText)}" width="600" height="380" style="display:block;width:100%;height:auto;background:#D6D7CF;border:0;" />
                    </td>
                  </tr>
                </table>
${mapLegendMarkup}
              </td>
            </tr>

            <tr>
              <td style="padding:22px 28px 0;background:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #D6D7CF;border-radius:8px;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td colspan="2" style="padding:18px 20px 10px;font-size:12px;line-height:18px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#6C7B71;">Quote details</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:10px 20px;border-top:1px solid #EFEADD;font-size:13px;line-height:20px;color:#6C7B71;">Service address</td>
                    <td style="padding:10px 20px;border-top:1px solid #EFEADD;font-size:14px;line-height:21px;color:#101713;font-weight:700;">${escapeHtml(input.addressText)}</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:10px 20px;border-top:1px solid #EFEADD;font-size:13px;line-height:20px;color:#6C7B71;">Quote ID</td>
                    <td style="padding:10px 20px;border-top:1px solid #EFEADD;font-size:14px;line-height:21px;color:#101713;font-weight:700;">${escapeHtml(input.quoteId)}</td>
                  </tr>
                  <tr>
                    <td style="width:34%;padding:10px 20px;border-top:1px solid #EFEADD;font-size:13px;line-height:20px;color:#6C7B71;">Schedule</td>
                    <td style="padding:10px 20px;border-top:1px solid #EFEADD;font-size:14px;line-height:21px;color:#101713;font-weight:700;">${escapeHtml(scheduleLabel)}</td>
                  </tr>
${billingDetailsRow}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px 28px;background:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #D6D7CF;">
                  <tr>
                    <td style="padding-top:18px;font-size:13px;line-height:21px;color:#4D5F53;">
                      Payment is processed by Stripe. Autoscape does not store card details.<br />
                      Questions? Reply to this email or contact contact@autoscape.ca.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `.trim();

  const text = isPreparedQuote
    ? [
        `Hi ${getGreetingName(input.recipientName)},`,
        '',
        'Your Autoscape quote is ready to view.',
        '',
        `Quote page: ${input.paymentPageUrl}`,
        '',
        `Address: ${input.addressText}`,
        `Quote ID: ${input.quoteId}`,
        `Schedule: ${scheduleLabel} (${input.sessionsMax} visits)`,
        '',
        'Payment is processed by Stripe. Autoscape does not store card details.',
        'Questions? Reply to this email or contact contact@autoscape.ca.'
      ].join('\n')
    : [
        `Hi ${getGreetingName(input.recipientName)},`,
        '',
        'Your approved Autoscape quote is ready for payment.',
        '',
        `Payment page: ${input.paymentPageUrl}`,
        '',
        `Amount due: ${paymentAmount}`,
        `Payment type: ${paymentCopy.label}`,
        `Address: ${input.addressText}`,
        `Quote ID: ${input.quoteId}`,
        `Schedule: ${scheduleLabel} (${input.sessionsMax} visits)`,
        `Billing note: ${paymentCopy.billingNote}`,
        '',
        'Payment is processed by Stripe. Autoscape does not store card details.',
        'Questions? Reply to this email or contact contact@autoscape.ca.'
      ].join('\n');

  return {
    to: '',
    subject,
    html,
    text
  };
};

export class ApprovedQuoteEmailSendError extends Error {}

export const createResendApprovedQuoteEmailSender = (config?: {
  apiKey?: string | null;
  from?: string | null;
  replyTo?: string | null;
  fetchImpl?: typeof fetch;
}): ApprovedQuoteEmailSender => {
  const apiKey = config?.apiKey?.trim() || process.env.RESEND_API_KEY?.trim() || '';
  const from = config?.from?.trim() || process.env.APPROVED_QUOTE_EMAIL_FROM?.trim() || 'Autoscape <contact@autoscape.ca>';
  const replyTo =
    config?.replyTo?.trim() || process.env.APPROVED_QUOTE_EMAIL_REPLY_TO?.trim() || 'contact@autoscape.ca';
  const fetchImpl = config?.fetchImpl ?? fetch;

  return {
    async send(message) {
      if (!apiKey) {
        throw new ApprovedQuoteEmailSendError('RESEND_API_KEY is not configured.');
      }

      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          reply_to: replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text
        })
      });

      const body = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new ApprovedQuoteEmailSendError(
          body.error?.message ?? body.message ?? `Resend email send failed with status ${response.status}.`
        );
      }

      return {
        provider: 'resend',
        messageId: body.id ?? null
      };
    }
  };
};
