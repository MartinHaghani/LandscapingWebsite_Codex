# Feature Flow

## Instant Quote: End-to-End

### Step A: Address Entry
1. User types an address in the Instant Quote input.
2. Frontend debounces and calls Mapbox Geocoding API.
3. Suggestion click sets:
   - `addressInput`
   - `selectedAddress`
   - map center (`lng/lat`)
4. “Center Map” submit button can also select first suggestion fallback.

### Step B: Boundary Mapping
1. User enables drawing mode.
2. Each map click appends a polygon vertex.
3. User can:
   - stop drawing,
   - undo last point,
   - clear polygon,
   - enter edit mode and drag vertices.
4. Polygon ring is auto-closed for computations.

### Step C: Live Measurement + Quote Summary
With each vertex add/edit:
- Area updates in real time.
- Perimeter updates in real time.
- Vertex count updates in real time.
- Self-intersection state is recalculated.
- Recommended plan and quote total are recalculated.

Display modes:
- Metric: `m²`, `m`
- Imperial: `ft²`, `ft`

Conversion constants:
- `1 m² = 10.7639 ft²`
- `1 m = 3.28084 ft`

### Step D: Submission
Submit is enabled only when:
- address selected,
- at least 3 vertices,
- polygon not self-intersecting,
- request not already in flight.

On submit:
1. Frontend posts quote payload to `POST /api/quote`.
2. Backend validates payload + polygon geometry.
3. Backend remeasures metrics and checks drift tolerance.
4. Backend stores quote and returns `{ quoteId }`.
5. Frontend navigates to `/quote-confirmation/:quoteId`.

## Contact Flow
1. User fills `name`, `email`, `message`.
2. Frontend sends `POST /api/contact`.
3. Backend validates payload and stores in memory.
4. Frontend shows success/error status.

## Backend Quote Validation Rules
- Ring must represent at least 3 distinct points.
- Ring is normalized and closed if needed.
- Self-intersecting polygons are rejected.
- `areaM2` and `perimeterM` are recomputed server-side.
- Client-submitted metrics must remain within 3% of server measurement.

## Pricing Logic
Formula:

`quoteTotal = baseFee + areaM2 * areaRate + perimeterM * perimeterRate`

Coefficients:
- `baseFee = 49`
- `areaRate = 0.085`
- `perimeterRate = 0.38`

Plan recommendation thresholds:
- `< 450 m²`: Starter Autonomy Plan
- `< 1200 m²`: Precision Weekly Plan
- otherwise: Estate Coverage Plan

## Error/Edge Case Handling
- Missing map token => quote map disabled with inline message.
- Address not found => error message.
- Self-intersection => warning + submit disabled.
- Too few points => submit disabled.
- Invalid/too-large JSON => backend 400/413.
- Rate limit exceeded => backend 429.
