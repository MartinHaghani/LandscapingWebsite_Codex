export const LEGAL_DOCUMENT_VERSION = 'May 1, 2026';

export const LEGAL_ACCEPTANCE_DOCUMENTS = {
  contact_privacy_ack: ['privacy-policy'],
  complete_profile_terms: ['terms-of-service', 'privacy-policy'],
  quote_submit_terms: [
    'terms-of-service',
    'privacy-policy',
    'estimate-booking-terms',
    'service-disclaimer',
    'ai-automation-disclaimer',
    'service-area-disclaimer'
  ],
  quote_claim_terms: [
    'terms-of-service',
    'privacy-policy',
    'estimate-booking-terms',
    'refund-cancellation-payment-policy'
  ],
  payment_checkout_terms: [
    'terms-of-service',
    'refund-cancellation-payment-policy',
    'estimate-booking-terms'
  ]
} as const;

export type LegalAcceptanceAction = keyof typeof LEGAL_ACCEPTANCE_DOCUMENTS;
