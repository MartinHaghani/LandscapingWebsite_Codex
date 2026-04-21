# Autoscape Web App

Autoscape is a multi-app monorepo for:

- public marketing + instant quote flow (`client/`)
- API + quote operations backend (`server/`)
- admin operations console (`admin/`)

## Documentation Map

- Project context: [`project_context.md`](./project_context.md)
- Agent/project guidelines: [`AGENTS.md`](./AGENTS.md)
- Docs index: [`docs/README.md`](./docs/README.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Feature flow: [`docs/feature_flow.md`](./docs/feature_flow.md)
- Design decisions: [`docs/design.md`](./docs/design.md)
- Deployment: [`docs/deployment.md`](./docs/deployment.md)

## Stack

- Public frontend: React + Vite + TypeScript + Tailwind + Mapbox GL + Turf.js
- Admin frontend: React + Vite + TypeScript + MapLibre GL
- Backend API: Node.js + TypeScript + Zod
- Authentication: Clerk (customer + admin)
- Persistence: Prisma + PostgreSQL (Neon-compatible) + PostGIS
- Fallback persistence: in-memory store when `DATABASE_URL` is not set (local/dev convenience)

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

# admin/.env
VITE_API_BASE_URL=http://localhost:4000
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

Each environment has `public-web` (`client/` static site), `admin-web` (`admin/` static site), `api` (`server/` Node service), a pre-deploy Prisma migration job, and its own DigitalOcean Managed PostgreSQL database with PostGIS enabled. App spec templates live in `.do/app.staging.yaml` and `.do/app.production.yaml`; fill secrets only in DigitalOcean or in ignored private spec copies. See [`docs/deployment.md`](./docs/deployment.md) for setup, env vars, DNS, smoke tests, and rollback.

Current live status: `autoscape-staging` is active in Toronto with `autoscape-staging-db` on PostgreSQL 16 and migrations applied. Custom staging domains are `CONFIGURING` with `DomainUnexpectedNameserver`, so custom-domain smoke tests and production setup are waiting on `autoscape.ca` DNS delegation.

## Public Flow Highlights

- `/services` starts with the Service Area map card.
- Coverage overlay now uses a light basemap + green `#329F5B` polygon treatment and remains privacy-hardened.
- Service-area endpoints use configured server-side base stations, with the default Vaughan station loaded whenever no base-station env is provided so production does not silently become empty coverage.
- Services page uses CTA-only handoff to `/instant-quote`.
- Services page now presents five inline premium-vector service illustrations for Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
- Marketing pages now use launch-ready production copy (no placeholder content), warm-light visual tokens, and readability-first spacing/contrast across the home, services, and contact surfaces, with mobile navigation and footer quick links.
- Home hero now uses a balanced desktop split: left-side headline and CTA group with `No sign-up required.`, right-side animated transparent lawn parcel with a looping three-state sequence: perimeter `learning your lawn...`, 2-second `Generating path`, then `Mowing...` along an 11-pass rounded boustrophedon infill path with denser direction arrows, direct mowing spawn on the first scanline, and a ticker-flip status capsule sized to the active label.
- Home page now keeps a tighter top-of-page flow: hero, pricing comparison, mower technology section, services overview, FAQ, and final quote CTA, with the older Why Electric, How It Works, Why Autoscape, and Testimonials sections removed.
- Instant Quote flow is now draft-first:
  - intro chrome uses a badge-only heading and a three-step progress rail instead of marketing helper copy
  - map step uses a thin address pill instead of a large step header card
  - geometry capture is persistent freehand drawing, not point-by-point vertex placement
    - `Draw lawn` and `Draw obstacle` toggle into `Stop drawing`
    - completed strokes automatically exit draw mode instead of staying latched on
    - draw-end simplification now distance-normalizes freehand strokes, caps vertex density by distance, and removes redundant wobble on straight edges while preserving sharp corners and intentional curves
    - overlapping start/end loop-closure cleanup now collapses freehand close-loop overlap into one clean join corner
    - clicking near the outline of the currently selected polygon inserts a vertex at that exact edge position and selects it immediately
    - undo/redo live in a separate arrow-only control box at the top-left of the map
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
  - `/instant-quote` is now a map-first builder page with a stronger floating top-right action cluster containing `Guide` and `Done`
  - after a fresh successful address-to-map transition, the map now reveals a centered guide modal shell 1 second after the map finishes loading
    - guide step 1 now uses the polished top-down house SVG as the live popup background instead of the old inline illustration
    - the tutorial first focuses on the front down lawn zone inside the same framed viewport treatment used by step 2 so the background stays consistent between slides: it clicks `Draw lawn`, traces one loose curvy hand-drawn outline, finalizes that stroke through the shared freehand finalizer, then lets the camera glide with a shared 1.6-second transform while cursor movement and vertex dragging stay at normal guide speed
    - step 1 then draws the top-left lawn zone so both left-side service polygons are complete before the guide advances
    - guide step 2 now starts from those two completed left-side lawns, draws only the right-side backyard zone, and keeps previously finished polygons unselected with the same fill/outline styling used in the live quote map
    - step 2 intentionally finalizes the backyard with one missing garden-notch corner and one extra redundant point, then uses the same 1.6-second camera transform timing without slowing cursor/edit phases to show edge insertion, dragging the inserted point into the exact notch, moving directly to the toolbar `Delete` button, showing a stronger click pulse, removing the extra point, and easing back out before ending on a corrected three-zone lawn state
    - guide step 3 now keeps the same popup-house SVG background and the carried-over three-zone lawn, clicks `Draw obstacle`, draws a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that finished scene for 2 seconds before looping again
    - the guide shell now uses a cleaner editorial popup treatment with one white panel, a right-sized demo viewport whose camera layer is offset to match the map-body clip window so the SVG starts centered and the bottom stays visible, equal-width toolbar buttons, a slowly fading unified demo-and-caption media unit with no divider or white caption box between the SVG and text, a tighter centered caption strip directly under the demo, and a flat navigation row with centered segmented progress
    - the animated SVG steps now use a gentle loop-edge fade so the demo appears softly, fades back out as each loop finishes, and crossfades more smoothly between guide slides
    - on the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool instead of dismissing the guide session
    - the popup-house SVG background now uses a fresher brighter palette so the lawn, deck, garden, and trees read with more energy and contrast
    - the caption strip is now step-aware: step 1 uses `Draw loosely around your lawn.` and `Move the points to match your lawn.`, step 2 uses `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 uses `Use Draw obstacle for gardens, pools, and other no-mow areas.`
    - a manual `Guide` help button beside `Done` reopens the guide at step 1 even after the automatic guide has been dismissed
    - dismissing the guide keeps it closed for the current mapped address session and it reappears only after the next successful address load
    - restored local drafts do not auto-open the guide
  - `/instant-quote/summary` now removes the step progress rail and uses a two-section quote-ready review layout: a top `Back to Map` action, a desktop top row with address-first quote details on the left and a fitted map preview plus quiet whole-number area/perimeter metadata on the right, then a full-width lower payment-plan section with accessible radio plan cards under `Choose how to pay`
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
- Customer dashboard:
  - `/complete-profile/*` captures required phone number for any auth method
  - `/dashboard` for profile + owned quote list
  - `/dashboard/quotes/:quoteId` for owned quote detail
  - `/dashboard/quotes/:quoteId/payment` for the approved-quote placeholder payment page with shared preview image
- Out-of-area page auto-captures expansion demand via `POST /api/service-area/request`.

## Service Area Privacy

- Exact base station coordinates stay server-only.
- API returns merged/simplified/quantized geometry only.
- No station markers, IDs, or centers are sent to clients.
- Service-area check and request endpoints are rate-limited.

## Admin Platform v1

Admin endpoints under `/api/admin/*` include:

- quotes inbox (`/quotes`) with cursor pagination
- quote editor (`/quotes/:quoteId/edit`) with full polygon tools, calculated vs actual quote panel, and version history
  - satellite basemap in editor for property verification context
  - persisted quote polygons hydrate immediately when editor opens
  - editor now uses the same freehand `Draw lawn` / `Draw obstacle` workflow and shared draw-end simplifier as the public quote tool
- service-area request map payload (`/service-area-requests/map`) for heatmap/cluster rendering
- quote versioning APIs:
  - `GET /api/admin/quotes/:id/editor`
  - `POST /api/admin/quotes/:id/versions`
  - `POST /api/admin/quotes/:id/versions/:versionNumber/submit`
  - `POST /api/admin/quotes/:id/approval-email/resend`
- approved quote delivery:
  - approval now attempts a Resend-powered transactional email after `status=verified` / `customer_status=awaiting_payment`
  - email subject is `Quote Approved, Payment Required`, with the payment CTA centered as the dominant action
  - email attempts are persisted in `approved_quote_email_deliveries` with provider status, message ID/error, and a tokenized preview-image URL
  - public preview images are served from `GET /api/approved-quote-preview/:token`; production email images require `PUBLIC_API_BASE_URL` to point at a publicly reachable API host, not localhost
  - approved quote previews require `MAPBOX_STATIC_ACCESS_TOKEN` and proxy Mapbox Static Images with the quote-tool satellite style
  - preview overlays are computed from exact saved client/admin `polygonSource` versions: approved area, added-by-admin area, and removed-by-admin area
- quote notes and legacy revision endpoint (`/api/admin/quotes/:id/revise`)
- service-area requests, leads, contacts, audit logs
- attribution summary (`/attribution/summary`)
- CSV export with role-aware PII policy (`/exports/quotes.csv`)

All major list endpoints support `q`, tab-specific filters, `sortBy`, and `sortDir`.

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
