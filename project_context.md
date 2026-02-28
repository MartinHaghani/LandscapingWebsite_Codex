# Autoscape Project Context

## Product Purpose
Autoscape is a premium landscaping website and quote tool for autonomous lawn care. The primary product goal is to let a customer draw their service boundary on a map and receive a deterministic quote immediately.

## What Is Built
- Multi-page marketing site with a black/white/green (`#329F5B`) visual system.
- Core pages: Home, Services, About, Contact, Instant Quote, Quote Confirmation.
- Themed placeholder content and placeholder visuals across all marketing pages.
- End-to-end quote flow from address input to persisted quote ID.

## Instant Quote Core Flow
1. Address input uses Mapbox Geocoding API autocomplete.
2. Selecting a suggestion sets `selectedAddress` and re-centers the map.
3. User draws polygon vertices by clicking map points.
4. User can:
   - start/stop drawing,
   - undo last point,
   - clear polygon,
   - enter edit mode and drag vertices.
5. Stats update in real time:
   - area,
   - perimeter,
   - vertex count.
6. Unit toggle switches display between:
   - metric (`m²`, `m`),
   - imperial (`ft²`, `ft`).
7. Quote panel computes recommended plan + deterministic price.
8. Submit sends payload to backend; backend returns `{ quoteId }`.
9. Confirmation page loads quote by ID.

## Geometry And Accuracy Model
Frontend and backend both use geodesic-safe measurement logic (no naive planar lat/lng math):
- Ring closure: polygon is automatically closed by repeating first point when needed.
- Area: `@turf/area` (`turf.area`) on GeoJSON polygon.
- Self-intersection: `@turf/kinks` to detect invalid bow-tie/self-crossing shapes.
- Perimeter: segment-by-segment Haversine distance over WGS84-like Earth radius (`6,371,008.8m`).

Backend performs server-side recomputation and rejects drift beyond tolerance:
- `METRIC_DRIFT_TOLERANCE = 0.03` (3%).

## Pricing Logic (Deterministic)
`quoteTotal = baseFee + areaM2 * areaRate + perimeterM * perimeterRate`

Current coefficients:
- `baseFee = 49`
- `areaRate = 0.085` (per m²)
- `perimeterRate = 0.38` (per m)

Plan recommendation:
- `< 450 m²` => Starter Autonomy Plan
- `< 1200 m²` => Precision Weekly Plan
- otherwise => Estate Coverage Plan

## Backend Behavior
- Runtime API is implemented in `server/src/index.ts` (Node HTTP server).
- Validation uses Zod schemas (`server/src/lib/schemas.ts`).
- Geometry validation uses `server/src/lib/geometry.ts`.
- Storage is in-memory `Map` objects (`server/src/lib/store.ts`) for quotes and contacts.
- Express route modules are present (`server/src/app.ts`, `server/src/routes/*`) for a future/alternate runtime wiring.
- Endpoints:
  - `GET /api/health`
  - `POST /api/quote`
  - `GET /api/quote/:id`
  - `POST /api/contact`

## Data Model Snapshot
Quote payload includes:
- address string,
- center lat/lng,
- polygon GeoJSON coordinates,
- client metrics,
- recommended plan,
- quote total.

Server persists normalized quote record with:
- generated ID,
- timestamp,
- normalized ring,
- server-measured metrics.

## Operational Notes
- Persistent database is not implemented yet (intentional for speed of iteration).
- Map provider token is required in `client/.env` (`VITE_MAPBOX_TOKEN`).
- Dev run from root uses `npm --prefix` scripts (not npm workspaces).
- `scripts/spa_server.py` exists for serving built SPA with route fallback (`/instant-quote` hard-refresh safe).

## Commit/History Snapshot
Current git history is minimal (`Innit Commit`). Most context currently lives in source files + docs rather than detailed commit narrative.
