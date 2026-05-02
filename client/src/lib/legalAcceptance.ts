export const legalAcceptancePayload = { accepted: true } as const;

export type LegalAcceptancePayload = typeof legalAcceptancePayload;

export const legalDocumentSlugs = {
  contactPrivacy: ['privacy-policy'],
  completeProfile: ['terms-of-service', 'privacy-policy'],
  quoteSubmit: [
    'terms-of-service',
    'privacy-policy',
    'estimate-booking-terms',
    'service-disclaimer',
    'ai-automation-disclaimer',
    'service-area-disclaimer'
  ],
  quoteClaim: [
    'terms-of-service',
    'privacy-policy',
    'estimate-booking-terms',
    'refund-cancellation-payment-policy'
  ],
  paymentCheckout: [
    'terms-of-service',
    'refund-cancellation-payment-policy',
    'estimate-booking-terms'
  ]
} as const;
