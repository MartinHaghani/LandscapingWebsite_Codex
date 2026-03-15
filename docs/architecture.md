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
- Public app routes: `client/src/App.tsx`
- Admin app routes/state: `admin/src/App.tsx`
- Admin quote editor map module: `admin/src/components/QuoteEditorMap.tsx` (satellite raster basemap + immediate polygon source hydration)
- Public layout shell: `client/src/components/layout/SiteLayout.tsx` (`Navbar`, `Footer`, `ScrollToTop`)

## 3) Persistence Layer

- ORM: Prisma (`server/prisma/schema.prisma`)
- DB: PostgreSQL + PostGIS
- Migrations:
  - `server/prisma/migrations/20260304120000_admin_platform_v1/migration.sql`
  - `server/prisma/migrations/20260305103000_quote_session_ranges/migration.sql`
  - `server/prisma/migrations/20260314122000_admin_quote_editor_workflow/migration.sql`
  - `server/prisma/migrations/20260314180000_quote_auth_ownership/migration.sql`

Canonical tables:

- `leads`
- `lead_contacts`
- `quotes`
- `quote_versions` (append-only history)
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
- `POST /api/quote/:quoteId/claim` (auth required)
- `POST /api/quote/:quoteId/contact` (idempotent)
- `GET /api/quote/:quoteId` (auth required, owner/admin only)

### Account

- `GET /api/account/quotes` (auth required)
- `GET /api/account/quotes/:quoteId` (auth required, owner scoped)

Client-side quote draft resilience:

- Local snapshot key: `autoscape.quoteDraft.v1`
- Stored state includes:
  - address input + selected address metadata
  - map center + step state
  - polygon history (past/present/future)
  - unit mode + service frequency
- Reset/clear controls are UI-level only and do not mutate server quote records.

Quote pricing contract:

- `quoteTotal` remains compatibility alias for per-session total
- canonical fields: `serviceFrequency`, `perSessionTotal`, `sessionsMin`, `sessionsMax`, `seasonalTotalMin`, `seasonalTotalMax`

### Contact

- `POST /api/contact` (idempotent)

### Service Area

- `GET /api/service-area` (ETag + cache)
- `POST /api/service-area/check`
- `POST /api/service-area/request` (idempotent)

Idempotency behavior:

- request hash stored by `(scope, idempotency_key)`
- same key + same payload => exact stored response replay
- same key + different payload => `409 Conflict`

## 5) Admin API Shape

All admin endpoints are under `/api/admin/*` and return cursor pagination payloads:

- `GET /api/admin/health`
- `GET /api/admin/quotes`
- `PATCH /api/admin/quotes/:id/status`
- `POST /api/admin/quotes/:id/revise`
- `GET /api/admin/quotes/:id/editor`
- `POST /api/admin/quotes/:id/versions`
- `POST /api/admin/quotes/:id/versions/:versionNumber/submit`
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
- each endpoint supports additional tab-specific filters (status, cadence, source, channel, actor role, etc.)

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
- `submitted` remains in the enum for backward compatibility and controlled transitions.

Revisions:

- Do not move status backward.
- Keep quote in `in_review`.
- Append immutable `quote_versions` row.
- Update `customer_status` to `updated`.
- Revise endpoint treats per-session total as canonical and recomputes seasonal range fields.
- Quote editor versions include `actor_type` (`client` or `admin`) + `version_number` + `changed_at`.
- Version submit endpoint applies selected version and sets `status=verified` + `customer_status=awaiting_payment`.

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
