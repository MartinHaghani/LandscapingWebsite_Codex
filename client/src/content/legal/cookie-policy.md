# Cookie Policy

Last updated: May 3, 2026

This Cookie Policy explains how Autoscape uses cookies, browser storage, and similar technologies on the website. Autoscape is operated by 1001283716 ONTARIO INC., operating as Autoscape.

This is a legal draft for attorney review and does not guarantee legal compliance.

## What Cookies and Storage Are

Cookies are small files stored by a browser. Similar technologies include local storage, session storage, pixels, scripts, tags, and SDK storage used by website features and third-party providers.

## Technologies Detected

The codebase shows use of:

- Clerk for authentication and account sessions.
- Google tag and Google Ads conversion measurement.
- Mapbox maps, geocoding, satellite tiles, and static map previews.
- Stripe Checkout and Billing Portal payment handoff.
- Browser local storage for quote draft restoration.
- Browser storage for first-party analytics sessions, consent snapshots, event queues, and attribution snapshots.
- Server-side rate limiting and admin audit logs.

## Essential Technologies

Essential technologies support core website functions, including:

- Authentication and account access.
- Security, rate limiting, and fraud prevention.
- Quote draft submission and payment handoff.
- Service-area requests and contact-form submissions.

Some essential technologies may be set by Clerk, Stripe, the browser, or Autoscape infrastructure.

## Functional Storage

Autoscape uses local storage to restore quote drafts. This may include address text, selected address, map center, drawn polygons, selected billing mode, unit display, and distance-to-station value.

Autoscape uses browser storage to support first-party analytics. This may include an anonymous visitor ID, session ID, landing page, referrer, campaign parameters, Google Ads click IDs, Google ValueTrack parameters, device type, browser summary, consent snapshot, and unsent event queue.

Current first-party analytics storage keys include `autoscape.analytics.anonymousId.v1`, `autoscape.analytics.session.v1`, `autoscape.analyticsConsent.v1`, and the quote-draft key `autoscape.quoteDraft.v2`.

You can clear browser storage through your browser settings. Clearing storage may remove a saved quote draft, analytics session, event queue, or attribution snapshot.

## Analytics and Advertising

The public website loads Google tag for Google Ads conversion measurement. The codebase sends a Submit Lead Form conversion event after a successful public quote draft save.

The public website also sends first-party analytics events to Autoscape's own API at `POST /api/analytics/events`. These events help Autoscape understand page views, CTA clicks, contact actions, quote-funnel steps, payment-page actions, campaign parameters, and experiment variants.

Google may use cookies or similar technologies according to its own policies. Autoscape uses these tools to understand advertising performance and quote submissions.

Cookie consent mode or banner implementation: [NEEDS BUSINESS REVIEW: confirm whether production requires a cookie consent banner, consent mode, opt-out control, or analytics configuration changes].

## Map and Geocoding Technologies

Mapbox powers address autocomplete, map display, satellite basemap, service-area maps, quote map previews, and approved quote preview imagery. Address search text, selected address, coordinates, map interaction data, and map tile requests may be processed by Mapbox.

## Payment Technologies

Stripe powers payment checkout, subscriptions, billing portal access, and payment status updates. Stripe may use cookies or similar technologies when you visit Stripe-hosted checkout or billing pages.

## Managing Cookies and Storage

You can manage cookies and storage through your browser settings. You may also use privacy controls offered by Google, Clerk, Stripe, Mapbox, or your browser.

Blocking or clearing cookies may affect account login, quote restoration, payment checkout, map rendering, or other website functionality.
