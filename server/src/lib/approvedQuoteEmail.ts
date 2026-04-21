export interface ApprovedQuoteEmailTemplateInput {
  quoteId: string;
  recipientName: string | null;
  addressText: string;
  serviceFrequency: 'weekly';
  sessionsMin: number;
  sessionsMax: number;
  perSessionTotal: number;
  seasonalDiscountedTotal: number;
  fullSeasonTotal: number;
  seasonalSavingsTotal: number;
  seasonalDiscountRate: number;
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

const toCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 2
  }).format(value);

const toPercent = (value: number) => `${Math.round(value * 100)}%`;

const getGreetingName = (recipientName: string | null) => {
  const trimmed = recipientName?.trim();
  if (!trimmed) {
    return 'there';
  }

  const first = trimmed.split(/\s+/)[0]?.trim();
  return first && first.length > 0 ? first : 'there';
};

export const buildApprovedQuoteEmail = (
  input: ApprovedQuoteEmailTemplateInput
): ApprovedQuoteEmailMessage => {
  const greetingName = escapeHtml(getGreetingName(input.recipientName));
  const subject = 'Quote Approved, Payment Required';
  const cadenceLabel = input.serviceFrequency === 'weekly' ? 'Weekly service' : input.serviceFrequency;
  const pricingAdjustmentCopy =
    'Our team may slightly adjust the measured service area after review to match the real mowable footprint, obstacles, and edge conditions on the property. That review can change the final approved pricing compared with the instant estimate.';
  const html = `
    <div style="margin:0;padding:24px;background:#f3f4ee;font-family:Arial,sans-serif;color:#101418;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9ded7;border-radius:24px;overflow:hidden;">
        <div style="padding:28px 28px 12px;background:linear-gradient(180deg,#0f1712 0%,#1d2c21 100%);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#9fd8b0;">Payment Required</p>
          <h1 style="margin:0;font-size:32px;line-height:1.12;">Quote approved. Payment is the next step.</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#d7e6da;">Hi ${greetingName}, your quote has been reviewed and approved by the Autoscape team. Please use the payment button below to continue.</p>
        </div>

        <div style="padding:28px;">
          <div style="margin:0 0 26px;padding:24px;border:2px solid #329f5b;border-radius:24px;background:#eef8f1;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#257644;font-weight:800;">Payment Required To Continue</p>
            <p style="margin:0 auto 18px;max-width:520px;font-size:18px;line-height:1.55;color:#102018;font-weight:700;">Your approved quote is ready. Open the payment page to review the final details and continue with Autoscape.</p>
            <a
              href="${escapeHtml(input.paymentPageUrl)}"
              style="display:inline-block;padding:18px 30px;border-radius:999px;background:#329f5b;color:#ffffff;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(50,159,91,0.32);"
            >PAYMENT BUTTON - CONTINUE TO PAYMENT</a>
            <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#4d5e54;">This secure link opens your approved quote payment page.</p>
          </div>

          <div style="border:1px solid #d9ded7;border-radius:20px;overflow:hidden;background:#f7f8f5;">
            <img
              src="${escapeHtml(input.previewImageUrl)}"
              alt="Approved quote map preview"
              width="600"
              height="380"
              style="display:block;width:100%;height:auto;background:#dbe6d8;"
            />
          </div>

          <div style="margin-top:14px;display:flex;gap:16px;flex-wrap:wrap;font-size:13px;line-height:1.5;color:#44514a;">
            <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:999px;background:#329f5b;display:inline-block;"></span>Approved service area</span>
            <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:999px;background:#bfebcf;display:inline-block;border:1px solid #ffffff;"></span>Added by admin review</span>
            <span style="display:inline-flex;align-items:center;gap:8px;"><span style="width:12px;height:12px;border-radius:999px;background:#dc2626;display:inline-block;"></span>Removed by admin review</span>
          </div>

          <p style="margin:16px 0 0;font-size:14px;line-height:1.8;color:#44514a;">${escapeHtml(pricingAdjustmentCopy)}</p>

          <div style="margin-top:22px;border:1px solid #d9ded7;border-radius:20px;padding:20px;background:#fbfcfa;">
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#5f6f66;">Quote Summary</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#44514a;"><strong>Quote ID:</strong> ${escapeHtml(input.quoteId)}</p>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#44514a;"><strong>Address:</strong> ${escapeHtml(input.addressText)}</p>

            <div style="display:flex;gap:14px;flex-wrap:wrap;">
              <div style="flex:1 1 180px;min-width:180px;border:1px solid #d9ded7;border-radius:16px;padding:16px;background:#ffffff;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#718277;">Per Visit</p>
                <p style="margin:10px 0 0;font-size:30px;line-height:1.1;color:#101418;font-weight:700;">${escapeHtml(toCurrency(input.perSessionTotal))}</p>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#56655d;">${escapeHtml(cadenceLabel)}</p>
              </div>

              <div style="flex:1 1 180px;min-width:180px;border:1px solid #d9ded7;border-radius:16px;padding:16px;background:#ffffff;">
                <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#718277;">Per Season</p>
                <p style="margin:10px 0 0;font-size:30px;line-height:1.1;color:#101418;font-weight:700;">${escapeHtml(toCurrency(input.seasonalDiscountedTotal))}</p>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#56655d;">${input.sessionsMax} visits with ${escapeHtml(toPercent(input.seasonalDiscountRate))} seasonal savings</p>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#56655d;">Regular season price ${escapeHtml(toCurrency(input.fullSeasonTotal))} · Savings ${escapeHtml(toCurrency(input.seasonalSavingsTotal))}</p>
              </div>
            </div>
          </div>

          <div style="margin-top:24px;text-align:center;border-top:1px solid #d9ded7;padding-top:24px;">
            <p style="margin:0 0 12px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#257644;font-weight:800;">Payment Required</p>
            <a
              href="${escapeHtml(input.paymentPageUrl)}"
              style="display:inline-block;padding:16px 28px;border-radius:999px;background:#329f5b;color:#ffffff;font-size:17px;font-weight:800;text-decoration:none;box-shadow:0 10px 24px rgba(50,159,91,0.26);"
            >PAYMENT BUTTON - OPEN PAYMENT PAGE</a>
            <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#5a6861;">This button opens your secure approved quote payment page.</p>
          </div>
        </div>
      </div>
    </div>
  `.trim();

  const text = [
    `Hi ${getGreetingName(input.recipientName)},`,
    '',
    `Your Autoscape quote ${input.quoteId} is approved. Payment is required to continue.`,
    '',
    `Payment button / payment page: ${input.paymentPageUrl}`,
    '',
    `Address: ${input.addressText}`,
    `Per visit: ${toCurrency(input.perSessionTotal)}`,
    `Per season: ${toCurrency(input.seasonalDiscountedTotal)}`,
    `Regular season price: ${toCurrency(input.fullSeasonTotal)}`,
    `Seasonal savings: ${toCurrency(input.seasonalSavingsTotal)} (${toPercent(input.seasonalDiscountRate)})`,
    '',
    pricingAdjustmentCopy,
    '',
    `Use the payment button above to open your secure approved quote payment page.`
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
