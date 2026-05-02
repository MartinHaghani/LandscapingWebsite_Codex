# Third-Party Services Disclosure

Last updated: May 1, 2026

This Third-Party Services Disclosure summarizes external services detected in the Autoscape codebase and documentation. Autoscape is operated by 1001283716 ONTARIO INC., operating as Autoscape.

This is a legal draft for attorney review and does not guarantee legal compliance.

## Why Autoscape Uses Third Parties

Autoscape uses third-party providers to operate authentication, address lookup, maps, payments, email, hosting, analytics, and infrastructure. These services may process information under their own terms, privacy notices, and security practices.

## Providers Detected

Clerk provides customer and admin authentication, account profile management, Google sign-in support, password reset, organization membership, and account metadata.

Mapbox provides address autocomplete, geocoding, maps, satellite basemaps, quote map previews, service-area maps, and approved static map previews.

Stripe provides Checkout, payment sessions, subscriptions for weekly per-visit billing, payment status webhooks, Billing Portal, card summary data, and payment-related identifiers.

Resend provides approved-quote transactional email delivery when configured.

Google Ads and Google tag provide advertising attribution and quote submission conversion measurement.

PostgreSQL, Prisma, and application hosting infrastructure store and operate quotes, leads, contacts, service-area requests, audit logs, attribution records, payment records, and account-linked quote data.

DigitalOcean staging hosting and GoDaddy domain/DNS records are referenced in the project documentation.

## Data Shared or Processed

Depending on the workflow, third parties may process:

- Name, email, phone, account identifiers, and authentication status.
- Service address, geocoded coordinates, drawn polygons, and map interactions.
- Quote ID, quote metrics, pricing, billing mode, payment status, and payment metadata.
- Email message content for approved quotes.
- Advertising identifiers, UTM parameters, referrer, browser, device type, and conversion events.
- Technical data such as IP address, user agent, cookies, and session identifiers.

## Cross-Border Processing

Third-party providers may process or store information outside Ontario or Canada. Provider locations, safeguards, and data processing terms should be reviewed before production launch.

Cross-border and vendor contract review: [NEEDS BUSINESS REVIEW: confirm production vendors, data processing terms, subprocessors, and cross-border notice requirements].

## Third-Party Links

Payment, authentication, maps, and provider-hosted pages may be governed by third-party terms and privacy notices. Autoscape is not responsible for third-party services outside its reasonable control.

