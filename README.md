# Autoscape Web App

Autoscape is a multi-app monorepo for:

- public marketing + instant quote flow (`client/`)
- API + quote operations backend (`server/`)
- admin operations console (`admin/`)
- public shell branding uses the horizontal Autoscape PNG mark at `client/public/images/brand/autoscape-horizontal-brand.png`
- public shell loads the Google Ads tag `AW-17991079326` from `client/index.html`
- successful public `Submit Quote` draft saves fire the Google Ads `Submit lead form` conversion `AW-17991079326/FqIMCOHXqYIcEJ6r6IJD`

## Documentation Map

- Project context: [`project_context.md`](./project_context.md)
- Agent/project guidelines: [`AGENTS.md`](./AGENTS.md)
- Docs index: [`docs/README.md`](./docs/README.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Feature flow: [`docs/feature_flow.md`](./docs/feature_flow.md)
- Design decisions: [`docs/design.md`](./docs/design.md)
- Deployment: [`docs/deployment.md`](./docs/deployment.md)
- Legal evidence report: [`docs/legal_evidence_report.md`](./docs/legal_evidence_report.md)

## Stack

- Public frontend: React + Vite + TypeScript + Tailwind + Mapbox GL + Turf.js
- Admin frontend: React + Vite + TypeScript + Mapbox GL for quote editing + MapLibre GL for request maps
- Backend API: Node.js + TypeScript + Zod
- Authentication: Clerk (customer + admin)
- Persistence: Prisma + PostgreSQL (Neon-compatible) + PostGIS
- Fallback persistence: in-memory store when `DATABASE_URL` is not set (local/dev convenience)
- Hosted Node runtime: package manifests pin `engines.node` to `20.x` for DigitalOcean App Platform builds.

## Quick Start

1. Install root deps and app deps:

```bash
npm install
npm --prefix server install
npm --prefix client install
npm --prefix admin install
```

2. Configure env files:

```bash
cp .env.example .env
cp client/.env.example client/.env
cp server/.env.example server/.env
cp admin/.env.example admin/.env
```

3. Configure required env values:

```bash
# client/.env
VITE_API_BASE_URL=http://localhost:4000
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me

# server/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoscape?schema=public
CLERK_SECRET_KEY=sk_test_replace_me
CLERK_JWT_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_ADMIN_ORG_ID=org_replace_me
SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z
RESEND_API_KEY=re_replace_me
APPROVED_QUOTE_EMAIL_FROM="Autoscape <contact@autoscape.ca>"
APPROVED_QUOTE_EMAIL_REPLY_TO=contact@autoscape.ca
PUBLIC_APP_BASE_URL=http://localhost:5173
PUBLIC_API_BASE_URL=http://localhost:4000
MAPBOX_STATIC_ACCESS_TOKEN=pk.your_mapbox_public_token
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me

# admin/.env
VITE_API_BASE_URL=http://localhost:4000
VITE_PUBLIC_APP_BASE_URL=http://localhost:5173
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
```

4. Generate Prisma client + migrate DB:

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate:dev
```

5. If you are cutting an existing development/test database over to the freehand editor, wipe old quote data once:

```bash
npm --prefix server run cutover:freehand-reset-dev-data
```

6. Run apps:

```bash
npm run dev        # public app + API
npm run dev:admin  # admin app
```

Default local URLs:

- Public: `http://127.0.0.1:5173`
- API: `http://localhost:4000`
- Admin: `http://127.0.0.1:5174`

Local dev connectivity notes:

- The public app submits quote drafts to `VITE_API_BASE_URL`, which defaults to `http://localhost:4000`.
- If quote submit reports that it cannot reach the API, start the backend with `npm --prefix server run dev` and confirm `GET /api/health` responds on port `4000`.
- The API now reflects loopback frontend origins (`localhost`, `127.0.0.1`, `[::1]`) across arbitrary local Vite ports so alternate dev ports do not silently fail CORS.

## Deployment

Production-like hosting uses DigitalOcean App Platform with two isolated apps:

- Staging: `staging` branch -> `autoscape-staging`, auto-deployed to `staging.autoscape.ca`, `api-staging.autoscape.ca`, and `admin-staging.autoscape.ca`.
- Production: `main` branch -> `autoscape-production`, manually deployed to `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, and `admin.autoscape.ca`.

Each environment has `public-web` (`client/` static site), `admin-web` (`admin/` static site), `api` (`server/` Node service), a pre-deploy Prisma migration job, and its own DigitalOcean Managed PostgreSQL database with PostGIS enabled. App spec templates live in `.do/app.staging.yaml` and `.do/app.production.yaml`; fill secrets only in DigitalOcean or in ignored private spec copies. DigitalOcean's Node buildpack reads the committed `engines.node=20.x` package pins for runtime selection. See [`docs/deployment.md`](./docs/deployment.md) for setup, env vars, DNS, smoke tests, and rollback.

Current live status: `autoscape-staging` is active in Toronto with `autoscape-staging-db` on PostgreSQL 16 and migrations applied. Staging uses self-managed GoDaddy CNAME records pointing at the DigitalOcean default ingress, and the custom domains are active. Authenticated customer/admin smoke tests passed on staging, including quote finalization, admin verification, and persistence after redeploy. The deployed API now exposes the approved-quote preview route and admin approval-email resend route. The staging API has both Stripe secrets configured; Stripe checkout smoke testing still needs to pass. Production has not been created because the end-to-end approval email/resend smoke, Stripe staging checkout smoke, and launch confirmation still need to happen.

## Public Flow Highlights

- `/services` starts with the Service Area map card, using a shorter mobile map height so the address CTA and services remain visible sooner.
- Coverage overlay now uses a light basemap + green `#329F5B` polygon treatment and remains privacy-hardened.
- Service-area endpoints use configured server-side base stations, with the default Vaughan station loaded whenever no base-station env is provided so production does not silently become empty coverage.
- Services page uses CTA-only handoff to `/instant-quote`.
- Services page now presents five inline premium-vector service illustrations for Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
- Marketing pages now use launch-ready production copy (no placeholder content), warm-light visual tokens, and readability-first spacing/contrast across the home, services, and contact surfaces, with mobile navigation, a cleaner signed-out header divider, route-aware full/compact footer variants, footer quick links, and a contact page that promotes compact direct phone/email actions beside the message form.
- Public legal pages are served from `/legal` and `/legal/:slug`, using Markdown sources in `client/src/content/legal/` plus a small raw-Markdown renderer. Footer links expose Privacy, Terms, Cookies, Payments, and the full legal index across both full and compact footer variants.
- Contact, quote submit, complete-profile, claim-quote, and approved-payment checkout actions now include nearby Privacy/Terms/Payment or Estimate Terms links. The contact form and complete-profile account intake include an optional unchecked email-marketing opt-in; SMS marketing remains inactive at launch.
- Home hero now uses a balanced desktop split: left-side headline and CTA group with `No sign-up required.`, a mobile-stacked CTA row on narrow screens, and a right-side animated transparent lawn parcel with a looping three-state sequence: perimeter `learning your lawn...`, 2-second `Generating path`, then `Mowing...` along an 11-pass rounded boustrophedon infill path with denser direction arrows, direct mowing spawn on the first scanline, and a ticker-flip status capsule sized to the active label and centered under the full lawn graphic. On mobile, the lawn graphic appears directly under `Precise Cuts, Lower Costs` and before the CTA buttons.
- Home page now keeps a tighter top-of-page flow: hero, pricing comparison, mower technology section, three-card services overview with Autonomous Mowing, Edging, and Cleanup & Debris, FAQ, and final quote CTA, with flatter post-hero sections, an unboxed larger sample lawn price check with extra intro spacing, a narrower row-label column, a seasonal `20% off` corner badge, icon-led mower specs, larger FAQ answers with bolded key phrases, and the older Why Electric, How It Works, Why Autoscape, and Testimonials sections removed. On mobile, the mower asset appears directly beneath the `Meet our lawnmowers` heading before the highlight list.
- Instant Quote flow is now draft-first:
  - intro chrome uses a badge-only heading and a compact-on-mobile three-step progress rail instead of marketing helper copy
  - address entry stacks the address input and continue button on mobile, clicked suggestions and highlighted Enter selections immediately run the coverage gate before continuing, and a pending state prevents duplicate coverage checks
  - the map step uses a thin address pill instead of a large step header card
  - geometry capture is persistent freehand drawing, not point-by-point vertex placement
    - `Draw lawn` and `Draw obstacle` toggle into `Stop drawing`
    - completed strokes automatically exit draw mode instead of staying latched on
    - draw-end simplification now distance-normalizes freehand strokes, caps vertex density by distance, and removes redundant wobble on straight edges while preserving sharp corners and intentional curves
    - overlapping start/end loop-closure cleanup now collapses freehand close-loop overlap into one clean join corner
    - clicking near the outline of the currently selected polygon inserts a vertex at that exact edge position and selects it immediately
    - undo/redo live in a separate arrow-only control box at the top-left of the map on desktop and in the first row of the compact mobile top dock
    - delete + clear-all stay grouped together, and `Clear all` requires inline confirmation
    - freehand-created polygons remain vertex-editable for cleanup after the stroke is finished
    - map edits no longer auto-reframe/zoom the viewport after each geometry change
    - property center now uses a green home icon inside the white map marker
  - service frequency is weekly-only with 20 visits from May to September; there is no frequency selector in the public or admin workflow
    - migration `20260415163000_weekly_only_service_frequency` normalizes stored non-weekly quote/version rows before tightening the enum
  - pricing formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 45)`
    - `D` = nearest active base-station distance in km (internal-only)
  - quote outputs include per-visit, full-season, and discounted seasonal totals
  - billing modes: `seasonal` (default, 20% discount) and `per_session`
  - quote drawing map keeps satellite basemap by default, with warm-light control panels for readability
  - `/instant-quote` is now a map-first builder page with a stronger floating top-right action cluster containing `Guide` and `Done`; mobile uses a two-row top dock with undo/redo plus compact `Guide`/`Done` above `Lawn`, `Obstacle`, `Delete`, and `Clear`
  - the under-map area/perimeter/lawn/obstacle/unit/draft summary card is hidden on mobile and kept on desktop
  - after a fresh successful address-to-map transition, the map now reveals a centered guide modal shell 1 second after the map finishes loading
    - guide step 1 now uses the polished top-down house SVG as the live popup background instead of the old inline illustration
    - the tutorial first focuses on the front down lawn zone inside the same framed viewport treatment used by step 2 so the background stays consistent between slides: it clicks `Draw lawn`, traces one loose curvy hand-drawn outline, finalizes that stroke through the shared freehand finalizer, then lets the camera glide with a shared 1.6-second transform while cursor movement and vertex dragging stay at normal guide speed
    - step 1 then draws the top-left lawn zone so both left-side service polygons are complete before the guide advances
    - guide step 2 now starts from those two completed left-side lawns, draws only the right-side backyard zone, and keeps previously finished polygons unselected with the same fill/outline styling used in the live quote map
    - step 2 intentionally finalizes the backyard with one missing garden-notch corner and one extra redundant point, then uses the same 1.6-second camera transform timing without slowing cursor/edit phases to show edge insertion, dragging the inserted point into the exact notch, moving directly to the toolbar `Delete` button, showing a stronger click pulse, removing the extra point, and easing back out before ending on a corrected three-zone lawn state
    - guide step 3 now keeps the same popup-house SVG background and the carried-over three-zone lawn, clicks `Draw obstacle`, draws a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that finished scene for 2 seconds before looping again
    - the guide shell now uses a cleaner editorial popup treatment with one white panel, responsive shorter mobile demo heights, a right-sized desktop demo viewport whose camera layer is offset to match the map-body clip window so the SVG starts centered and the bottom stays visible, equal-width toolbar buttons, a slowly fading unified demo-and-caption media unit with no divider or white caption box between the SVG and text, a tighter centered caption strip directly under the demo, and a flat navigation row with centered segmented progress
    - the animated SVG steps now use a gentle loop-edge fade so the demo appears softly, fades back out as each loop finishes, and crossfades more smoothly between guide slides
    - on the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool instead of dismissing the guide session
    - the popup-house SVG background now uses a fresher brighter palette so the lawn, deck, garden, and trees read with more energy and contrast
    - the caption strip is now step-aware: step 1 uses `Draw loosely around your lawn.` and `Move the points to match your lawn.`, step 2 uses `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 uses `Use Draw obstacle for gardens, pools, and other no-mow areas.`
    - a manual `Guide` help button beside `Done` reopens the guide at step 1 even after the automatic guide has been dismissed
    - dismissing the guide keeps it closed for the current mapped address session and it reappears only after the next successful address load
    - restored local drafts do not auto-open the guide
  - `/instant-quote/summary` now removes the step progress rail and uses a two-section quote-ready review layout: a top `Back to Map` action, a desktop top row with address-first quote details on the left, top price cards separated by an `or` divider, and a fitted desktop-only map preview plus quiet whole-number area/perimeter metadata on the right, then a full-width lower payment-plan section with accessible radio plan cards separated by an `or` divider under `Choose how to pay`; the seasonal savings chip sits inside the season plan card instead of its own summary card
  - address suggestions support keyboard navigation (`ArrowUp/ArrowDown/Enter/Escape`)
  - browser-local draft persistence auto-saves address, step state, polygons, units, and billing mode
    - local draft storage key/version is `autoscape.quoteDraft.v2`
    - restored map-step drafts hydrate before auto-save writes back, so refreshes reopen the Mapbox builder instead of resetting to address entry
    - legacy `serviceFrequency` values in local drafts are stripped during restore
  - quote/editor source payload is `schemaVersion: 2`
    - polygons store `id`, `kind`, `ringPoints`, and nullable `rawStrokePoints`
    - server derives/stores canonical quote geometry from `ringPoints` and remeasures it server-side
    - legacy point-list `schemaVersion: 1` source payloads are no longer accepted at runtime
  - users can clear geometry or reset saved draft from the quote UI
  1. `/instant-quote/summary` reviews pricing and preferences before any server draft is created
  2. `POST /api/quote/draft`
  3. Draft handoff continues to `/quote-confirmation/:quoteId` (legacy `/quote-contact/:quoteId` links redirect here)
  4. Signed-in draft saves quote address to Clerk account metadata (`addressHistory`, latest as `defaultAddress`)
  5. `POST /api/quote/:quoteId/claim` links quote to authenticated account
  6. `/quote-confirmation/:quoteId` handles sign-in and required phone gating before review handoff
  7. `POST /api/quote/:quoteId/contact` finalizes contact + sets status `in_review` (`customer_status=pending`)
  8. Confirmation page `/quote-confirmation/:quoteId`
- Admin-created quote claim flow:
  - admins can open `/quotes/new`, reserve a real six-character easy Quote ID before save, draw lawn/obstacle geometry on the Mapbox Satellite Streets quote map with building/house-number context where available, and save an anonymous payable quote directly as `status=verified`, `customer_status=awaiting_payment`, `contact_pending=false`
  - admin-created quotes stay in the existing `quotes` table with `auth_user_id=null` until the customer claims them; version 1 is stored in `quote_versions` with `actor_type=admin`
  - `/claim-quote` accepts a six-character SMS-style Quote ID entry grouped as `ABC 123`, and `/claim-quote?quoteId=ABC123` preloads the preview; legacy `Q-...` links continue to resolve
  - claiming now requires an authenticated account with completed phone, then attaches `quotes.auth_user_id`, records a `quote_claim` contact event when contact data is available, lets the customer choose `seasonal` or `per_session`, and opens Stripe Checkout directly from the claim flow
- Customer dashboard:
  - `/complete-profile/*` captures required phone number for any auth method
    - it also stores optional email marketing opt-in at `unsafeMetadata.autoscapeProfile.emailMarketingConsent`, which the API propagates to lead records during quote claim/finalize
  - `/dashboard` is now an action-first customer home with mobile-first CTA placement, a primary quote state, lifecycle timeline, May-September schedule note, support panel, conditional quote history, and conditional card-on-file panel
  - `/dashboard/account/*` renders Clerk profile/security/password management with the shared Autoscape Clerk appearance inside the dashboard area
  - `/dashboard/quotes/:quoteId` for owned quote detail with grouped mobile-readable quote summaries
  - `/dashboard/quotes/:quoteId/payment` is the authenticated approved-quote payment surface with task-first mobile CTAs and can start Stripe Checkout for owned quotes
- Public payment:
  - approved quote emails now use a simplified Autoscape-styled transactional layout with one `/pay/:token` CTA, the actual selected payment amount/mode, quote details, Stripe reassurance, and the unchanged approved map preview
  - public payment tokens are long random secrets stored only as SHA-256 hashes server-side
  - `GET /api/payment-links/:token` returns sanitized quote/payment details without requiring Clerk sign-in
  - `POST /api/payment-links/:token/checkout` creates or reuses a Stripe Checkout Session
  - signed-in customers can also use `POST /api/account/quotes/:quoteId/payment/checkout` from the dashboard
  - customers can switch billing before payment starts with `POST /api/account/quotes/:quoteId/billing-mode`
  - `POST /api/account/quotes/:quoteId/billing-portal` opens Stripe-hosted card management for owners when Stripe has customer billing context, and account quote detail now includes conditional card-on-file metadata
- Out-of-area page auto-captures expansion demand via `POST /api/service-area/request`.

## Service Area Privacy

- Exact base station coordinates stay server-only.
- API returns merged/simplified/quantized geometry only.
- No station markers, IDs, or centers are sent to clients.
- Service-area check and request endpoints are rate-limited.

## Admin Platform v1

Admin endpoints under `/api/admin/*` include:

- quotes inbox (`/quotes`) with cursor pagination
- new polished admin quote creator (`/quotes/new`) with reserved six-character Quote ID, copyable generic/direct claim links, Mapbox address search, Satellite Streets property context, warning-only service-area check, live area/perimeter/lawn/obstacle/vertex stats, global + seasonal discounts, and admin price override mode
- quote editor (`/quotes/:quoteId/edit`) with full polygon tools, calculated vs actual quote panel, and version history
  - Mapbox Satellite Streets basemap in editor for property verification context, with building outlines and house-number labels where available
  - persisted quote polygons hydrate immediately when editor opens
  - editor now mirrors the public quote map styling and uses the same freehand `Draw lawn` / `Draw obstacle` workflow, vertex dragging, outline-click vertex insertion, delete/clear actions, and shared draw-end simplifier as the public quote tool
  - approved quotes show latest Stripe payment state and related Stripe object IDs for admin support
- service-area request map payload (`/service-area-requests/map`) for heatmap/cluster rendering
- quote versioning APIs:
  - `POST /api/admin/quotes/reserve-id`
  - `POST /api/admin/quotes`
  - `GET /api/admin/quotes/:id/editor`
  - `POST /api/admin/quotes/:id/versions`
  - `POST /api/admin/quotes/:id/versions/:versionNumber/submit`
- approved quote delivery:
  - selected version submit sets `status=verified` / `customer_status=awaiting_payment`, creates a fresh secure payment token, attempts a one-button payment-focused Resend transactional email, and records `approval_email_sent` or `approval_email_failed` without rolling back approval
  - manual resend is available at `POST /api/admin/quotes/:id/approval-email/resend`
  - public preview images are served from `GET /api/approved-quote-preview/:token`, which proxies a Mapbox satellite static image with approved, added, and removed service-area overlays
- Stripe payment APIs:
  - `GET /api/payment-links/:token`
  - `POST /api/payment-links/:token/checkout`
  - `POST /api/account/quotes/:quoteId/payment/checkout`
  - `POST /api/stripe/webhook`
  - seasonal quotes use one-time Checkout for the approved discounted seasonal total
  - per-visit quotes use weekly subscription Checkout, use a May 1 billing-cycle anchor before season or charge at checkout during season, cap billing at `sessionsMax`, and stop no later than September 30
  - paid Stripe invoice IDs are stored so duplicate invoice events cannot advance the visit counter twice
- quote notes and legacy revision endpoint (`/api/admin/quotes/:id/revise`)
- service-area requests, leads, contacts, audit logs
- attribution summary (`/attribution/summary`)
- CSV export with role-aware PII policy (`/exports/quotes.csv`); the admin UI exposes this as a quieter bottom-page action

The admin shell uses the fixed Autoscape light theme, a non-scrolling sidebar with the service-area queue labeled `Area requests`, and collapsed filter/sort panels for `q`, tab-specific filters, `sortBy`, and `sortDir`.

Admin auth:

- bearer token auth from Clerk only (no static token and no header-role fallback)
- admin access requires membership in configured `CLERK_ADMIN_ORG_ID`
- customer phone completeness is enforced in-app via `/complete-profile/*`
- phone is stored in Clerk `unsafeMetadata.autoscapeProfile.phone` (no paid phone auth dependency)
- Clerk org roles map to internal RBAC roles:
  - `owner` -> `OWNER`
  - `admin` -> `ADMIN`
  - `reviewer` -> `REVIEWER`
  - `marketing` -> `MARKETING`

RBAC roles:

- `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`

PII policy:

- `MARKETING` receives masked PII in list responses and exports.
- full PII export is restricted to `OWNER/ADMIN/REVIEWER`.
- quote-mutating endpoints are restricted to `OWNER/ADMIN/REVIEWER`; `MARKETING` is read-only.

## Base Station Management

Base stations are internal-only and loaded from server env:

- `AUTOSCAPE_BASE_STATIONS_FILE=/absolute/path/to/base-stations.json` (preferred)
- `AUTOSCAPE_BASE_STATIONS_JSON=[...]`

Default non-production station:

- `L6A1M7` center `43.844147, -79.51962`
- default served region `Vaughan, Ontario`

## Scripts

- `npm run dev`: server + public app
- `npm run dev:all`: server + public app + admin
- `npm run dev:admin`: admin app only
- `npm run build:all`: build server + public app + admin
- `npm --prefix server run cutover:freehand-reset-dev-data`: destructive dev-only reset for quote/leads/editor test data before freehand rollout

## Tests

Server:

```bash
npm --prefix server run test
```

Client unit suites (targeted):

```bash
npm --prefix client exec vitest run src/lib/quote.test.ts src/lib/quoteFlow.test.ts src/lib/multiPolygonMetrics.test.ts src/lib/polygonHistory.test.ts
```

Admin type check:

```bash
npm --prefix admin run lint
```
