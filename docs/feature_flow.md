# Feature Flow

## Services: Coverage-First Entry

1. User opens `/services`.
2. Page loads `GET /api/service-area` and renders approximate coverage overlay on a light basemap.
3. Page presents five illustrated service cards: Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
4. User clicks `Check my address` CTA to start Instant Quote.

## Home: Transparent Hero Graphic

1. User opens `/`.
2. Hero opens as a balanced desktop split: left side for headline, subhead, CTA buttons, and `No sign-up required.` helper copy; right side for the oversized lawn graphic.
3. Hero media renders a transparent lawn parcel directly over the existing page background and occupies most of the right half.
4. The parcel silhouette follows one fixed curated path made from four straight runs and four circular corner arcs at a locked hero-only scale.
5. Hero animation phases loop in order:
   - `learning your lawn...`: mower fades in and traces the inset perimeter walls while dimensions reveal after each cleared segment
   - `Generating path`: a 2-second infill build phase draws a subtle 11-pass horizontal boustrophedon coverage pattern with softer rounded U-turns and denser direction arrows across the lawn interior
   - `Mowing...`: mower appears directly at the first scanline point, follows the full generated infill path, then the mower/path fade out before the next learning cycle
6. The status capsule is stacked directly beneath the lawn shape, resizes to the active label width, and uses a ticker-flip transition with no separate stats strip beneath the two-column hero.

## Home: Sustainability Proof

1. User continues below the hero into a compact electric-vs-gas proof section.
2. Left column explains the homeowner-facing value in plain language: no exhaust where the work happens, lower neighborhood noise, and lower lifecycle emissions versus gas equipment.
3. Right column shows three compact bar comparisons:
   - point-of-use exhaust
   - measured noise at 25 ft
   - 10-year lifecycle CO2e from the cited push mower study
4. Homepage copy keeps "zero emissions" limited to exhaust at the point of use and avoids silent/absolute wording.

## Instant Quote: Draft + Finalize

0. `/instant-quote` opens with a compact three-step progress rail that shows `Enter address` first, then `Map your lawn`, then `Review quote`.

### Step 1: Address + Coverage Gate

1. User enters/selects address (Canada/US suggestions only).
2. Suggestion list supports keyboard controls (`ArrowUp/ArrowDown/Enter/Escape`) and click selection.
3. Client resolves selection to `lat/lng`.
4. Client calls `POST /api/service-area/check`.
5. Gate outcomes:

- in area: proceed to map step
- out of area: redirect `/service-unavailable`
- check failure: redirect `/service-check-error`

### Step 2: Geometry Mapping

1. User enters persistent freehand draw mode with either `Draw lawn` or `Draw obstacle`.
2. While active, the selected draw button changes to `Stop drawing`; pointer down starts a stroke, pointer move samples it, and pointer up closes one polygon.
3. Draw-end cleanup removes clearly redundant straight-line vertices while preserving sharp corners and intentional curves.
4. Completed strokes automatically exit draw mode.
5. User can still drag vertices after creation to refine the simplified ring; manual vertex edits clear stored `rawStrokePoints` for that polygon.
6. User can clear all geometry, undo/redo edits, and delete selected polygon/vertex.
7. Undo/redo live in their own arrow-only box at the top-left of the map. Delete and `Clear all` are grouped together, and `Clear all` requires confirmation.
8. Geometry edits do not auto-reframe the map zoom.
9. Quote map stays on satellite basemap by default; controls use warm-light, high-contrast UI surfaces.
10. Map header chrome is reduced to a thin address pill with a subtle `Change address` action, and the address marker uses a green home icon inside the white dot.
11. Builder page is full-width and uses a more prominent floating top-right `Done` action instead of the old embedded summary sidebar.
12. Client auto-saves draft state in browser local storage (address + step + geometry + cadence + billing mode + unit mode) under `autoscape.quoteDraft.v2`.
13. Client computes effective geometry and pricing with:
   - `perSession = max(20 + 0.05*A + 0.10*P + 1.0*D, 50)`
   - `D` from `POST /api/service-area/check` (`distanceToNearestStationKm`)
   - fixed sessions: weekly=26, bi-weekly=14
   - seasonal default discount: 20%

### Step 3: Review Quote

1. `Done` navigates to `/instant-quote/summary` only when the mapped draft passes the existing geometry guardrails.
2. Review page shows one unified review card with address first, area/perimeter directly under the address, cadence controls with visit-count context, a live fitted property preview, and one `Back to Map` button directly under the preview.
3. Review page presents `Per Season` and `Per Session` as side-by-side plan cards; `Per Season` shows a struck-through regular price plus savings, `Per Session` shows the seasonal total inline, and `billingMode` stays in sync with the selected card.
4. User taps the bottom `Submit Quote` button, which still creates the draft and then routes to contact details.
5. Client submits idempotent draft from the review page:

- `POST /api/quote/draft`
- header: `Idempotency-Key`
- payload includes `serviceFrequency` + `billingMode`
- payload includes `polygonSource.schemaVersion = 2` with `activePolygonId`, `polygons[].ringPoints`, and nullable `polygons[].rawStrokePoints`

6. Server validates geometry, derives canonical quote geometry from `ringPoints`, and stores draft quote + version 1 history row.
7. If request is authenticated, server records draft address to Clerk account metadata (`addressHistory`, latest as `defaultAddress`).
8. Client clears local draft snapshot and routes to `/quote-contact/:quoteId`.

### Contact Finalize (Required)

1. User lands on `/quote-contact/:quoteId`.
2. If signed out, page shows auth wall (sign-in/sign-up).
3. User signs in (email/password, Google, forgot/reset supported by Clerk).
4. If signed-in account has no phone (legacy profile), user is redirected to `/complete-profile/*`.
5. Client claims ownership of draft quote:

- `POST /api/quote/:quoteId/claim`
- header: `Authorization: Bearer <clerk session token>`

6. User submits optional notes only. Name/email/phone are derived from account profile and address comes from quote draft.
7. Client calls idempotent finalize endpoint:

- `POST /api/quote/:quoteId/contact`
- header: `Idempotency-Key`
- header: `Authorization: Bearer <clerk session token>`

8. Server marks quote `in_review`, `customer_status=pending`, `contact_pending=false`, and writes lead contact event.
9. Server records quote address again into Clerk metadata as a secondary sync pass.
10. Client routes to `/quote-confirmation/:quoteId`.

### Customer Dashboard

1. Signed-in user opens `/dashboard`.
2. If phone is missing, user is redirected to `/complete-profile/*`.
3. Client calls owner-scoped account APIs:

- `GET /api/account/quotes`
- `GET /api/account/quotes/:quoteId`
- `GET /api/quote/:quoteId` (owner/admin only)

4. Dashboard shows:

- profile summary
- linked quote list/statuses
- quote detail screen (`/dashboard/quotes/:quoteId`)
- placeholder Billing and Messages cards

## Out-of-Area Expansion Capture

1. `/service-unavailable` loads map with:

- service area overlay
- entered-address marker

2. Page auto-sends idempotent request:

- `POST /api/service-area/request`
- source: `out_of_area_page`
- `isInServiceAreaAtCapture=false`

3. User options:

- retry address (`/instant-quote`)
- request expansion (`/service-area-requested`)

## Contact Form

1. User submits contact form (name/email/phone/message required, address optional).
2. Client sends idempotent `POST /api/contact`.
3. Server writes/updates lead + contact event.

## Admin Operations Flow

### Sign-In Session

1. Admin app opens at `admin/`.
2. User signs in through Clerk.
3. App sends bearer token on all admin requests.
4. Server verifies token + organization membership + mapped admin role.
5. App verifies access via `GET /api/admin/health`.

### Quote Inbox

1. Load `GET /api/admin/quotes` (cursor pagination + search/filter/sort params).
2. Admin actions:

- open route-based editor `/quotes/:quoteId/edit` for `in_review` quotes
- full map edit with the same freehand draw + vertex-refine tools used in public quote flow
  - editor map uses satellite imagery for visual verification
  - saved quote polygons are rendered immediately when the editor opens from stored `polygonSource v2`
  - editor uses the same distance-normalized draw-end simplification pass as the public quote tool, including the per-distance vertex cap, straight-edge wobble cleanup, and close-loop overlap trimming
  - selected polygon outlines in both public and admin can be clicked near an edge to insert and select a new vertex
- save new version (`POST /api/admin/quotes/:id/versions`)
- submit selected version (`POST /api/admin/quotes/:id/versions/:versionNumber/submit`)
  - sets `status=verified`, `customer_status=awaiting_payment`
  - writes deferred verification-email audit placeholder (delivery integration pending)
- legacy revise endpoint remains for backward compatibility
- add internal note

### Expansion + CRM Views

- `GET /api/admin/service-area-requests` (list)
- `GET /api/admin/service-area-requests/map` (heatmap + cluster point payload)
- `GET /api/admin/leads`
- `GET /api/admin/contacts`
- `GET /api/admin/audit-logs`

### Attribution + Export

- `GET /api/admin/attribution/summary` (launch-cutoff aware)
- `GET /api/admin/exports/quotes.csv` (masked/full based on role)
