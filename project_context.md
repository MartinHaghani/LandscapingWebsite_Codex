# Autoscape Project Context

## Product Purpose

Autoscape provides:

1. deterministic instant landscaping quotes from real boundary geometry
2. coverage-first serviceability UX with privacy-preserving service area display
3. internal admin operations for quote review, expansion planning, and attribution tracking

## Current Experience

### Public App (`client/`)

- `Services` page starts with Service Area map + large `Check my address` CTA.
- Service map is dark themed with green `#329F5B` overlay.
- Coverage is explicitly approximate and privacy-hardened.
- Navigation includes mobile menu support and quote CTA.
- Footer includes production contact details and internal quick links.
- Marketing pages (home/services/about/contact) now use non-placeholder production copy.

### Instant Quote Flow

1. Step 1 address selection (Canada/US suggestion scope).
   - Keyboard suggestion controls supported (`ArrowUp/ArrowDown/Enter/Escape`).
2. Coverage gate (`POST /api/service-area/check`) before entering map step.
3. Step 2 geometry drawing with service + obstacle polygons.
   - Includes `Clear All`, `Undo`, `Redo`, and delete controls.
4. Cadence selection (`weekly` or `biweekly`) updates seasonal session window + pricing range.
   - Browser-local draft autosave stores address/map/cadence/unit state.
   - Saved draft can be reset from address or map panels.
5. Draft save (`POST /api/quote/draft`) after geometry submit.
6. Required auth gate at `/quote-contact/:quoteId` (Clerk sign-in/sign-up, Google enabled).
7. Authenticated user claim step (`POST /api/quote/:quoteId/claim`) links quote ownership.
8. Contact finalize calls `POST /api/quote/:quoteId/contact` with phone + optional notes.
   - Server derives name/email from authenticated account.
   - Finalize moves quote directly to `in_review` with `customer_status=pending`.
9. Confirmation page loads quote for owner/admin only.

### Customer Accounts

- Clerk handles customer sign-up/sign-in, Google auth, and password reset.
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
- append-only version flow:
  - client draft creates version `v1` (`actorType=client`)
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

## Security / Privacy Model

- Base station coordinates are server-only.
- Service overlay returned to clients is unioned/simplified/jittered/quantized geometry.
- Authentication provider: Clerk for both customer and admin surfaces.
- Quote ownership stored on `quotes.auth_user_id` and enforced on quote read/finalize paths.
- Admin RBAC roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`.
- Admin role mapping source: Clerk org roles `owner/admin/reviewer/marketing`.
- MARKETING role gets masked PII for lists and exports.
- Analytics endpoints use `SYSTEM_LAUNCH_AT` cutoff for launch-era consistency.

## Current Defaults

- Default station (non-production): `L6A1M7` center (`43.844147`, `-79.51962`).
- Default served region: `Vaughan, Ontario`.
- Currency default: `CAD`.
