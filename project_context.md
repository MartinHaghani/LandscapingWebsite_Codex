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

### Instant Quote Flow
1. Step 1 address selection (Canada/US suggestion scope).
2. Coverage gate (`POST /api/service-area/check`) before entering map step.
3. Step 2 geometry drawing with service + obstacle polygons.
4. Cadence selection (`weekly` or `biweekly`) updates seasonal session window + pricing range.
5. Draft save (`POST /api/quote/draft`) after geometry submit.
6. Required contact finalize page (`/quote-contact/:quoteId`) calls `POST /api/quote/:quoteId/contact`.
7. Confirmation page loads quote by public ID.

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
- quote inbox with workflow transitions (`draft -> submitted -> in_review -> verified/rejected`)
- quote revision in review (append-only versioning, revise per-session amount only)
- quote notes
- service-area request queue with heatmap + cluster map module and hotspot list
- lead/contact inbox
- attribution summary (submit snapshot aggregation)
- audit events
- CSV export with role-based PII controls
- search/filter/sort controls across all admin tabs

## Data + Infrastructure
- Runtime API: `server/src/server.ts` via `server/src/index.ts`
- Persistence: Prisma + Postgres + PostGIS (`server/prisma/schema.prisma`)
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
- Idempotency table stores request hash + exact response replay payload.
- In-memory fallback store remains for local runs without `DATABASE_URL`.

## Security / Privacy Model
- Base station coordinates are server-only.
- Service overlay returned to clients is unioned/simplified/jittered/quantized geometry.
- Admin RBAC roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`.
- MARKETING role gets masked PII for lists and exports.
- Analytics endpoints use `SYSTEM_LAUNCH_AT` cutoff for launch-era consistency.

## Current Defaults
- Default station (non-production): `L6A1M7` center (`43.844147`, `-79.51962`).
- Default served region: `Vaughan, Ontario`.
- Currency default: `CAD`.
