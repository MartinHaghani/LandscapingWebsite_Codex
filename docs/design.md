# Design Decisions

## 1) Geodesic Measurement First
Decision:
- Use geodesic-friendly calculations for map-drawn polygons.

Why:
- Coordinates are latitude/longitude; planar formulas introduce distortion.
- Quote trust depends on measurement credibility.

Implementation:
- Area: `@turf/area`.
- Self-intersection detection: `@turf/kinks`.
- Perimeter: Haversine segment sum (`EARTH_RADIUS_M = 6,371,008.8`).

## 2) Server Re-Measurement And Drift Guard
Decision:
- Never trust client-submitted metrics as final.

Why:
- Prevent accidental or intentional metric mismatch.
- Keep quote integrity consistent across clients.

Implementation:
- Server recalculates area/perimeter from submitted ring.
- Reject submission when drift exceeds `3%`.

## 3) Deterministic Pricing Model
Decision:
- Keep pricing formula fixed and transparent.

Why:
- Predictable outputs simplify QA and regression testing.
- Easy to reason about in support/debug scenarios.

Implementation:
- `49 + areaM2*0.085 + perimeterM*0.38`.
- Simple threshold-based plan recommendation by area.

## 4) In-Memory Storage (For Now)
Decision:
- Store quotes/contacts in in-memory maps.

Why:
- Fast iteration during product prototyping.
- Minimal operational overhead.

Trade-off:
- Data is lost on server restart.

Planned evolution:
- Swap store implementation with SQLite/Postgres-backed persistence while preserving API contracts.

## 5) Strong Input Validation
Decision:
- Use Zod schema validation at API boundary.

Why:
- Centralized type + constraint enforcement.
- Clean, predictable error responses for invalid payloads.

## 6) Rate Limiting At API Layer
Decision:
- Apply both global API and write-path limits.

Why:
- Reduce abuse and accidental rapid resubmissions.
- Protect small in-memory service from request bursts.

## 7) UX-Controlled Polygon Editing
Decision:
- Separate drawing mode and edit mode.

Why:
- Prevent accidental point adds while dragging/editing.
- Make map interactions explicit and easier to understand.

## 8) Brand System Choice
Decision:
- Black/white base with green accent (`#329F5B`), large typography, soft borders/shadows.

Why:
- Align with “premium, modern, tech-forward landscaping” positioning.
- Keep map and quote interactions visually prominent.

## 9) Static SPA Fallback Server
Decision:
- Include `scripts/spa_server.py` for built-client route fallback.

Why:
- Prevent 404 on hard refresh for client-side routes (e.g., `/instant-quote`).
- Useful for stable demo/testing when dev server behavior is inconsistent.
