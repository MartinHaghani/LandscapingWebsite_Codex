# Autoscape Web App

Modern React + Node.js website for **Autoscape**, focused on autonomous landscaping with an end-to-end **Instant Quote** flow.

## Documentation Map
- Project context: [`project_context.md`](./project_context.md)
- Agent/project guidelines: [`AGENTS.md`](./AGENTS.md)
- Docs index: [`docs/README.md`](./docs/README.md)
- Architecture: [`docs/architecture.md`](./docs/architecture.md)
- Feature flow: [`docs/feature_flow.md`](./docs/feature_flow.md)
- Design decisions: [`docs/design.md`](./docs/design.md)
- Coding standards: [`docs/coding_standards.md`](./docs/coding_standards.md)

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + Mapbox GL + Turf.js
- Backend: Node.js + TypeScript + Zod (Express route scaffold included)
- Storage: in-memory (`Map`) for quotes/contacts (no database yet)

## Repo Structure
- `client/` - UI, pages, map drawing, quote flow
- `server/` - API endpoints, validation, geometry checks, in-memory storage
- `docs/` - architecture, flow, design, standards
- `scripts/spa_server.py` - static SPA server with history fallback

## Fresh Terminal Run Commands
1. Install dependencies:
```bash
npm install
```

2. Create env files:
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

3. Configure env values:

`client/.env`
```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
```

`server/.env`
```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

4. Start both apps:
```bash
npm run dev
```

5. Open:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`

## Implemented Features

### Marketing Site
- Premium black/white/green design system (`#329F5B` accent)
- Responsive pages: Home, Services, About, Contact
- Placeholder copy and themed placeholder visuals
- Reusable UI primitives (buttons, cards, badges, section titles, stats bar)

### Instant Quote (Core)
- Address autocomplete + geocoding (Mapbox API)
- Map recentering on selected address
- Polygon drawing by map clicks
- Polygon editing with draggable vertices
- Drawing controls:
  - Start/Stop drawing
  - Undo last point
  - Clear polygon
  - Edit mode toggle
- Real-time stats:
  - Area
  - Perimeter
  - Vertex count
- Unit toggle:
  - area: `m²` / `ft²`
  - perimeter: `m` / `ft`
- Self-intersection warning and submit blocking
- Deterministic quote summary and total
- Quote submission and confirmation page with quote ID

### Contact
- Contact form (`name`, `email`, `message`)
- POST submission to backend
- Response handling with placeholder confirmation ID

## API Endpoints
- `GET /api/health`
- `POST /api/quote`
  - validates payload + polygon geometry
  - rejects invalid/self-intersecting polygons
  - recomputes geometry server-side
  - enforces metric drift tolerance (3%)
  - stores quote and returns `{ quoteId }`
- `GET /api/quote/:id`
  - returns stored quote by ID
- `POST /api/contact`
  - validates and stores contact payload

## Measurement Accuracy Details
Accuracy is geodesic-oriented and avoids naive planar lat/lng calculations:
- Area: `@turf/area`
- Self-intersection detection: `@turf/kinks`
- Perimeter: Haversine segment sum over Earth radius (`6,371,008.8m`)

Backend re-measures and validates submitted metrics before accepting quotes.

## Pricing Logic
`quoteTotal = baseFee + (areaM2 * areaRate) + (perimeterM * perimeterRate)`

- Base fee: `49`
- Area rate: `0.085` / m²
- Perimeter rate: `0.38` / m

## Tests
Frontend utility tests are included for:
- geometry helpers (`closeRing`, unit conversions)
- quote calculations (plan selection, deterministic totals)

Run tests:
```bash
npm test
```

## Alternative Static SPA Run (History-Fallback)
If you want to serve the built frontend with hard-refresh-safe routing:

```bash
npm --prefix client run build
python3 scripts/spa_server.py --host 127.0.0.1 --port 5173 --dir client/dist
```

This serves `client/dist` and rewrites unknown non-asset routes to `index.html`.
