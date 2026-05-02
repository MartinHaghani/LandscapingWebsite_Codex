# Autoscape Project Context

## Product Purpose

Autoscape provides:

1. deterministic instant landscaping quotes from real boundary geometry
2. coverage-first serviceability UX with privacy-preserving service area display
3. internal admin operations for quote review, expansion planning, and attribution tracking

## Current Experience

### Public App (`client/`)

- `Services` page starts with Service Area map + large `Check my address` CTA.
- Service map uses a light basemap with green `#329F5B` overlay for coverage clarity.
- Coverage is explicitly approximate and privacy-hardened.
- Service-area coverage uses server-side base-station config and falls back to the default Vaughan station when no base-station env is provided.
- Services page keeps the coverage map prominent but shortens the visible map height on mobile before the five shared-style inline SVG illustrations: Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
- Navigation includes the horizontal Autoscape PNG brand mark, mobile menu support, quote CTA, signed-out auth links separated by a slim divider, and a signed-in dashboard link styled with the standard site font/color treatment.
- Public shell loads the Google Ads tag `AW-17991079326` from `client/index.html`; the admin shell is not tagged.
- Footer repeats the horizontal Autoscape PNG brand mark and includes production contact details, internal quick links, and legal links; quote, auth, payment, confirmation, and dashboard-payment funnel routes use a compact footer variant with legal links preserved.
- Legal pages are available at `/legal` and `/legal/:slug`, with Markdown source files in `client/src/content/legal/` and drafting evidence tracked in `docs/legal_evidence_report.md`.
- Marketing pages (home/services/contact) use non-placeholder production copy and a warm-light readability-first design system; the contact page makes phone and email compact direct actions beside the message form.
- Home hero uses a symmetric desktop split with copy/CTAs on the left, `No sign-up required.` helper text under the CTA row, a stacked CTA layout on narrow mobile screens, and a responsive animated lawn parcel on the right with a perimeter-learning wall trace, an 11-pass rounded horizontal infill raster with denser direction arrows, direct mowing spawn on the first scanline, mowing follow-through, visible CAD dimensions, a restrained under-shadow, and a dynamically sized ticker-flip status capsule centered under the full lawn graphic. On mobile, the lawn parcel is reordered under `Precise Cuts, Lower Costs` and above the CTA buttons.
- Home page places a tighter pricing comparison section directly below the hero, using an unboxed sample-lawn context with a larger portrait lawn SVG and a muted two-column size/schedule row on the left, plus a flatter shared comparison panel on the right with a narrower row-label column and a top-right seasonal discount badge in the Autoscape season cell, so Autoscape and local competitors stay visually adjacent on mobile, the sample lawn avoids rounded bubble wrappers, and the same asymmetrical lawn-only mask, no interior decorative strokes, downward-facing driveway cutout, and brand-green fill treatment remain intact.
- Home page adds a `Meet our lawnmowers` section below pricing, pairing four icon-led unnumbered selling points on the left with a cleaned transparent mower asset on the right; the sensor copy uses sensor fusion language. On mobile, that mower asset moves directly under the section heading before the highlight list.
- Home page is streamlined to hero, pricing comparison, mower technology, a three-card services overview with Autonomous Mowing, Edging, and Cleanup & Debris, an FAQ covering cadence, service area, access, safety, weather, and pricing, and the closing instant-quote CTA, with the post-hero sections using a flatter warm-light rhythm that matches the landing area.

### Instant Quote Flow

0. Page opens with a badge-only header and a compact-on-mobile three-step progress rail (`Enter address` -> `Map your lawn` -> `Review quote`) instead of CTA-style step cards.
1. Step 1 address selection (Canada/US suggestion scope), with the address input and continue action stacked on mobile.
   - Keyboard suggestion controls supported (`ArrowUp/ArrowDown/Enter/Escape`).
   - Clicking a suggestion, or pressing Enter on a highlighted suggestion, resolves that exact suggestion and immediately runs the coverage gate with a pending state to block duplicate checks.
2. Coverage gate (`POST /api/service-area/check`) before entering map step.
3. Step 2 geometry drawing uses persistent freehand capture with service + obstacle polygons.
   - Top of map uses a thin address pill with a subtle `Change address` action.
   - `Draw lawn` / `Draw obstacle` toggle into `Stop drawing` while active.
   - Completed strokes automatically stop drawing mode.
   - Draw-end cleanup distance-normalizes freehand strokes, caps vertex density by distance, removes redundant wobble on straight edges, and collapses overlapping close-loop tails into one clean join corner.
   - Clicking near the outline of the selected polygon inserts a new vertex at that exact edge position and selects it immediately.
   - Undo/redo live in their own arrow-only box at the top-left of the map on desktop, while mobile uses a two-row top dock with undo/redo plus compact `Guide`/`Done` above `Lawn`, `Obstacle`, `Delete`, and `Clear`.
   - Delete and `Clear all` stay grouped; `Clear all` requires a second confirmation click and shortens to `Confirm` on mobile.
   - Drawn polygons remain vertex-editable after the stroke is completed.
   - Geometry edits do not auto-reset map zoom.
   - Property center marker uses a green home icon inside the white location dot.
   - Satellite basemap remains default in quote mapping for boundary accuracy.
   - A centered guide modal shell appears 1 second after a fresh map load succeeds for a newly entered address.
   - Guide step 1 is a looping miniature of the real draw-lawn tool, including the live toolbar chrome, the polished top-down house SVG as the popup background, and a visible cursor.
   - The tutorial now traces the front down lawn zone inside the same framed viewport treatment used by step 2 so the background stays consistent between slides, finalizes that stroke through the shared freehand logic, lets the camera glide with a shared 1.6-second transform while cursor movement and vertex dragging stay at normal guide speed, then draws the top-left lawn zone so both left-side lawns are complete before step 2.
   - Guide step 2 now carries those two finished left-side lawns forward, draws only the right-side backyard zone, keeps completed non-active polygons styled like the real quote tool, and uses the same 1.6-second camera transform timing without slowing cursor/edit phases while teaching one missing garden-notch point plus one direct toolbar-Delete click/removal of an extra redundant point on the selected right-side polygon.
   - Guide step 3 now keeps the same popup-house SVG background and completed three-zone lawn from step 2, clicks `Draw obstacle`, draws a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that finished scene for 2 seconds before looping again.
   - The guide shell now uses a cleaner editorial popup treatment with one white panel, responsive shorter mobile demo heights, a right-sized desktop demo viewport whose camera layer aligns with the map-body clip window so the SVG starts centered and the bottom stays visible, equal-width toolbar buttons above the artwork, a slowly fading unified demo-and-caption media unit with no divider or white caption box between the SVG and text, a tighter centered caption strip directly under the demo, and a flatter navigation row with centered segmented progress.
   - The animated SVG steps now fade in softly when they appear, fade back out as each loop finishes, and use a slower fade-based slide transition between guide steps.
   - On the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool without dismissing the current guide session.
   - The popup-house SVG background uses a fresher brighter palette so the lawn, deck, garden, and trees feel less dull.
   - The caption strip is now step-aware: step 1 uses `Draw loosely around your lawn.` and `Move the points to match your lawn.`, step 2 uses `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 uses `Use Draw obstacle for gardens, pools, and other no-mow areas.`
   - Dismissing the guide keeps it closed for the current mapped address session; it reopens only after the next successful address-to-map load.
   - Restored browser-local drafts do not auto-open the guide.
   - Floating top-right action cluster pairs a manual `Guide` help button with the primary `Done` completion action on desktop; mobile places them in the compact top dock so `Done` stays visible at 320px and 390px widths.
   - Drawing controls/panels use warm-light surfaces and high-contrast action states.
   - The detailed under-map area/perimeter/lawn/obstacle/unit/draft summary is desktop-only; mobile keeps blocking status messages above the map and leaves the lower map area clear.
4. Review page owns billing selection before draft save; service frequency is weekly-only.
   - Weekly service uses 20 visits from May to September.
   - Migration `20260415163000_weekly_only_service_frequency` normalizes stored non-weekly quote/version rows to the 20-visit weekly season before tightening the enum; older historical migrations remain unchanged.
   - Pricing formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 45)`.
   - `D` is nearest active base-station distance in km (internal-only, not customer-visible).
   - Billing modes: `seasonal` (default, 20% discount) and `per_session`.
   - Browser-local draft autosave stores address/map/billing/unit state and waits for restore hydration before writing back, so map-step drafts reopen directly on the Mapbox builder.
   - Draft persistence key/version is `autoscape.quoteDraft.v2`.
   - Legacy `serviceFrequency` fields in local draft snapshots are accepted and stripped during restore.
   - Saved draft can be reset from address or map panels.
5. Review page (`/instant-quote/summary`) removes the step progress rail and shows a two-section quote-ready layout: one top `Back to Map` action, a desktop top row with address-first property details on the left, top season/per-visit price cards separated by an `or` divider, and a desktop-only fitted map preview with quiet whole-number area/perimeter metadata on the right, then a full-width lower section with radio billing plan cards separated by an `or` divider before any server draft is created. Seasonal savings sit inside the season plan card instead of a separate summary card.
6. Draft save (`POST /api/quote/draft`) after review-page confirmation.
   - `polygonSource` now requires `schemaVersion: 2` with `activePolygonId`, `polygons[]`, `ringPoints`, and nullable `rawStrokePoints`.
   - Server derives/stores canonical quote geometry from `ringPoints`; legacy source payloads are rejected.
   - If the API is unreachable, the review page keeps the local draft intact and shows a direct API reachability error instead of a generic submit failure.
   - After a successful draft response, the public client fires the Google Ads `Submit lead form` conversion `AW-17991079326/FqIMCOHXqYIcEJ6r6IJD` with the quote ID as the transaction ID.
7. Confirmation handoff at `/quote-confirmation/:quoteId` (legacy `/quote-contact/:quoteId` redirects here).
8. Signed-in draft creation records quote address in Clerk account metadata (`addressHistory` + `defaultAddress`).
9. Authenticated user claim step (`POST /api/quote/:quoteId/claim`) links quote ownership and now requires the completed-phone profile gate.
10. Confirmation page claims/finalizes the draft by calling `POST /api/quote/:quoteId/contact`.

- Server derives name/email/phone from authenticated account.
- Property address is derived from stored quote draft address (not a form field).
- Finalize moves quote directly to `in_review` with `customer_status=pending`.

11. Confirmation page loads quote for owner/admin only.

### Customer Accounts

- Clerk handles customer sign-up/sign-in, Google auth, and password reset with a shared Autoscape-branded appearance in public auth and account profile screens.
- Required phone is enforced in-app via `/complete-profile/*` for all auth methods.
- Phone is stored on account metadata (`unsafeMetadata.autoscapeProfile.phone`).
- Optional email marketing consent is stored on account metadata (`unsafeMetadata.autoscapeProfile.emailMarketingConsent`) and propagated to `Lead.consentMarketing` during quote claim/finalize.
- Users without phone are gated before dashboard and quote confirmation routes.
- Protected dashboard routes:
  - `/dashboard` (action-first account home with mobile-first CTA placement, primary quote state, lifecycle timeline, support/schedule panels, conditional quote history, and conditional Stripe card-on-file panel)
  - `/dashboard/account/*` (Clerk-managed profile, password, and security settings)
  - `/dashboard/quotes/:quoteId` (owned quote detail with grouped mobile-readable summary data)
  - `/dashboard/quotes/:quoteId/payment` (authenticated approved-quote payment surface with task-first mobile CTAs that can start Stripe Checkout)
- Approved quote emails link to public `/pay/:token` pages. Tokens are long random secrets stored only as SHA-256 hashes and are regenerated on approval/resend.
- Public/authenticated payment APIs are `GET /api/payment-links/:token`, `POST /api/payment-links/:token/checkout`, `POST /api/account/quotes/:quoteId/payment/checkout`, `POST /api/account/quotes/:quoteId/billing-portal`, and `POST /api/stripe/webhook`.
- Seasonal quotes create one-time Stripe Checkout Sessions for the approved discounted seasonal total. Per-session quotes create weekly Stripe subscription Checkout Sessions, use a May 1 billing-cycle anchor before season or charge immediately during season, cap paid invoices at `sessionsMax`, and stop no later than September 30.
- Account quote detail responses now include conditional billing metadata so the dashboard can show the current card-on-file summary when Stripe has a reusable saved method.
- Quote lookup APIs are owner-only unless caller is admin.
- Admin-created quotes use `/claim-quote`: Quote ID-only public preview is allowed before sign-up, sign-up/sign-in returns through `/complete-profile`, the customer claims the quote by ID, chooses `seasonal` or `per_session`, and continues directly to Stripe Checkout.

### Out-of-Area Flow

- `/service-unavailable` shows coverage map + entered-address marker.
- Page auto-creates expansion demand record once via idempotent `POST /api/service-area/request`.
- User can retry address or go to `/service-area-requested` thank-you page.
- Coverage check failures route to `/service-check-error`.

### Contact Flow

- Contact page presents compact direct phone/email actions for fast outreach.
- Contact form captures name/email/phone/message (required) + address (optional).
- Contact form includes an optional unchecked email-marketing opt-in and submits `marketingConsent` to the API.
- Contact submission is idempotent (`POST /api/contact`).

## Admin Platform (`admin/`)

Admin app (separate Vite frontend) supports:

- fixed Autoscape light theme with a sticky sidebar + top utility bar layout
- quote inbox with pending semantics (`in_review + pending`) and verified-awaiting-payment label
- polished route-based quote creator (`/quotes/new`) for anonymous admin-created quotes:
  - reserves and displays the real six-character easy Quote ID before save
  - provides `Copy ID`, generic `/claim-quote`, and direct `/claim-quote?quoteId=...` actions
  - uses the same Satellite Streets draw/edit controls, building/house-number map context, geodesic metric helpers, and server remeasurement contract as quote review
  - saves directly to `quotes` as `status=verified`, `customer_status=awaiting_payment`, `contact_pending=false`, with `auth_user_id=null` until customer claim
  - version 1 is stored in `quote_versions` with `actor_type=admin`
  - global discount defaults to 0%, seasonal discount defaults to 20%, both clamp to 0-50%, and override mode stores the edited base per-visit amount plus optional reason
- route-based quote editor (`/quotes/:quoteId/edit`) with full polygon tools and editable quote controls
  - Mapbox Satellite Streets basemap for property-context editing, including building outlines and house-number labels where Mapbox has coverage
  - stored customer polygons render immediately on editor load
  - editor mirrors the public quote map styling and controls, including the same freehand draw workflow, vertex dragging, outline-click vertex insertion, delete/clear behavior, shared draw-end simplifier, and v2 polygon-source contract as the public quote tool
- append-only version flow:
  - client draft creates version number `1` (`actorType=client`) using `polygonSource.schemaVersion=2`
  - admin edits create new versions (`actorType=admin`)
  - selected version submit sets `status=verified`, `customer_status=awaiting_payment`
  - verified approval creates a fresh secure payment token, attempts a simplified payment-focused approved-quote email through Resend, and records delivery state without rolling back approval on failure
  - the approved-quote payment email uses one secure `/pay/:token` CTA, shows only the actual selected Stripe payment amount/mode, includes the quote address/ID/schedule, and keeps the existing tokenized map preview with a minimal conditional legend
  - manual approval email resend is available for verified quotes, rotates the public payment token, and the public preview endpoint serves the tokenized Mapbox satellite delta image used by the email/payment page
- quote mutation endpoints are restricted to `OWNER`, `ADMIN`, and `REVIEWER` roles
- quote notes
- `Area requests` queue with heatmap + cluster map module and hotspot list
- lead/contact inbox
- attribution summary (submit snapshot aggregation)
- audit events
- CSV export with role-based PII controls, placed as a low-prominence bottom-page action
- collapsed search/filter/sort controls across all admin tabs
- Clerk-backed admin sign-in (invite-only organization membership)
- bearer-token auth only against `/api/admin/*` (no legacy role headers/static token)

## Data + Infrastructure

- Runtime API: `server/src/server.ts` via `server/src/index.ts`
- Hosted deployment target: DigitalOcean App Platform with isolated staging and production apps.
  - Staging uses the `staging` branch, auto-deploys to `staging.autoscape.ca`, `api-staging.autoscape.ca`, and `admin-staging.autoscape.ca`.
  - Production uses the `main` branch, deploys manually to `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, and `admin.autoscape.ca`.
  - Each environment has `public-web` (`client/`), `admin-web` (`admin/`), `api` (`server/`), a Prisma pre-deploy migration job, and its own managed Postgres/PostGIS database.
  - Node runtime selection is pinned by committed `engines.node=20.x` package manifests for the root, `server/`, `client/`, and `admin/` apps.
  - Live status on 2026-04-21: staging app `autoscape-staging` is active in `tor`, `autoscape-staging-db` is PostgreSQL 16 in `tor1`, and migrations have run. Staging custom domains use self-managed GoDaddy CNAME records and are active. Authenticated staging smoke tests passed for customer quote finalization, admin review/verification, and persistence after redeploy; approved-quote preview/resend routes are deployed, and both Stripe API secrets are configured, but real approval email/resend smoke and Stripe checkout smoke still need to pass before production is created.
- Persistence: Prisma + Postgres + PostGIS (`server/prisma/schema.prisma`)
- Approved quote verification creates tokenized Stripe payment links, attempts Resend delivery, records sent/failed delivery rows and audit events, and keeps approval successful if email or preview preflight fails. Tokenized preview images use server-proxied Mapbox satellite static imagery with approved, added, and removed area overlays.
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
  - `server/prisma/migrations/20260314122000_admin_quote_editor_workflow/migration.sql`
  - `server/prisma/migrations/20260314180000_quote_auth_ownership/migration.sql`
  - `server/prisma/migrations/20260315160000_quote_pricing_v2/migration.sql`
  - `server/prisma/migrations/20260415163000_weekly_only_service_frequency/migration.sql`
  - `server/prisma/migrations/20260416130000_approved_quote_email_delivery/migration.sql`
  - `server/prisma/migrations/20260421110000_stripe_quote_payments/migration.sql`
- Idempotency table stores request hash + exact response replay payload.
- In-memory fallback store remains for local runs without `DATABASE_URL`.
- Dev cutover script: `npm --prefix server run cutover:freehand-reset-dev-data`
  - wipes test quote/leads/editor records before the freehand v2 rollout
  - preserves schema/reference data such as base stations
- Local dev quote submit expects the API on `http://localhost:4000`; server CORS reflects loopback frontend origins (`localhost`, `127.0.0.1`, `[::1]`) across arbitrary local ports.

## Security / Privacy Model

- Base station coordinates are server-only.
- Service overlay returned to clients is unioned/simplified/jittered/quantized geometry.
- Authentication provider: Clerk for both customer and admin surfaces.
- Quote ownership stored on `quotes.auth_user_id` and enforced on quote read/finalize paths.
- Customer phone requirement enforced for quote claim, quote finalize, and account quote APIs.
- Customer address history/default persisted in Clerk private metadata (`autoscapeProfile`).
- Email marketing opt-in is optional, unchecked by default, and persisted on leads as `consentMarketing`; no SMS marketing consent or SMS sending provider is active at launch.
- Stripe Checkout handles card/payment collection; Autoscape stores Stripe object IDs, payment state, and paid invoice IDs, not card details.
- Public payment-link tokens are stored hashed, scoped to approved quote payment, and revoked when a newer approved email/resend token is issued.
- Admin RBAC roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`.
- Admin role mapping source: Clerk org roles `owner/admin/reviewer/marketing`.
- MARKETING role gets masked PII for lists and exports.
- Analytics endpoints use `SYSTEM_LAUNCH_AT` cutoff for launch-era consistency.

## Current Defaults

- Default station (non-production): `L6A1M7` center (`43.844147`, `-79.51962`).
- Default served region: `Vaughan, Ontario`.
- Currency default: `CAD`.
