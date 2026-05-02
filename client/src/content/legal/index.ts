import acceptableUsePolicy from './acceptable-use-policy.md?raw';
import accessibilityStatement from './accessibility-statement.md?raw';
import aiAutomationDisclaimer from './ai-automation-disclaimer.md?raw';
import cookiePolicy from './cookie-policy.md?raw';
import estimateBookingTerms from './estimate-booking-terms.md?raw';
import privacyPolicy from './privacy-policy.md?raw';
import refundCancellationPaymentPolicy from './refund-cancellation-payment-policy.md?raw';
import serviceAreaDisclaimer from './service-area-disclaimer.md?raw';
import serviceDisclaimer from './service-disclaimer.md?raw';
import smsEmailPolicy from './sms-email-policy.md?raw';
import termsOfService from './terms-of-service.md?raw';
import thirdPartyServicesDisclosure from './third-party-services-disclosure.md?raw';

export interface LegalDocument {
  slug: string;
  title: string;
  summary: string;
  content: string;
}

export const legalDocuments: LegalDocument[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    summary: 'How Autoscape collects, uses, discloses, and protects website and quote information.',
    content: privacyPolicy
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    summary: 'Website, account, quote, service, payment, and customer responsibility terms.',
    content: termsOfService
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    summary: 'Cookies, local storage, session storage, advertising tags, maps, auth, and payment technologies.',
    content: cookiePolicy
  },
  {
    slug: 'refund-cancellation-payment-policy',
    title: 'Refund, Cancellation, and Payment Policy',
    summary: 'Seasonal refunds, per-visit cancellation, Stripe payments, billing disputes, and scope changes.',
    content: refundCancellationPaymentPolicy
  },
  {
    slug: 'service-disclaimer',
    title: 'Service Disclaimer',
    summary: 'Site conditions, customer responsibilities, weather, utilities, autonomous equipment, and service limits.',
    content: serviceDisclaimer
  },
  {
    slug: 'ai-automation-disclaimer',
    title: 'AI and Automation Disclaimer',
    summary: 'Automated quote tools, human review, autonomous operations, and output limitations.',
    content: aiAutomationDisclaimer
  },
  {
    slug: 'sms-email-policy',
    title: 'SMS and Email Communications Policy',
    summary: 'Transactional communications, optional email marketing consent, and SMS marketing limits.',
    content: smsEmailPolicy
  },
  {
    slug: 'accessibility-statement',
    title: 'Accessibility Statement',
    summary: 'Accessibility approach, known limitations, and feedback contact details.',
    content: accessibilityStatement
  },
  {
    slug: 'acceptable-use-policy',
    title: 'Acceptable Use Policy',
    summary: 'Permitted and prohibited uses of quote, account, contact, dashboard, and payment features.',
    content: acceptableUsePolicy
  },
  {
    slug: 'third-party-services-disclosure',
    title: 'Third-Party Services Disclosure',
    summary: 'External providers detected in the app and the data they may process.',
    content: thirdPartyServicesDisclosure
  },
  {
    slug: 'service-area-disclaimer',
    title: 'Service Area and Availability Disclaimer',
    summary: 'Vaughan/Maple launch availability, approximate coverage maps, and address-level confirmation.',
    content: serviceAreaDisclaimer
  },
  {
    slug: 'estimate-booking-terms',
    title: 'Estimate, Quote, and Booking Terms',
    summary: 'Instant estimate flow, review, booking, customer authority, scope changes, and payment terms.',
    content: estimateBookingTerms
  }
];

export const legalDocumentBySlug = new Map(
  legalDocuments.map((document) => [document.slug, document])
);

