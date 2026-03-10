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
```

3. Configure required env values:
```bash
# client/.env
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token

# server/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoscape?schema=public
ADMIN_API_TOKEN=replace_me_for_production
SYSTEM_LAUNCH_AT=2026-03-04T00:00:00.000Z
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
- Instant Quote flow is now draft-first:
  - cadence selector supports `weekly` and `bi-weekly`
  - quote outputs include per-session price plus seasonal total range
  1. `POST /api/quote/draft`
  2. Redirect to `/quote-contact/:quoteId`
  3. `POST /api/quote/:quoteId/contact` finalizes contact + sets status `submitted`
  4. Confirmation page `/quote-confirmation/:quoteId`
- Out-of-area page auto-captures expansion demand via `POST /api/service-area/request`.

## Service Area Privacy
- Exact base station coordinates stay server-only.
- API returns merged/simplified/quantized geometry only.
- No station markers, IDs, or centers are sent to clients.
- Service-area check and request endpoints are rate-limited.

## Admin Platform v1
Admin endpoints under `/api/admin/*` include:
- quotes inbox (`/quotes`) with cursor pagination
- service-area request map payload (`/service-area-requests/map`) for heatmap/cluster rendering
- quote status transitions + revision + notes
- service-area requests, leads, contacts, audit logs
- attribution summary (`/attribution/summary`)
- CSV export with role-aware PII policy (`/exports/quotes.csv`)

All major list endpoints support `q`, tab-specific filters, `sortBy`, and `sortDir`.

RBAC roles:
- `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`

PII policy:
- `MARKETING` receives masked PII in list responses and exports.
- full PII export is restricted to `OWNER/ADMIN/REVIEWER`.

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
