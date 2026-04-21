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
- Services marketing grid now uses five shared-style inline SVG illustrations: Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
- Navigation includes mobile menu support and quote CTA.
- Footer includes production contact details and internal quick links.
- Marketing pages (home/services/contact) use non-placeholder production copy and a warm-light readability-first design system.
- Home hero uses a symmetric desktop split with copy/CTAs on the left, `No sign-up required.` helper text under the CTA row, and a responsive animated lawn parcel on the right with a perimeter-learning wall trace, an 11-pass rounded horizontal infill raster with denser direction arrows, direct mowing spawn on the first scanline, mowing follow-through, visible CAD dimensions, a restrained under-shadow, and a dynamically sized ticker-flip status capsule stacked directly under the lawn.
- Home page places a tighter pricing comparison section directly below the hero, using a slimmer sample-lawn context block with a reduced portrait lawn SVG on the left and a shared comparison panel on the right so Autoscape and local competitors stay visually adjacent on mobile, the two boxes match height on desktop, and the same asymmetrical lawn-only mask, no interior decorative strokes, downward-facing driveway cutout, and brand-green fill treatment remain intact.
- Home page adds a `Meet our lawnmowers` section below pricing, pairing four unnumbered selling points on the left with a cleaned transparent mower asset on the right.
- Home page is streamlined to hero, pricing comparison, mower technology, services, FAQ, and the closing instant-quote CTA.

### Instant Quote Flow

0. Page opens with a badge-only header and a three-step progress rail (`Enter address` -> `Map your lawn` -> `Review quote`) instead of CTA-style step cards.
1. Step 1 address selection (Canada/US suggestion scope).
   - Keyboard suggestion controls supported (`ArrowUp/ArrowDown/Enter/Escape`).
2. Coverage gate (`POST /api/service-area/check`) before entering map step.
3. Step 2 geometry drawing uses persistent freehand capture with service + obstacle polygons.
   - Top of map uses a thin address pill with a subtle `Change address` action.
   - `Draw lawn` / `Draw obstacle` toggle into `Stop drawing` while active.
   - Completed strokes automatically stop drawing mode.
   - Draw-end cleanup distance-normalizes freehand strokes, caps vertex density by distance, removes redundant wobble on straight edges, and collapses overlapping close-loop tails into one clean join corner.
   - Clicking near the outline of the selected polygon inserts a new vertex at that exact edge position and selects it immediately.
   - Undo/redo live in their own arrow-only box at the top-left of the map.
   - Delete and `Clear all` stay grouped; `Clear all` requires a second confirmation click.
   - Drawn polygons remain vertex-editable after the stroke is completed.
   - Geometry edits do not auto-reset map zoom.
   - Property center marker uses a green home icon inside the white location dot.
   - Satellite basemap remains default in quote mapping for boundary accuracy.
   - A centered guide modal shell appears 1 second after a fresh map load succeeds for a newly entered address.
   - Guide step 1 is a looping miniature of the real draw-lawn tool, including the live toolbar chrome, the polished top-down house SVG as the popup background, and a visible cursor.
   - The tutorial now traces the front down lawn zone inside the same framed viewport treatment used by step 2 so the background stays consistent between slides, finalizes that stroke through the shared freehand logic, lets the camera glide with a shared 1.6-second transform while cursor movement and vertex dragging stay at normal guide speed, then draws the top-left lawn zone so both left-side lawns are complete before step 2.
   - Guide step 2 now carries those two finished left-side lawns forward, draws only the right-side backyard zone, keeps completed non-active polygons styled like the real quote tool, and uses the same 1.6-second camera transform timing without slowing cursor/edit phases while teaching one missing garden-notch point plus one direct toolbar-Delete click/removal of an extra redundant point on the selected right-side polygon.
   - Guide step 3 now keeps the same popup-house SVG background and completed three-zone lawn from step 2, clicks `Draw obstacle`, draws a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that finished scene for 2 seconds before looping again.
   - The guide shell now uses a cleaner editorial popup treatment with one white panel, a right-sized demo viewport whose camera layer aligns with the map-body clip window so the SVG starts centered and the bottom stays visible, equal-width toolbar buttons above the artwork, a slowly fading unified demo-and-caption media unit with no divider or white caption box between the SVG and text, a tighter centered caption strip directly under the demo, and a flatter navigation row with centered segmented progress.
   - The animated SVG steps now fade in softly when they appear, fade back out as each loop finishes, and use a slower fade-based slide transition between guide steps.
   - On the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool without dismissing the current guide session.
   - The popup-house SVG background uses a fresher brighter palette so the lawn, deck, garden, and trees feel less dull.
   - The caption strip is now step-aware: step 1 uses `Draw loosely around your lawn.` and `Move the points to match your lawn.`, step 2 uses `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 uses `Use Draw obstacle for gardens, pools, and other no-mow areas.`
   - Dismissing the guide keeps it closed for the current mapped address session; it reopens only after the next successful address-to-map load.
   - Restored browser-local drafts do not auto-open the guide.
   - Floating top-right action cluster pairs a manual `Guide` help button with the primary `Done` completion action.
   - Drawing controls/panels use warm-light surfaces and high-contrast action states.
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
5. Review page (`/instant-quote/summary`) removes the step progress rail and shows a two-section quote-ready layout: one top `Back to Map` action, a desktop top row with address-first property details on the left and the fitted map preview with quiet whole-number area/perimeter metadata on the right, then a full-width lower section with side-by-side radio billing plan cards before any server draft is created.
6. Draft save (`POST /api/quote/draft`) after review-page confirmation.
   - `polygonSource` now requires `schemaVersion: 2` with `activePolygonId`, `polygons[]`, `ringPoints`, and nullable `rawStrokePoints`.
   - Server derives/stores canonical quote geometry from `ringPoints`; legacy source payloads are rejected.
   - If the API is unreachable, the review page keeps the local draft intact and shows a direct API reachability error instead of a generic submit failure.
7. Confirmation handoff at `/quote-confirmation/:quoteId` (legacy `/quote-contact/:quoteId` redirects here).
8. Signed-in draft creation records quote address in Clerk account metadata (`addressHistory` + `defaultAddress`).
9. Authenticated user claim step (`POST /api/quote/:quoteId/claim`) links quote ownership.
10. Confirmation page claims/finalizes the draft by calling `POST /api/quote/:quoteId/contact`.

- Server derives name/email/phone from authenticated account.
- Property address is derived from stored quote draft address (not a form field).
- Finalize moves quote directly to `in_review` with `customer_status=pending`.

11. Confirmation page loads quote for owner/admin only.

### Customer Accounts

- Clerk handles customer sign-up/sign-in, Google auth, and password reset.
- Required phone is enforced in-app via `/complete-profile/*` for all auth methods.
- Phone is stored on account metadata (`unsafeMetadata.autoscapeProfile.phone`).
- Users without phone are gated before dashboard and quote confirmation routes.
- Protected dashboard routes:
  - `/dashboard` (profile + owned quotes + placeholder billing/messages cards)
  - `/dashboard/quotes/:quoteId` (owned quote detail)
  - `/dashboard/quotes/:quoteId/payment` (approved-quote placeholder payment page with review image + contact fallback)
- Quote lookup APIs are owner-only unless caller is admin.

### Out-of-Area Flow

- `/service-unavailable` shows coverage map + entered-address marker.
- Page auto-creates expansion demand record once via idempotent `POST /api/service-area/request`.
- User can retry address or go to `/service-area-requested` thank-you page.
- Coverage check failures route to `/service-check-error`.

### Contact Flow

- Contact form captures name/email/phone/message (required) + address (optional).
- Contact submission is idempotent (`POST /api/contact`).

## Admin Platform (`admin/`)

Admin app (separate Vite frontend) supports:

- modern sidebar + top utility bar layout (auto light/dark theme)
- quote inbox with pending semantics (`in_review + pending`) and verified-awaiting-payment label
- route-based quote editor (`/quotes/:quoteId/edit`) with full polygon tools and editable quote controls
  - satellite basemap for property-context editing
  - stored customer polygons render immediately on editor load
  - editor uses the same freehand draw workflow, shared draw-end simplifier, and v2 polygon-source contract as the public quote tool
- append-only version flow:
  - client draft creates version number `1` (`actorType=client`) using `polygonSource.schemaVersion=2`
  - admin edits create new versions (`actorType=admin`)
  - selected version submit sets `status=verified`, `customer_status=awaiting_payment`
  - version submit now attempts a payment-focused Resend-backed approved-quote email and stores the result in `approved_quote_email_deliveries`
  - verified quotes expose the latest approved-quote email status in the editor plus a manual resend action
- quote mutation endpoints are restricted to `OWNER`, `ADMIN`, and `REVIEWER` roles
- quote notes
- service-area request queue with heatmap + cluster map module and hotspot list
- lead/contact inbox
- attribution summary (submit snapshot aggregation)
- audit events
- CSV export with role-based PII controls
- search/filter/sort controls across all admin tabs
- Clerk-backed admin sign-in (invite-only organization membership)
- bearer-token auth only against `/api/admin/*` (no legacy role headers/static token)

## Data + Infrastructure

- Runtime API: `server/src/server.ts` via `server/src/index.ts`
- Hosted deployment target: DigitalOcean App Platform with isolated staging and production apps.
  - Staging uses the `staging` branch, auto-deploys to `staging.autoscape.ca`, `api-staging.autoscape.ca`, and `admin-staging.autoscape.ca`.
  - Production uses the `main` branch, deploys manually to `autoscape.ca`, `www.autoscape.ca`, `api.autoscape.ca`, and `admin.autoscape.ca`.
  - Each environment has `public-web` (`client/`), `admin-web` (`admin/`), `api` (`server/`), a Prisma pre-deploy migration job, and its own managed Postgres/PostGIS database.
  - Live status on 2026-04-21: staging app `autoscape-staging` is active in `tor`, `autoscape-staging-db` is PostgreSQL 16 in `tor1`, and migrations have run. Staging custom domains use self-managed GoDaddy CNAME records and are active. Production has not been created because authenticated staging smoke tests still need to pass.
- Persistence: Prisma + Postgres + PostGIS (`server/prisma/schema.prisma`)
- Approved quote emails use Resend with configurable sender/reply-to env, subject `Quote Approved, Payment Required`, a centered payment CTA, and tokenized preview images served from `GET /api/approved-quote-preview/:token`
- Email map previews require `PUBLIC_API_BASE_URL` to be a public API origin and `MAPBOX_STATIC_ACCESS_TOKEN`; preview rendering proxies Mapbox Static Images and uses exact saved client/admin `polygonSource` versions to show approved, added, and removed service areas
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
  - `server/prisma/migrations/20260314180000_quote_auth_ownership/migration.sql`
  - `server/prisma/migrations/20260416130000_approved_quote_email_delivery/migration.sql`
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
- Customer phone requirement enforced for quote finalize and account quote APIs.
- Customer address history/default persisted in Clerk private metadata (`autoscapeProfile`).
- Admin RBAC roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`.
- Admin role mapping source: Clerk org roles `owner/admin/reviewer/marketing`.
- MARKETING role gets masked PII for lists and exports.
- Analytics endpoints use `SYSTEM_LAUNCH_AT` cutoff for launch-era consistency.

## Current Defaults

- Default station (non-production): `L6A1M7` center (`43.844147`, `-79.51962`).
- Default served region: `Vaughan, Ontario`.
- Currency default: `CAD`.
