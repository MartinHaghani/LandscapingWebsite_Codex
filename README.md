# Autoscape Web App

Modern React + Node.js website for **Autoscape**, an autonomous landscaping brand, including a full **Instant Quote** experience with map-based polygon drawing and geodesic measurements.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS + Mapbox GL + Turf.js
- Backend: Node.js + Express + TypeScript + Zod + express-rate-limit
- Data storage: in-memory (easy to replace with SQLite/Postgres later)

## Project Structure

- `/client` - website UI and Instant Quote flow
- `/server` - API for quotes and contact submissions

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create env files:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

3. Edit `client/.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token
```

4. Edit `server/.env`:

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

5. Start both apps:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## API Endpoints

- `POST /api/quote`
  - Validates payload and polygon geometry
  - Rejects self-intersections and invalid rings
  - Recomputes area + perimeter server-side
  - Returns `{ quoteId }`
- `GET /api/quote/:id`
  - Returns stored quote by ID
- `POST /api/contact`
  - Validates/stores contact submissions

## How Accuracy Is Ensured

The app uses **geodesic/spherical calculations** via Turf.js (not planar lat/lng math):

- Area: `turf.area(polygon)` (square meters)
- Perimeter: `turf.length(lineString, { units: 'kilometers' }) * 1000` (meters)

Both frontend and backend compute metrics geodesically. The backend validates polygon geometry and compares client-submitted metrics against server measurements.

## Instant Quote Flow

1. Address autocomplete + geocoding (Mapbox Geocoding API)
2. Map centered on selected address
3. Polygon drawing by map clicks
4. Editing via draggable vertex handles
5. Controls: start/stop drawing, undo last point, clear polygon, edit mode
6. Real-time stats bar: area, perimeter, vertex count
7. Unit toggle: metric/imperial (`m²`/`ft²`, `m`/`ft`)
8. Deterministic pricing formula and quote submission
9. Confirmation state with returned quote ID

## Tests

Basic utility tests are included in `client/src/lib/*.test.ts`.

Run tests:

```bash
npm run test -w client
```
