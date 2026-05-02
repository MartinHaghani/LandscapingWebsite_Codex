# Autoscape Legal Evidence Report

Last updated: May 1, 2026

This report summarizes the codebase evidence used to draft Autoscape's launch legal documents. The documents are legal drafts for attorney and business-owner review. They do not guarantee legal compliance.

## Documents Created

| Document | Source file | Public route | Codebase evidence |
| --- | --- | --- | --- |
| Privacy Policy | `client/src/content/legal/privacy-policy.md` | `/legal/privacy-policy` | Contact form, quote drafts, account auth, payment pages, attribution, Google Ads tag, Mapbox, Clerk, Stripe, Resend, storage, audit logs |
| Terms of Service | `client/src/content/legal/terms-of-service.md` | `/legal/terms-of-service` | Website use, quote creation, account gating, claim/finalize flow, payment checkout, service-area checks, autonomous service positioning |
| Cookie Policy | `client/src/content/legal/cookie-policy.md` | `/legal/cookie-policy` | Clerk auth cookies/session handling, Google Ads tag, localStorage draft persistence, sessionStorage attribution, Mapbox and Stripe browser flows |
| Refund, Cancellation, and Payment Policy | `client/src/content/legal/refund-cancellation-payment-policy.md` | `/legal/refund-cancellation-payment-policy` | Seasonal/per-visit billing modes, Stripe Checkout/Billing Portal, payment statuses, approved quote payment pages |
| Service Disclaimer | `client/src/content/legal/service-disclaimer.md` | `/legal/service-disclaimer` | Landscaping quote flow, autonomous mowing/service copy, property geometry, service-area limits, pricing review |
| AI and Automation Disclaimer | `client/src/content/legal/ai-automation-disclaimer.md` | `/legal/ai-automation-disclaimer` | Automated quote calculations, service-area routing, quote review, autonomous landscaping service positioning |
| SMS and Email Communications Policy | `client/src/content/legal/sms-email-policy.md` | `/legal/sms-email-policy` | Phone/email collection, approved quote email through Resend, optional email marketing opt-in, no SMS provider or SMS marketing consent at launch |
| Accessibility Statement | `client/src/content/legal/accessibility-statement.md` | `/legal/accessibility-statement` | Public website launch, forms, account pages, maps, no verified WCAG conformance claim in repo |
| Acceptable Use Policy | `client/src/content/legal/acceptable-use-policy.md` | `/legal/acceptable-use-policy` | Accounts, quote tools, contact form, dashboard, payment links, no public posting or review system |
| Third-Party Services Disclosure | `client/src/content/legal/third-party-services-disclosure.md` | `/legal/third-party-services-disclosure` | Clerk, Stripe, Resend, Mapbox, Google Ads, Prisma/PostgreSQL, DigitalOcean, GoDaddy references |
| Service Area and Availability Disclaimer | `client/src/content/legal/service-area-disclaimer.md` | `/legal/service-area-disclaimer` | Service-area map/check/request endpoints, obfuscated coverage overlay, default Vaughan station, out-of-area request capture |
| Estimate, Quote, and Booking Terms | `client/src/content/legal/estimate-booking-terms.md` | `/legal/estimate-booking-terms` | Instant quote summary, draft save, claim/finalize, human review, billing selection, approved payment pages |

Media Release Terms were not created because the inspected codebase does not show photo uploads, image uploads, public reviews, testimonials, before/after galleries, or customer-submitted media publication features.

## Relevant Files Inspected

- `client/src/App.tsx`
- `client/src/components/layout/Footer.tsx`
- `client/src/pages/ContactPage.tsx`
- `client/src/pages/CompleteProfilePage.tsx`
- `client/src/pages/InstantQuotePage.tsx`
- `client/src/pages/InstantQuoteSummaryPage.tsx`
- `client/src/pages/PublicQuotePaymentPage.tsx`
- `client/src/pages/DashboardQuotePaymentPage.tsx`
- `client/src/pages/QuoteConfirmationPage.tsx`
- `client/index.html`
- `client/src/lib/api.ts`
- `client/src/lib/attribution.ts`
- `client/src/lib/quoteDraftPersistence.ts`
- `client/src/types.ts`
- `server/src/server.ts`
- `server/src/lib/schemas.ts`
- `server/src/lib/dataStore.ts`
- `server/src/lib/adminAuth.ts`
- `server/src/lib/stripePayments.ts`
- `server/src/lib/approvedQuoteEmail.ts`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260502090000_legal_acceptance_records/migration.sql`
- `.env.example`, `client/.env.example`, `server/.env.example`, `admin/.env.example`
- `README.md`
- `project_context.md`
- `docs/architecture.md`
- `docs/feature_flow.md`
- `docs/design.md`
- `docs/deployment.md`

## Third-Party Services Detected

- Clerk: customer/admin authentication, account profile, session handling, account metadata.
- Stripe: Checkout, subscriptions, Billing Portal, payment links, payment status, card summary data.
- Resend: approved-quote transactional email.
- Mapbox: address suggestions/geocoding, Mapbox GL maps, satellite/static map previews.
- Google Ads/Google tag: public shell tag `AW-17991079326` and quote draft conversion `AW-17991079326/FqIMCOHXqYIcEJ6r6IJD`.
- PostgreSQL/PostGIS through Prisma: application data persistence.
- DigitalOcean App Platform and DigitalOcean Managed PostgreSQL: documented staging/production hosting model.
- GoDaddy: documented DNS/domain references.

## Data Types Collected or Processed

- Name, email address, phone number, and contact messages.
- Optional email marketing consent from the contact form and complete-profile flow.
- Service address, address search text, geocoded coordinates, service-area check results, and out-of-area service requests.
- Drawn service and obstacle polygon geometry, quote metrics, area, perimeter, distance-derived pricing inputs, billing mode, quote ID, quote status, customer status, and admin-reviewed quote versions.
- Clerk user IDs, account profile metadata, required phone metadata, email marketing consent metadata, and customer address metadata.
- Legal acceptance records containing action, document slugs, document version, optional lead/quote/auth user references, email, hashed IP, user agent, timestamp, and metadata.
- Stripe payment object IDs, checkout session IDs, customer IDs, payment intent/subscription IDs, payment status, paid invoice IDs, card brand, last four digits, and card expiry summary when available.
- Attribution data including Google click identifiers, UTM parameters, landing path, referrer, device type, browser summary, and conversion transaction ID.
- Admin audit log metadata including hashed IP address and user-agent string.

## Cookies, Storage, and Tracking Detected

- Google Ads/Google tag in `client/index.html`.
- Clerk authentication cookies and session handling through Clerk SDK usage.
- Browser `localStorage` quote draft persistence key `autoscape.quoteDraft.v2`.
- Browser `sessionStorage` attribution key `autoscape_attribution_v1`.
- Mapbox browser requests for maps, geocoding, and static imagery.
- Stripe Checkout and Billing Portal browser sessions.
- No first-party cookie banner or consent-management framework was detected.

## Product and API Updates Implemented

- Added public legal source files under `client/src/content/legal/`.
- Added a raw Markdown legal registry in `client/src/content/legal/index.ts`.
- Added `client/src/pages/LegalPage.tsx` with a small static Markdown renderer and routes `/legal` and `/legal/:slug`.
- Added footer Privacy Policy and Terms of Service links so the home page exposes the core legal pages directly, plus no-script fallback links in the public HTML shell for basic crawlers; `/legal` remains directly accessible and action-local acknowledgement links stay near guarded actions.
- Added required legal acknowledgement checkboxes near contact, instant quote submit, complete profile, quote confirmation claim, public payment checkout, and dashboard payment checkout actions.
- Added optional unchecked email marketing opt-in to the contact form.
- Added optional unchecked email marketing opt-in to the complete-profile account intake flow.
- Added `marketingConsent?: boolean` and `legalAcceptance: { accepted: true }` to the relevant client/server payload contracts.
- Added `POST /api/account/legal-acceptance`.
- Added Prisma-backed `LegalAcceptance` records and migration `20260502090000_legal_acceptance_records`.
- Server maps each action to canonical document slugs/version rather than trusting client-supplied document lists.
- Persisted contact-form opt-in to `Lead.consentMarketing`.
- Stored complete-profile email opt-in in Clerk `unsafeMetadata.autoscapeProfile.emailMarketingConsent`.
- Propagated Clerk email-marketing opt-in to lead consent during quote claim and quote finalize.
- Did not add SMS marketing consent, SMS sending, a cookie banner, or a cookie consent framework.

## Missing Business or Attorney Review Items

- Privacy officer/contact role and internal privacy-request process.
- Data retention periods for leads, quotes, account metadata, payment records, attribution, audit logs, service-area requests, and backups.
- Production hosting and subprocessors to confirm before launch.
- Cross-border processing disclosure and vendor contract/data-processing review.
- Cookie consent strategy for Google Ads, Clerk, Mapbox, Stripe, and any future analytics/marketing tags.
- Email unsubscribe implementation, suppression list, message frequency, and marketing provider/process before campaigns.
- SMS provider, SMS transactional use, and any future SMS marketing consent process.
- Insurance, licensing, bonding, WSIB, and certification wording, if any.
- Refund edge cases, non-refundable costs, chargeback process, and discretionary refund authority.
- Whether the website's 24-hour quote-review language should remain a binding customer-facing commitment.
- Accessibility audit status, known limitations, feedback owner, and any conformance claim.
- Final dispute venue, small claims/arbitration position, and Ontario consumer-contract review.

## Drafting Reference Anchors

- Office of the Privacy Commissioner of Canada, PIPEDA overview: `https://www.priv.gc.ca/en/privacy-topics/information-and-advice-for-individuals/your-privacy-rights/businesses-and-your-personal-information/`
- CRTC CASL requirements: `https://crtc.gc.ca/eng/internet/anti/reg.htm`
- Ontario website accessibility guidance: `https://www.ontario.ca/page/how-make-websites-accessible`
- Ontario home renovation/repair guidance: `https://www.ontario.ca/page/your-rights-when-starting-home-renovations-or-repairs`
- Stripe Canada legal terms: `https://stripe.com/ca/legal`
- Mapbox Terms of Service: `https://www.mapbox.com/legal/tos`
- Clerk Privacy Policy: `https://clerk.com/legal/privacy`
- Resend Privacy Policy: `https://resend.com/legal/privacy-policy`
- Google advertising privacy: `https://policies.google.com/technologies/ads?hl=en-US`
