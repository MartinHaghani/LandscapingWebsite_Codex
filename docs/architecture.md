# Architecture

## 1) System Overview

Autoscape is a three-surface monorepo:

- `client/` public SPA (marketing, services, instant quote)
- `server/` Node API (public + admin endpoints)
- `admin/` internal operations SPA

Primary domains:

1. Quote capture and verification workflow
2. Service-area display/check/request workflow
3. Admin operations and attribution analytics

## 2) Runtime and Entry Points

- API runtime: `server/src/index.ts` -> `server/src/server.ts`
- Hosted runtime: DigitalOcean App Platform runs two isolated apps from the GitHub repo: staging from `staging` with auto-deploy and production from `main` with manual deploys.
- Hosted components per environment: `public-web` static site from `client/`, `admin-web` static site from `admin/`, `api` Node service from `server/`, and a `migrate` pre-deploy job that runs `npm run prisma:migrate:deploy`.
- Hosted Node version: the root, `server/`, `client/`, and `admin/` package manifests pin `engines.node=20.x`, which DigitalOcean App Platform's Node buildpack uses for build/runtime selection.
- Hosted domains: staging uses `staging.autoscape.ca`, `api-staging.autoscape.ca`, and `admin-staging.autoscape.ca`; production uses `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, and `admin.autoscape.ca`.
- Live hosted status on 2026-04-21: `autoscape-staging` is active in `tor` with `public-web`, `admin-web`, `api`, and `migrate`; its custom domains use self-managed GoDaddy CNAME records and are active. Authenticated staging smoke tests pass through customer quote finalization, admin verification, and persistence after redeploy. Approved-quote preview/resend routes are deployed and both Stripe API secrets are configured; production has not been created because real approval email/resend smoke testing, Stripe checkout smoke testing, and launch confirmation are still pending.
- Local dev connectivity: public/admin frontends default to `VITE_API_BASE_URL=http://localhost:4000`; admin also uses `VITE_PUBLIC_APP_BASE_URL=http://localhost:5173` to generate customer claim links. The API reflects loopback origins (`localhost`, `127.0.0.1`, `[::1]`) across arbitrary local ports to avoid Vite port drift breaking quote writes.
- Public app routes: `client/src/App.tsx`
- Public legal routes: `/legal` and `/legal/:slug` render Markdown drafts from `client/src/content/legal/` through `client/src/pages/LegalPage.tsx`; footer/form/payment links are wired to these routes.
- Public HTML shell: `client/index.html` includes the Google Ads tag `AW-17991079326`; `admin/index.html` is intentionally separate and untagged.
- Google Ads conversion helper: `client/src/lib/googleAds.ts` sends the `Submit lead form` conversion `AW-17991079326/FqIMCOHXqYIcEJ6r6IJD` only after successful public quote draft creation.
- Contact page: `client/src/pages/ContactPage.tsx` (warm-light two-column contact surface with compact direct phone/email actions and the existing idempotent message form)
- Services gallery: `client/src/pages/ServicesPage.tsx` + `client/src/components/service/ServiceIllustrations.tsx` (coverage-first entry page with a shorter mobile service-area map and five shared-style inline SVG service scenes)
- Instant quote builder: `client/src/pages/InstantQuotePage.tsx` + `client/src/components/quote/QuoteMapDrawingToolbar.tsx` (badge-only header + compact-on-mobile non-interactive three-step progress rail, mobile-stacked address input/submit controls, address suggestion click/highlighted-Enter auto-continue through the coverage gate using the selected suggestion data directly with duplicate-check protection, full-width map builder, delayed map-guide modal shell for fresh address loads, cleaner editorial guide chrome with one white panel, responsive shorter mobile demo heights, a slowly fading unified demo-and-caption media unit, no divider or white caption box between SVG and guide text, a right-sized desktop demo viewport with the camera layer aligned to the map-body clip window so the SVG starts centered and the bottom remains visible, a tighter centered caption strip directly under the demo, equal-width toolbar buttons above the artwork, separate bottom navigation/progress chrome, looping first-step miniature draw-lawn demo using the refreshed brighter popup-house SVG background to draw both left-side lawn zones inside the same framed viewport treatment used by step 2, with a shared 1.6-second camera transform that does not slow cursor/edit phases, plus loop-edge fades that soften the demo restart, animated second-step SVG lesson that carries those two completed left-side lawns forward while drawing and correcting the right-side backyard zone with the same decoupled camera transform timing, matching framed background treatment, shorter `Add extra points` / `Delete extra points` captions, and the same loop-edge fade behavior, animated third-step SVG obstacle lesson that keeps that same house background and finished lawn state while clicking `Draw obstacle`, tracing a selected red obstacle polygon around the front tree in the bottom-left lawn, holding the completed obstacle scene for 2 seconds before looping again, and swapping the last-slide nav control from `Next` to a green `Done` button that slowly fades the popup back into the tool, desktop floating `Guide` plus `Done` action cluster, compact two-row mobile map dock, desktop-only under-map metrics/unit/draft summary, local draft autosave, and review handoff)
- Instant quote review: `client/src/pages/InstantQuoteSummaryPage.tsx` (two-section quote-ready review layout without the progress rail, one top `Back to Map` action, a desktop top row with address-first quote details plus top season/per-visit price cards separated by an `or` divider, a right-side desktop-only fitted property preview, quiet whole-number area/perimeter metadata, a full-width lower payment-plan section with accessible radio plan cards separated by an `or` divider, seasonal savings shown inside the season plan card instead of as a standalone summary tile, and `POST /api/quote/draft` trigger)
- Quote claim page: `client/src/pages/ClaimQuotePage.tsx` (`/claim-quote`, optional `quoteId` query prefill, SMS-style six-character code entry, compact quote preview, auth/profile return flow, billing choice, and direct Stripe Checkout)
- Admin app routes/state: `admin/src/App.tsx`
- Admin quote creator: `admin/src/pages/QuoteCreatorPage.tsx` (`/quotes/new`, reserved six-character Quote ID, copyable claim links, Mapbox address search, Satellite Streets geometry drawing with building/house-number context, live stats/pricing, warning-only service-area check, and direct admin quote creation)
- Admin quote editor map module: `admin/src/components/QuoteEditorMap.tsx` (Mapbox Satellite Streets basemap, public quote-map polygon styling/controls, building outlines and house-number labels where available, immediate freehand polygon source hydration, vertex dragging, outline-click vertex insertion, and the same shared draw-end simplifier used in public)
- Public layout shell: `client/src/components/layout/SiteLayout.tsx` (`Navbar`, route-aware full/compact `Footer`, `ScrollToTop`; navbar/footer use the horizontal PNG brand mark from `client/public/images/brand/autoscape-horizontal-brand.png`, and signed-out desktop auth links use a slim divider rather than punctuation)
- Public theming system: `client/tailwind.config.ts` + `client/src/index.css` (warm-light semantic tokens, shared form/focus/map-control styling)
- Home hero system: `client/src/pages/HomePage.tsx` + `client/src/components/home/HomeHeroLawnGraphic.tsx` + `client/src/lib/homeHeroLawn.ts` + `client/src/lib/homeHeroLawnCoverage.ts` (true desktop 50/50 split, CTA helper copy, mobile-only hero graphic placed between `Precise Cuts, Lower Costs` and the CTA buttons, fixed parcel geometry constants, perimeter wall-trace metadata, rounded 11-pass boustrophedon infill path with sampled motion/denser arrows, direct mowing spawn on the first scanline, multi-phase hero timing, slightly heavier white outline, and a dynamically sized ticker-flip status capsule centered below the full lawn graphic)
- Home page marketing composition: `client/src/pages/HomePage.tsx` + `client/src/components/home/HomePricingComparisonSection.tsx` + `client/src/components/home/HomeLawnmowersSection.tsx` (hero-adjacent pricing comparison using existing client quote helpers for a 3,000 sq ft weekly sample lawn in a flatter non-bubbled presentation with an unboxed larger sample lawn, muted size/schedule metadata, a narrower row-label column, and a top-right seasonal `20% off` badge in the Autoscape season cell, followed by a two-column mower section with an icon-led four-point unnumbered spec list on the left and the cleaned transparent asset `client/public/images/home/mower-technology-transparent.png` floating directly on the right-side background on desktop and directly under the section heading on mobile, then a streamlined flatter flow into a three-card services overview for Autonomous Mowing, Edging, and Cleanup & Debris, an FAQ with larger emphasized answers, and the closing quote CTA without separate Why Electric, How It Works, Why Autoscape, Testimonials, or About surfaces)

## 3) Persistence Layer

- ORM: Prisma (`server/prisma/schema.prisma`)
- DB: PostgreSQL + PostGIS
- Hosted persistence: staging and production each use their own DigitalOcean Managed PostgreSQL database; production traffic must never rely on the local/dev in-memory fallback.
- Live staging persistence on 2026-04-21: `autoscape-staging-db` runs PostgreSQL 16 in `tor1` with database/user `autoscape_staging`; PostGIS is enabled and the staged Prisma migrations have applied.
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
  - `server/prisma/migrations/20260314122000_admin_quote_editor_workflow/migration.sql`
  - `server/prisma/migrations/20260314180000_quote_auth_ownership/migration.sql`
  - `server/prisma/migrations/20260315160000_quote_pricing_v2/migration.sql`
  - `server/prisma/migrations/20260415163000_weekly_only_service_frequency/migration.sql`
  - `server/prisma/migrations/20260416130000_approved_quote_email_delivery/migration.sql`
  - `server/prisma/migrations/20260421110000_stripe_quote_payments/migration.sql`
  - `server/prisma/migrations/20260501120000_admin_quote_creation_claim_flow/migration.sql`

Canonical tables:

- `leads`
- `lead_contacts`
- `quotes`
- `quote_versions` (append-only history)
- `quote_id_reservations`
- `approved_quote_email_deliveries`
- `quote_payment_links`
- `stripe_webhook_events`
- `quote_notes`
- `service_area_requests`
- `attribution_touches`
- `audit_logs`
- `base_stations`
- `idempotency_records`

Spatial storage:

- quote geometry: `geometry(MultiPolygon,4326)`
- address and request points: `geography(Point,4326)`
- base station points: `geography(Point,4326)`

## 4) Public API Shape

### Quote

- `POST /api/quote/draft` (idempotent)
- `GET /api/quote-preview/:quoteId` (public Quote ID preview for verified awaiting-payment quotes)
- `POST /api/quote/:quoteId/claim` (auth + completed phone required; associates `quotes.auth_user_id`)
- `POST /api/quote/:quoteId/contact` (idempotent, auth required, optional notes payload only)
- `GET /api/quote/:quoteId` (auth required, owner/admin only)
- `GET /api/approved-quote-preview/:token` (public token, proxies the Mapbox satellite image for approved quote emails/payment pages)
- `GET /api/payment-links/:token` (public secure token, sanitized approved quote + payment state)
- `POST /api/payment-links/:token/checkout` (creates/reuses Stripe Checkout)
- `POST /api/account/quotes/:quoteId/payment/checkout` (authenticated owner checkout for dashboard payment page)
- `POST /api/stripe/webhook` (Stripe signature verification + idempotent webhook processing)
- client request wrapper converts network-level failures into a direct API reachability message so quote/contact flows do not fall back to a generic submit error

### Account

- `GET /api/account/quotes` (auth required; returns owned quotes plus customer status, verification timing, payment summary, and dashboard payment-page URL)
- `GET /api/account/quotes/:quoteId` (auth required, owner scoped; returns quote detail plus conditional Stripe card-on-file metadata)
- `POST /api/account/quotes/:quoteId/billing-mode` (auth + phone required, owner scoped; switches `seasonal` / `per_session` before payment starts)
- `POST /api/account/quotes/:quoteId/billing-portal` (auth required, owner scoped; opens Stripe-hosted card management when a Stripe customer billing context exists)

Client-side quote draft resilience:

- Local snapshot key: `autoscape.quoteDraft.v2`
- Stored state includes:
  - address input + selected address metadata
  - map center + step state
  - polygon history (past/present/future)
  - unit mode + billing mode
  - internal `distanceToNearestStationKm` from service-area check
- restore hydration completes before auto-save writes back, so map-step snapshots reopen on the Mapbox builder rather than being overwritten by the initial address state
- legacy local `serviceFrequency` fields are accepted and stripped during restore
- Reset/clear controls are UI-level only and do not mutate server quote records.

Quote editor/source geometry contract:

- `polygonSource.schemaVersion = 2`
- `activePolygonId: string | null`
- `polygons[]`
  - `id`
  - `kind`
  - `ringPoints`
  - `rawStrokePoints: LngLat[] | null`
- canonical `polygon_geom` remains server-measured and is derived from `ringPoints`
- legacy `schemaVersion: 1` point-list payloads are intentionally rejected after the freehand cutover

Shared quote-drawing simplification:

- `shared/freehand.ts`
  - raw stroke points are deduped geodesically first
  - draw-end simplification distance-normalizes freehand strokes, caps vertex density by distance, removes redundant wobble on straight runs, and trims overlapping close-loop tails
  - sharp corners and intentional curves are preserved
  - simplification uses distance-based stroke normalization rather than pointer-event density
- selected polygon outlines can be clicked near an edge to insert a new vertex at the projected on-line position

Quote pricing contract:

- `quoteTotal` remains compatibility alias for per-visit total
- formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 45)`
  - `D` = nearest active base-station distance in km
- canonical fields:
  - `serviceFrequency`, `perSessionTotal`, `sessionsMin`, `sessionsMax`
  - `seasonalTotalMin`, `seasonalTotalMax` (compatibility alias pair, now fixed to one total)
  - `fullSeasonTotal`, `seasonalDiscountedTotal`, `seasonalSavingsTotal`
  - `seasonalDiscountRate`, `billingMode`
  - `globalDiscountRate`, `priceOverrideEnabled`, `overrideBasePerSessionTotal`
- service frequency is weekly-only:
  - `weekly` => `20` visits from May to September
- admin-created quote pricing supports global discount default `0%`, seasonal discount default `20%`, both clamped to `0-50%`; override mode stores the edited base per-visit amount and recalculates the visible per-visit/seasonal values from active discounts
- migration `20260415163000_weekly_only_service_frequency` normalizes any stored non-weekly rows to weekly 20-visit totals before tightening the Prisma enum; older historical migrations are left intact for migration-history safety

Customer profile sync contract:

- signed-in draft creation records address to Clerk private metadata (`autoscapeProfile`)
- metadata shape:
  - `defaultAddress: string`
  - `addressHistory: string[]` (latest-first, deduped, max 10)
  - `emailMarketingConsent?: boolean` (optional complete-profile email opt-in stored in Clerk unsafe metadata)
- quote finalize performs a secondary address sync pass
- quote claim/finalize propagates account email marketing opt-in into the lead `consentMarketing` field

### Contact

- `POST /api/contact` (idempotent)
- payload accepts optional `marketingConsent?: boolean`
- contact-form opt-in persists to `Lead.consentMarketing`; omitted or false consent does not opt the lead into marketing

### Service Area

- `GET /api/service-area` (ETag + cache)
- `POST /api/service-area/check` (includes `distanceToNearestStationKm`)
- `POST /api/service-area/request` (idempotent)
- Service-area generation uses server-side base-station config and falls back to the default Vaughan station when no base-station env is provided, including production.

Idempotency behavior:

- request hash stored by `(scope, idempotency_key)`
- same key + same payload => exact stored response replay
- same key + different payload => `409 Conflict`

## 5) Admin API Shape

All admin endpoints are under `/api/admin/*` and return cursor pagination payloads:

- `GET /api/admin/health`
- `GET /api/admin/quotes`
- `POST /api/admin/quotes/reserve-id`
- `POST /api/admin/quotes`
- `PATCH /api/admin/quotes/:id/status`
- `POST /api/admin/quotes/:id/revise`
- `GET /api/admin/quotes/:id/editor`
- `POST /api/admin/quotes/:id/versions`
- `POST /api/admin/quotes/:id/versions/:versionNumber/submit`
- `POST /api/admin/quotes/:id/approval-email/resend`
- `POST /api/admin/quotes/:id/notes`
- `GET /api/admin/service-area-requests`
- `GET /api/admin/service-area-requests/map`
- `GET /api/admin/leads`
- `GET /api/admin/contacts`
- `GET /api/admin/audit-logs`
- `GET /api/admin/attribution/summary`
- `GET /api/admin/exports/quotes.csv`

Response envelope for list endpoints:

```json
{
  "items": [],
  "nextCursor": "...",
  "meta": {
    "generatedAt": "...",
    "rowCount": 25,
    "filters": {}
  }
}
```

Admin list query model:

- all list endpoints accept `q`, `sortBy`, `sortDir`, `limit`, `cursor`
- each endpoint supports additional tab-specific filters (status, source, channel, actor role, etc.)
- admin UI keeps these search/filter/sort controls in collapsed per-tab panels by default, labels the service-area queue `Area requests`, and keeps quote CSV export as a low-prominence bottom action

## 6) Quote State Machine

Internal `status`:

- `draft`
- `submitted`
- `in_review`
- `verified`
- `rejected`

Customer-facing `customer_status`:

- `pending`
- `updated`
- `verified`
- `awaiting_payment`
- `rejected`

Allowed transitions:

- `draft -> submitted`
- `submitted -> in_review`
- `in_review -> verified`
- `in_review -> rejected`

Runtime quote finalize behavior:

- `POST /api/quote/:quoteId/contact` now moves drafts directly to `in_review` with `customer_status=pending`.
- quote-contact payload accepts optional `message` + optional `attribution` only.
- lead phone is derived from Clerk customer identity; lead contact address is derived from quote draft address.
- `submitted` remains in the enum for backward compatibility and controlled transitions.

Revisions:

- Do not move status backward.
- Keep quote in `in_review`.
- Append immutable `quote_versions` row.
- Update `customer_status` to `updated`.
- Revise endpoint treats per-visit total as canonical and recomputes seasonal range fields.
- Quote editor versions include `actor_type` (`client` or `admin`) + `version_number` + `changed_at`.
- Version submit endpoint applies selected version and sets `status=verified` + `customer_status=awaiting_payment`.
- Successful verification creates a hashed public payment token, attempts the simplified one-button approved-quote payment email through Resend, and records `approval_email_sent` or `approval_email_failed`; approval is not rolled back if delivery or preview preflight fails.
- Admins can manually resend via `POST /api/admin/quotes/:id/approval-email/resend` when a quote is verified and awaiting payment; resend rotates the public payment token and revokes prior active tokens.
- Public `/pay/:token` pages and authenticated `/dashboard/quotes/:quoteId/payment` pages use task-first mobile layouts and Stripe Checkout. Seasonal quotes charge the approved discounted seasonal total once; per-session quotes create weekly subscriptions that use a May 1 billing-cycle anchor with no proration before season or charge at checkout during season, cap paid invoices at `sessionsMax`, and stop no later than September 30.
- Approved-quote payment emails show only the payment-link amount/mode that will be sent to Stripe, include the approved map preview unchanged, and render added/removed map legend keys only when those preview deltas exist.
- Hosted Checkout requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the API service only. Staging currently has both configured and still needs end-to-end checkout smoke testing.
- Quote lookup responses include verified status fields plus payment-page, payment-state, and tokenized preview-image metadata for the customer dashboard/payment page. Account quote detail responses also include conditional Stripe billing metadata so the dashboard can surface the current saved card and link into Stripe Customer Portal without duplicating card-management UI.
- The customer dashboard ranks one primary quote by urgency (`awaiting payment/payment issue` -> `in review` -> `draft/contact pending` -> `paid/active`), renders task-first CTAs before secondary account data on mobile, and renders quote history only when multiple quotes exist and the primary quote is not complete.
- Webhook events are stored idempotently by Stripe event ID; paid subscription invoice IDs are also tracked to keep the paid visit counter from advancing twice for the same invoice.

Development cutover:

- `server/src/scripts/freehandCutoverResetDevData.ts`
- `npm --prefix server run cutover:freehand-reset-dev-data`
- script truncates quote/editor/leads/test-contact attribution/audit/idempotency tables while preserving schema + base-station/reference data

## 7) Attribution Rules

- One `first_touch` per lead.
- One active `last_touch` per lead.
- One `submit_snapshot` per submitted quote.
- Reporting defaults:
  - acquisition: `first_touch`
  - conversion: `submit_snapshot`

## 8) Security and PII Controls

Authentication:

- provider: Clerk for both customer and admin apps
- bearer token verification against Clerk issuer/JWKS
- required server env: `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER`, `CLERK_ADMIN_ORG_ID`

Quote ownership:

- `quotes.auth_user_id` stores owning customer account ID
- quote claim endpoint binds drafts to customer identity
- quote read/finalize endpoints enforce owner match unless caller is admin
- account quote APIs and quote finalize require customer profile phone completeness

Customer profile completeness:

- required account field: phone number
- client gate route: `/complete-profile/*`
- dashboard and quote-confirmation flows redirect to the mobile-readable profile gate when phone is missing
- phone source of truth: Clerk `unsafeMetadata.autoscapeProfile.phone` (fallback from Clerk primary phone when available)
- shared Clerk appearance helper: `client/src/lib/clerkAppearance.ts` applies Autoscape colors, buttons, inputs, and card styling to public sign-in, sign-up, and account profile screens

RBAC roles:

- `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`

Capabilities:

- `VIEW_PII_FULL`: OWNER/ADMIN/REVIEWER
- `VIEW_ATTRIBUTION`: all admin roles
- `EXPORT_PII_FULL`: OWNER/ADMIN/REVIEWER
- `EXPORT_MARKETING_SAFE`: all admin roles

Admin identity + role source:

- admin caller must belong to configured Clerk organization (`CLERK_ADMIN_ORG_ID`)
- Clerk org roles map as:
  - `owner` -> `OWNER`
  - `admin` -> `ADMIN`
  - `reviewer` -> `REVIEWER`
  - `marketing` -> `MARKETING`
- legacy static token/header-role admin auth has been removed

PII masking:

- MARKETING responses mask name/email/phone
- CSV export for MARKETING is masked by default

## 9) Service-Area Privacy Hardening

Service-area geometry pipeline:

1. geodesic 10km station buffers (server only)
2. merged union geometry
3. simplification + deterministic jitter + 3-decimal quantization
4. no station IDs/coordinates/markers in response

## 10) Launch Cutoff

`SYSTEM_LAUNCH_AT` is applied on analytics-style queries (e.g. attribution summary) to avoid pre-launch noise.
