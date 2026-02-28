# Architecture

## 1) System Overview
Autoscape is a client/server application:
- `client/`: React SPA for marketing pages + Instant Quote UX.
- `server/`: Node API for quote/contact validation and storage.

Primary path:
1. User selects address and draws polygon in frontend.
2. Frontend computes live metrics and quote estimate.
3. Frontend submits quote payload to backend.
4. Backend validates geometry, remeasures, stores quote, returns `quoteId`.

## 2) Frontend Components
Key modules:
- Routing: `client/src/App.tsx`
- Quote page: `client/src/pages/InstantQuotePage.tsx`
- Map interactions: `client/src/components/quote/QuoteMap.tsx`
- Geometry helpers: `client/src/lib/geometry.ts`
- Pricing helpers: `client/src/lib/quote.ts`
- API client: `client/src/lib/api.ts`

Map subsystem:
- Provider: Mapbox GL.
- Address search: Mapbox Geocoding HTTP API.
- Polygon rendering + vertex overlays: GeoJSON sources/layers + draggable `Marker`s.

## 3) Backend Components
Key modules:
- Runtime entrypoint: `server/src/index.ts`
- Schemas: `server/src/lib/schemas.ts`
- Geometry validation: `server/src/lib/geometry.ts`
- Storage: `server/src/lib/store.ts`

Route behavior (runtime):
- `GET /api/health`
- `POST /api/quote`
- `GET /api/quote/:id`
- `POST /api/contact`

Note:
- Express route modules exist in `server/src/app.ts` and `server/src/routes/*`, but current runtime server is the custom Node HTTP implementation in `server/src/index.ts`.

## 4) Data Contracts
Quote submission contract:
- `address`
- `location { lat, lng }`
- `polygon { type: 'Polygon', coordinates }`
- `metrics { areaM2, perimeterM }`
- `plan`
- `quoteTotal`

Contact contract:
- `name`
- `email`
- `message`

Validation:
- Zod schemas enforce types and bounds.
- Polygon coordinates validated for longitude/latitude ranges.

## 5) Geometry + Integrity Pipeline
Client-side:
- closes ring if needed,
- computes area and perimeter,
- detects self-intersection for UX feedback.

Server-side:
- normalizes/validates ring,
- rejects <3 distinct points,
- rejects invalid area,
- checks self-intersection,
- recomputes area/perimeter,
- rejects payload if client/server metric drift exceeds 3%.

## 6) Storage Model
- In-memory `Map` objects for quotes and contacts.
- Fast for development and demos.
- Non-persistent across process restarts.
- Storage access isolated for future DB replacement.

## 7) Security/Robustness Controls
- Global + write-specific rate limits.
- Payload size cap (`1mb`) and invalid JSON handling.
- CORS allowlist from environment (`CLIENT_ORIGIN`, plus local defaults).
- Server-side metric recomputation to prevent client tampering.

## 8) Runtime/Serving Modes
### Development mode
- `npm run dev` from repo root starts:
  - backend (`npm --prefix server run dev`)
  - frontend (`npm --prefix client run dev`)

### Built static SPA mode
- `scripts/spa_server.py` serves `client/dist` with history fallback.
- Supports hard refresh on routes like `/instant-quote`.
