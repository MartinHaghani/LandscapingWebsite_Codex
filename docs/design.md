# Design Decisions

## 1) Coverage-First Public UX

Decision:

- Lead with serviceability clarity before full quote workflow.

Implementation:

- Service Area section at top of `/services`
- light basemap (`mapbox/light-v11`) + green `#329F5B` coverage overlay
- primary CTA to `/instant-quote`

## 2) Privacy Over Precision for Coverage Visualization

Decision:

- Displayed service area is approximate by design.

Implementation:

- merged station buffers
- simplification + jitter + coordinate quantization
- no station markers/IDs/centers in client payloads

## 3) Two-Phase Quote Submission

Decision:

- Separate geometry draft from required contact finalization.

Implementation:

- map builder stays local first, with server draft creation deferred to the review step
- dedicated `/instant-quote/summary` review page before draft creation
- `POST /api/quote/draft` from the review step
- dedicated `/quote-contact/:quoteId` page
- `POST /api/quote/:quoteId/contact` finalizes submission and moves quote to `in_review` with `customer_status=pending`
- confirmation shown after finalize

## 4) Idempotency by Default on Retry-Prone Writes

Decision:

- Protect against duplicate mobile retries/back-button resubmits.

Implementation:

- `Idempotency-Key` required for:
  - quote draft
  - quote contact finalize
  - contact submit
  - service-area request
- same payload replays exact stored response
- key reuse with different payload returns `409`

## 5) Durable Spatial Data Model

Decision:

- Use PostGIS-native spatial columns for quote/request/base-station coordinates.

Implementation:

- quote polygons in `geometry(MultiPolygon,4326)`
- points in `geography(Point,4326)`
- spatial GIST indexes for query performance

## 6) Lead vs Contact vs Quote Separation

Decision:

- Keep people, communications, and quote transactions distinct.

Implementation:

- `leads` = identity container
- `lead_contacts` = communication events (`contact_form`, `quote_finalize`)
- `quotes` = transactional object + workflow state

## 7) Immutable Revision History

Decision:

- Preserve full quote timeline and prevent in-place revision loss.

Implementation:

- append-only `quote_versions`
- unique `(quote_id, version_number)`
- version metadata includes `actor_type` (`client`/`admin`) + `changed_at`
- revisions keep internal status in `in_review`

## 8) Option-A Quote Workflow

Decision:

- enforce strict state transitions and keep revision semantics explicit.

Transitions:

- `draft -> submitted -> in_review -> verified/rejected`
- no backward status moves
- revision updates `customer_status` while remaining `in_review`
- runtime finalize path moves `draft -> in_review` directly (while preserving enum compatibility for `submitted`)
- selected version submit sets `status=verified`, `customer_status=awaiting_payment`

## 9) Event-Oriented Audit Logging

Decision:

- prefer compact event records and avoid default full-PII snapshots.

Implementation:

- `changed_fields` + redacted before/after by default
- full snapshots reserved for high-risk events (e.g., revisions)
- correlation metadata (`request_id`, `correlation_id`, `ip_hash`, `user_agent`)

## 10) Role-Based PII and Export Controls

Decision:

- default least-privilege for marketing access.

Implementation:

- roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`
- MARKETING sees masked PII in API and CSV exports
- full PII export restricted to OWNER/ADMIN/REVIEWER

## 11) Launch-Cutoff Analytics Guard

Decision:

- keep analytics coherent at rollout boundaries.

Implementation:

- `SYSTEM_LAUNCH_AT` cutoff applied to attribution summary queries

## 12) Distance-Aware Seasonal Pricing Model

Decision:

- expose quote value in two forms: per-session and seasonal discounted billing.

Implementation:

- cadence selector in public quote flow: `weekly` or `biweekly`
- session counts:
  - weekly: `26`
  - bi-weekly: `14`
- pricing formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 50)`
  - `D` uses nearest active base-station distance in km
- seasonal billing defaults to a 20% discount and can be configured later
- persistence fields on quotes:
  - `service_frequency`
  - `per_session_total`
  - `sessions_min`, `sessions_max`
  - `seasonal_total_min`, `seasonal_total_max`
  - `billing_mode`
  - `seasonal_discount_rate`
  - `distance_to_nearest_station_km` (internal-only)
- `quoteTotal` kept as compatibility alias for per-session value

## 13) Admin Usability-First Redesign

Decision:

- move from tab-strip utility layout to operations dashboard shell.

Implementation:

- persistent sidebar navigation + top utility bar
- auto light/dark theme with manual override
- route-based quote editor (`/quotes/:quoteId/edit`) with full polygon controls and version submit flow
  - satellite basemap to align map context with on-site property imagery
  - immediate polygon hydration on load to avoid blank-editor states
- unified toolbar pattern on all tabs:
  - search
  - tab-specific filters
  - sort field/direction
- requests tab combines:
  - map module (heatmap + clustered points toggles)
  - hotspot list
  - request table

## 14) Launch-Ready Public Content

Decision:

- remove placeholder production copy and tighten conversion-first messaging.

Implementation:

- home/services/about/contact pages now use production content
- services page uses five shared-style inline SVG illustrations and removes the old mixed photo/placeholder card treatment, including removal of `Multi-Zone Scheduling`
- footer uses real contact links (`tel:` + `mailto:`) and quick navigation links
- mobile navigation includes in-header menu with quote CTA
- metadata updates in `client/index.html` improve social preview and launch polish

## 15) Quote Draft Recovery UX

Decision:

- prevent accidental loss of mapped geometry during refreshes/navigation.

Implementation:

- local snapshot persisted under `autoscape.quoteDraft.v2`
- snapshot includes:
  - step state
  - selected address metadata + map center
  - polygon history and active editing state (`ringPoints` + nullable `rawStrokePoints`)
  - unit mode and cadence
- UI controls:
  - clear all geometry (map controls)
  - reset saved draft (address + map panels)

## 16) Unified Clerk Authentication

Decision:

- Use one auth provider (Clerk) across customer and admin surfaces.

Implementation:

- public app:
  - `/sign-in/*`, `/sign-up/*`
  - Google sign-in enabled
  - email/password with forgot/reset
  - required phone captured through in-app `/complete-profile/*`
  - phone persisted to `unsafeMetadata.autoscapeProfile.phone`
  - users missing phone are routed to `/complete-profile/*` before dashboard/finalize
- admin app:
  - Clerk sign-in required before rendering admin shell
  - bearer token sent on all `/api/admin/*` requests
- server:
  - verifies bearer JWT via Clerk issuer/JWKS
  - derives customer profile identity (name/email/phone) for quote finalize actions

## 17) Progress-First Quote Entry

Decision:

- orient the instant quote page with workflow progress, not extra marketing copy.

Implementation:

- `/instant-quote` keeps only the `Instant Quote` badge above the working UI
- top-of-page step chrome is a non-interactive three-step rail for `Enter address`, `Map your lawn`, and `Review quote`
- rail states show `Current step`, `Complete`, and `Up next` instead of button-like cards
- map step uses a thin low-contrast address pill instead of a larger step header/instruction card
- after a fresh successful address-to-map transition, the map step reveals a centered guide modal shell 1 second after the map finishes loading
- the guide shell is intentionally blank for now, with a soft scrim, warm-light glass treatment, subtle top-right close control, and bottom `Back` / `Next` navigation paired with a pill slider for future guided steps
- guide dismissal is scoped to the current mapped-address session; restored local drafts do not auto-open it
- map step removes the embedded quote summary and uses a full-width map-first layout with a more prominent floating top-right `Done` action
- review step uses one unified summary card with address-first property details, area/perimeter directly under the address, a live fitted property preview on the right, one `Back to Map` action beneath it, visit-count context near service frequency, and lighter billing-plan cards across the bottom
- review step moves the main CTA to a single page-bottom `Submit Quote` button

## 18) Freehand Quote Mapping

Decision:

- replace point-by-point polygon authoring with persistent freehand drawing in both the public quote tool and the admin quote editor.

Implementation:

- primary map actions are `Draw lawn` and `Draw obstacle`
- selecting either action enters persistent draw mode and swaps the active button label to `Stop drawing`
- pointer down starts a stroke, pointer move samples it, and pointer up simplifies the stroke into `ringPoints`
- draw-end simplification distance-normalizes freehand strokes, caps vertex density by distance, and removes redundant wobble on straight runs
- simplification is conservative: sharp corners and intentional curves are preserved
- overlapping start/end close-loop tails are trimmed back to one clean join corner
- clicking near the outline of the selected polygon inserts a vertex directly onto that edge and selects it
- completed strokes automatically exit draw mode
- created polygons stay vertex-editable for cleanup/refinement after freehand capture
- undo/redo are icon-only arrows in a dedicated top-left map control box
- delete and `Clear all` are grouped together, and `Clear all` requires a second confirmation click
- geometry edits do not auto-reframe the map zoom
- the address marker is a green home icon inside the white location dot
- browser-local draft persistence bumps to `autoscape.quoteDraft.v2`
- `polygonSource` storage contract is now `schemaVersion: 2`
  - `activePolygonId`
  - `polygons[].id`
  - `polygons[].kind`
  - `polygons[].ringPoints`
  - `polygons[].rawStrokePoints | null`
- server canonical quote geometry remains the measured `polygon_geom`, derived from `ringPoints`
- legacy point-list `schemaVersion: 1` editor payloads are intentionally unsupported after the cutover
- development/test data can be wiped with `npm --prefix server run cutover:freehand-reset-dev-data` before rollout

## 19) Home Hero Visual Language

Decision:

- Evolve the home hero into a calm, premium parcel animation that keeps restrained CAD dimensioning while pairing a wall-learning pass with a generated mowing infill.

Implementation:

- transparent hero module with no backdrop box or opaque background fill
- hero uses a true desktop 50/50 split with the content block on the left and the lawn graphic on the right
- CTA group keeps a small `No sign-up required.` helper line directly beneath the buttons
- one curated parcel silhouette anchors the hero, with a mower that first learns the perimeter walls, then follows a generated 11-pass horizontal boustrophedon infill with rounded U-turns before fading out and restarting
- parcel geometry is a fixed luxury-plan drawing made from four straight runs plus four true circular arcs, with displayed labels derived from the same geometry constants
- overlay uses eight thin CAD-style perimeter annotations outside the lawn: four close-set dashed metric linear lengths and four straight radius leaders that reveal only after the mower clears their segment and remain visible during path generation/mowing
- generated infill path uses a subtle, light sage raster line set inside the lawn so the pattern reads like a premium 3D-printer-style coverage plan rather than a harsh technical overlay, with denser directional arrows that clarify travel without cluttering the shape
- primary fill stays anchored to the brand green (`#329F5B`) with no texture, blueprint panel, or heavy gradient treatment
- a slightly heavier white outline and restrained under-shadow keep the parcel crisp over the page background
- the mower status cycles through `learning your lawn...`, `Generating path`, and `Mowing...` inside a compact glass-like capsule stacked immediately beneath the lawn, with width that follows the active label and a ticker-flip transition for state changes
- no separate stats strip sits beneath the hero; the lawn animation and under-lawn status capsule carry the right-side emphasis on their own

## 20) Quote Ownership + Account Dashboard

Decision:

- Enforce owner-only customer quote access and bind drafts to authenticated users before finalize.

Implementation:

- quote ownership column: `quotes.auth_user_id`
- ownership claim endpoint: `POST /api/quote/:quoteId/claim`
- owner/admin-only quote lookup: `GET /api/quote/:quoteId`
- finalize endpoint now auth-required and accepts optional notes only
- finalize uses account name/email/phone server-side, with address sourced from quote draft
- signed-in draft creation and finalize sync quote address to Clerk private metadata:
  - `autoscapeProfile.defaultAddress`
  - `autoscapeProfile.addressHistory` (latest-first, deduped, max 10)
- account APIs:
  - `GET /api/account/quotes`
  - `GET /api/account/quotes/:quoteId`
- dashboard routes:
  - `/complete-profile/*`
  - `/dashboard`
  - `/dashboard/quotes/:quoteId`

## 21) Warm-Light Premium Public Refresh

Decision:

- Move public frontend from dark-first styling to a warm-light, readability-first design system while preserving all quote behavior.

Implementation:

- semantic token families in `tailwind.config.ts` + `client/src/index.css` (`canvas`, `surface`, `copy`, `line`, `brand`)
- larger default reading scale, higher text contrast, and clearer spacing rhythm for older homeowners
- standardized focus-visible treatment and form primitives (`form-label`, `form-input`, `status-*`)
- service-area map remains privacy-hardened but now uses light-compatible controls/popup treatment
- instant-quote mapping keeps satellite basemap default for property precision, with warm-light control and review panels

## 22) Home Page Sustainability Proof

Decision:

- Add a short evidence-based electric proof section near the top of the home page without turning the landing page into a research report.

Implementation:

- inserted directly below the hero
- two-column layout with marketing copy on the left and a premium comparison card on the right
- three compact electric-vs-gas bars:
  - point-of-use exhaust
  - measured noise at 25 ft
  - qualified 10-year lifecycle CO2e from the cited push mower study
- copy keeps "zero emissions" explicitly tied to exhaust at the point of use and avoids silent/absolute environmental phrasing
