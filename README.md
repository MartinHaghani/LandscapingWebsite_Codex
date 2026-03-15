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
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me

# server/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoscape?schema=public
CLERK_SECRET_KEY=sk_test_replace_me
CLERK_JWT_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_ADMIN_ORG_ID=org_replace_me
SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z

# admin/.env
VITE_API_BASE_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me
```

4. Generate Prisma client + migrate DB:

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate:dev
```

5. Run apps:

```bash
npm run dev        # public app + API
npm run dev:admin  # admin app
```

Default local URLs:

- Public: `http://127.0.0.1:5173`
- API: `http://localhost:4000`
- Admin: `http://127.0.0.1:5174`

## Public Flow Highlights

- `/services` starts with the Service Area map card.
- Coverage overlay is dark-map + green `#329F5B` and privacy-hardened.
- Services page uses CTA-only handoff to `/instant-quote`.
- Marketing pages now use launch-ready production copy (no placeholder content) with mobile navigation and footer quick links.
- Instant Quote flow is now draft-first:
  - cadence selector supports `weekly` and `bi-weekly`
  - quote outputs include per-session price plus seasonal total range
  - address suggestions support keyboard navigation (`ArrowUp/ArrowDown/Enter/Escape`)
  - browser-local draft persistence auto-saves address, step state, polygons, units, and cadence
  - users can clear geometry or reset saved draft from the quote UI
  1. `POST /api/quote/draft`
  2. Sign in/sign up required at `/quote-contact/:quoteId`
  3. `POST /api/quote/:quoteId/claim` links quote to authenticated account
  4. `POST /api/quote/:quoteId/contact` finalizes contact + sets status `in_review` (`customer_status=pending`)
  5. Confirmation page `/quote-confirmation/:quoteId`
- Customer dashboard:
  - `/dashboard` for profile + owned quote list
  - `/dashboard/quotes/:quoteId` for owned quote detail
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
- service-area request map payload (`/service-area-requests/map`) for heatmap/cluster rendering
- quote versioning APIs:
  - `GET /api/admin/quotes/:id/editor`
  - `POST /api/admin/quotes/:id/versions`
  - `POST /api/admin/quotes/:id/versions/:versionNumber/submit`
- quote notes and legacy revision endpoint (`/api/admin/quotes/:id/revise`)
- service-area requests, leads, contacts, audit logs
- attribution summary (`/attribution/summary`)
- CSV export with role-aware PII policy (`/exports/quotes.csv`)

All major list endpoints support `q`, tab-specific filters, `sortBy`, and `sortDir`.

Admin auth:

- bearer token auth from Clerk only (no static token and no header-role fallback)
- admin access requires membership in configured `CLERK_ADMIN_ORG_ID`
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
