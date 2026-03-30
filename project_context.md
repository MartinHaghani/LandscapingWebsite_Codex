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
- Services marketing grid now uses five shared-style inline SVG illustrations: Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
- Navigation includes mobile menu support and quote CTA.
- Footer includes production contact details and internal quick links.
- Marketing pages (home/services/about/contact) use non-placeholder production copy and a warm-light readability-first design system.
- Home hero uses a symmetric desktop split with copy/CTAs on the left, `No sign-up required.` helper text under the CTA row, and a responsive animated lawn parcel on the right with a perimeter-learning wall trace, an 11-pass rounded horizontal infill raster with denser direction arrows, direct mowing spawn on the first scanline, mowing follow-through, visible CAD dimensions, a restrained under-shadow, and a dynamically sized ticker-flip status capsule stacked directly under the lawn.
- Home page also includes a sustainability proof section directly below the hero, comparing electric vs gas mowing on point-of-use exhaust, measured 25 ft noise, and qualified lifecycle CO2e with compact bar visuals.
- Marketing copy keeps "zero emissions" qualified to exhaust at the point of use and avoids silent/absolute environmental wording.

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
   - Floating top-right `Done` button is the primary map completion action.
   - Drawing controls/panels use warm-light surfaces and high-contrast action states.
4. Review page owns cadence selection (`weekly` or `biweekly`) and billing selection before draft save.
   - `weekly` uses 26 sessions/season; `biweekly` uses 14 sessions/season.
   - Pricing formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 50)`.
   - `D` is nearest active base-station distance in km (internal-only, not customer-visible).
   - Billing modes: `seasonal` (default, 20% discount) and `per_session`.
   - Browser-local draft autosave stores address/map/cadence/billing/unit state.
   - Draft persistence key/version is `autoscape.quoteDraft.v2`.
   - Saved draft can be reset from address or map panels.
5. Review page (`/instant-quote/summary`) shows a unified review card with address-first property summary details, area/perimeter directly under the address, a live fitted property preview, visit-count context near service frequency, one `Back to Map` action, and side-by-side billing plan cards before any server draft is created.
6. Draft save (`POST /api/quote/draft`) after review-page confirmation.
   - `polygonSource` now requires `schemaVersion: 2` with `activePolygonId`, `polygons[]`, `ringPoints`, and nullable `rawStrokePoints`.
   - Server derives/stores canonical quote geometry from `ringPoints`; legacy source payloads are rejected.
7. Required auth gate at `/quote-contact/:quoteId` (Clerk sign-in/sign-up, Google enabled).
8. Signed-in draft creation records quote address in Clerk account metadata (`addressHistory` + `defaultAddress`).
9. Authenticated user claim step (`POST /api/quote/:quoteId/claim`) links quote ownership.
10. Contact finalize calls `POST /api/quote/:quoteId/contact` with optional notes only.
   - Server derives name/email/phone from authenticated account.
   - Property address is derived from stored quote draft address (not a form field).
   - Finalize moves quote directly to `in_review` with `customer_status=pending`.
11. Confirmation page loads quote for owner/admin only.

### Customer Accounts

- Clerk handles customer sign-up/sign-in, Google auth, and password reset.
- Required phone is enforced in-app via `/complete-profile/*` for all auth methods.
- Phone is stored on account metadata (`unsafeMetadata.autoscapeProfile.phone`).
- Users without phone are gated before dashboard and quote finalize routes.
- Protected dashboard routes:
  - `/dashboard` (profile + owned quotes + placeholder billing/messages cards)
  - `/dashboard/quotes/:quoteId` (owned quote detail)
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
- Persistence: Prisma + Postgres + PostGIS (`server/prisma/schema.prisma`)
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
  - `server/prisma/migrations/20260314180000_quote_auth_ownership/migration.sql`
- Idempotency table stores request hash + exact response replay payload.
- In-memory fallback store remains for local runs without `DATABASE_URL`.
- Dev cutover script: `npm --prefix server run cutover:freehand-reset-dev-data`
  - wipes test quote/leads/editor records before the freehand v2 rollout
  - preserves schema/reference data such as base stations

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
