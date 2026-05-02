# Feature Flow

## Public Shell

1. User sees the horizontal Autoscape PNG brand mark in the navbar on entry and again in the footer.
2. Navbar keeps desktop nav links, quote CTA, signed-out auth links with the slim divider, signed-in dashboard link, and mobile menu behavior.
3. Public page loads include the Google Ads tag `AW-17991079326` from the Vite HTML shell.
4. Quote, auth, confirmation, payment, and dashboard-payment funnel routes render a compact footer; general marketing routes keep the full footer.
5. Footer variants link to core legal pages, and `/legal` lists the Markdown legal documents rendered from `client/src/content/legal/`.

## Services: Coverage-First Entry

1. User opens `/services`.
2. Page loads `GET /api/service-area` and renders approximate coverage overlay on a light basemap, with a shorter visible map on mobile.
   - The API builds coverage from server-side base-station config and falls back to the default Vaughan station when no base-station env is provided.
3. Page presents five illustrated service cards: Autonomous Mowing, Smart Edging, Cleanup & Debris, Seasonal Maintenance, and Performance Reporting.
4. User clicks `Check my address` CTA to start Instant Quote.

## Home: Transparent Hero Graphic

1. User opens `/`.
2. Hero opens as a balanced desktop split: left side for headline, subhead, CTA buttons, and `No sign-up required.` helper copy; right side for the oversized lawn graphic. On narrow mobile screens, the lawn graphic moves directly under `Precise Cuts, Lower Costs` and before the CTA buttons, and the CTA buttons stack before returning to a row once there is enough width.
3. Hero media renders a transparent lawn parcel directly over the existing page background and occupies most of the right half.
4. The parcel silhouette follows one fixed curated path made from four straight runs and four circular corner arcs at a locked hero-only scale.
5. Hero animation phases loop in order:
   - `learning your lawn...`: mower fades in and traces the inset perimeter walls while dimensions reveal after each cleared segment
   - `Generating path`: a 2-second infill build phase draws a subtle 11-pass horizontal boustrophedon coverage pattern with softer rounded U-turns and denser direction arrows across the lawn interior
   - `Mowing...`: mower appears directly at the first scanline point, follows the full generated infill path, then the mower/path fade out before the next learning cycle
6. The status capsule is stacked directly beneath the lawn shape, centered against the full lawn graphic width, resizes to the active label width, and uses a ticker-flip transition with no separate stats strip beneath the two-column hero.

## Home: Pricing Comparison

1. User continues directly below the hero into a tighter pricing comparison section.
2. Section anchors the example around a 3,000 sq ft weekly sample lawn and keeps the larger portrait asymmetrical lawn SVG as supporting context only, with the same downward-facing driveway cutout, no decorative interior strokes, the same solid brand-green fill treatment used by the hero parcel, and no rounded bubble wrapper around the sample lawn area.
3. Autoscape pricing is derived from existing client quote helpers, not separate marketing-only constants:
   - `$45` per visit
   - `$720` per season after the default 20% seasonal savings
4. Layout uses two flatter parts instead of three equal cards:
   - left: unboxed sample context with the lawn visual and one muted metadata row for `3,000 sq ft lawn` and `20 weekly visits`
   - right: one shared comparison panel with a narrower row-label column and structured `Autoscape` and `Local competitors` column headers kept adjacent on mobile
5. Shared comparison panel shows:
   - `Per visit`: green `$45` vs `$55`
   - `Per season`: centered `$720` with a top-right `20% off` badge lifted off the number vs `$1,100`
6. Desktop layout stretches the shared comparison panel to match the sample box height, enlarges the `Per visit` and `Per season` row labels, and keeps only the bottom disclaimer in smaller grey supporting text.

## Home: Lawnmower Section

1. User continues below the pricing comparison into a dedicated `Meet our lawnmowers` section.
2. Layout uses a responsive two-column split:
   - left: product copy and four unnumbered selling points
   - right: a cleaned transparent mower asset placed directly into the page background with ambient glow, not a framed card
3. On mobile, the mower asset renders directly under the `Meet our lawnmowers` heading before the selling points so the product signal appears earlier.
4. Selling points highlight:
   - `Centimetre precision`
   - `5 sensor types`
   - `Rigorously tested`
   - `Built-in safety features`
5. The sensor copy uses `sensor fusion`, and each selling point has a consistent line-style green icon: horizontal ruler, signal/sensor, flask/experiment, and safety shield.
6. Section remains informational only and is intended to build trust before the visitor reaches the services overview.

## Home: Streamlined Marketing Flow

1. After the pricing comparison, the page moves into the mower technology section and then the services overview, with the remaining sections using flatter warm-light surfaces, restrained borders, and fewer rounded card treatments so they match the hero area.
2. Home services overview includes Autonomous Mowing, Edging, and Cleanup & Debris before the FAQ and final quote CTA.
3. The retired Why Electric, How It Works, Why Autoscape, and Testimonials sections are no longer part of the landing-page flow.
4. The FAQ answers cover cut cadence, Vaughan-area service coverage, home access, kids/pets safety, weather timing, and pricing, using larger answer text with bold key phrases.
5. The page closes with FAQ cards and the final instant-quote CTA.

## Deployment Promotion Flow

1. Codex/local work happens on feature branches and is verified locally before merge.
2. Staging deploys automatically from the `staging` branch to the DigitalOcean `autoscape-staging` app.
3. Current staging status on 2026-04-21: the app deployment and migration job are active, package manifests pin Node `20.x`, custom domains use self-managed GoDaddy CNAME records, and authenticated customer/admin quote smoke tests pass through admin verification plus persistence after redeploy.
4. Staging smoke tests cover API health, public/admin SPA refreshes, quote creation, Clerk auth, admin review, CORS, and persistence after API redeploy. The approved-quote preview and resend routes are deployed, and the API has both Stripe secrets configured; production remains blocked until real authenticated approval email/resend smoke, Stripe checkout smoke, and launch confirmation are complete.
5. Production deploys manually from `main` to the DigitalOcean `autoscape-production` app only after staging blockers are cleared and launch is confirmed.
6. Schema migrations run through the App Platform `migrate` pre-deploy job before the API rollout in each environment.

## Instant Quote: Draft + Finalize

0. `/instant-quote` opens with a compact three-step progress rail that shows `Enter address` first, then `Map your lawn`, then `Review quote`.

### Step 1: Address + Coverage Gate

1. User enters/selects address (Canada/US suggestions only).
2. Suggestion list supports keyboard controls (`ArrowUp/ArrowDown/Enter/Escape`) and click selection.
   - Clicking a suggestion immediately runs the coverage gate and continues to the map when in area.
   - Pressing Enter on a highlighted suggestion behaves the same way.
   - Auto-continue uses the selected suggestion's `{ address, center }` directly instead of waiting for React state to flush, and a pending state blocks duplicate coverage checks.
3. Address input and continue action stack on mobile so neither control squeezes the other.
4. Client resolves selection to `lat/lng`.
5. Client calls `POST /api/service-area/check`.
6. Gate outcomes:

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
7. Undo/redo live in their own arrow-only box at the top-left of the map on desktop. On mobile, a compact two-row top dock keeps undo/redo plus `Guide`/`Done` in the first row and `Lawn`, `Obstacle`, `Delete`, and `Clear` in the second row.
8. Delete and `Clear all` are grouped together, and `Clear all` requires confirmation. The confirmation label shortens to `Confirm` on mobile while desktop keeps `Confirm clear all`.
9. Geometry edits do not auto-reframe the map zoom.
10. Quote map stays on satellite basemap by default; controls use warm-light, high-contrast UI surfaces.
11. Map header chrome is reduced to a thin address pill with a subtle `Change address` action, and the address marker uses a green home icon inside the white dot.
12. The detailed under-map summary card remains available on desktop but is hidden on mobile, including area/perimeter/lawn/obstacle metrics, unit toggle, reset saved draft, and draft status.
13. After a fresh successful address-to-map transition, the client waits for the map to finish loading and reveals a centered guide modal shell after 1 second.
14. Guide step 1 loops a miniature draw-lawn demo using the real map-tool chrome, the polished popup-house SVG as the live background, and a visible cursor.
15. The tutorial clicks `Draw lawn`, traces one loose curvy freehand outline around the front down lawn zone, and finalizes that stroke through the same shared freehand logic used by the live tool.
16. The completed front-down tutorial polygon first appears with vertices on the freehand-derived shape inside the same framed viewport treatment used by step 2, then the demo camera uses the shared 1.6-second transform timing while cursor movement and vertex dragging stay at normal guide speed before drawing the top-left lawn zone so both left-side polygons are complete.
17. Guide step 2 starts from those two completed left-side lawn polygons, clicks `Draw lawn`, and traces only the right-side backyard zone.
18. Step 2 keeps completed non-active lawn polygons unselected with the same green fill/outline styling used in the live quote map, then shows vertices on a deliberately imperfect selected right-side draft with one missing garden-notch corner and one extra redundant point.
19. The step-2 cursor then teaches two edit tools in sequence: it uses the same shared 1.6-second camera transform without slowing cursor/edit phases while inserting and dragging a new point, then zooms into the extra point, selects it with a live-tool-style highlighted vertex marker, moves directly to the toolbar `Delete` button, shows a stronger click pulse, removes that point, and eases back out before ending on a corrected three-zone lawn layout.
20. Guide step 3 keeps the same SVG house background and finished three-zone lawn state from step 2, clicks `Draw obstacle`, traces a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that completed obstacle scene for 2 seconds before looping again.
21. The guide shell now uses a cleaner editorial panel: one white modal with shorter responsive mobile demo heights, a slowly fading unified demo-and-caption media unit with no divider or white caption box between SVG and text, a right-sized desktop demo stage whose camera layer is aligned to the map-body clip window so the SVG starts centered and the bottom remains visible, a tighter centered caption strip directly under the demo, equal-width toolbar buttons, and segmented progress pills in the separate Back/Next navigation row.
22. The animated SVG steps now fade in softly when they appear, fade back out as each loop finishes, and use a slower fade-based transition between slides.
23. On the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool without dismissing the current guide session.
24. The caption strip is now step-aware: step 1 uses `Draw loosely around your lawn.` and `Move the points to match your lawn.`, step 2 uses `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 uses `Use Draw obstacle for gardens, pools, and other no-mow areas.`
25. Dismissing the guide keeps it closed for the current mapped-address session; changing address and loading a new map session re-arms it. Restored local drafts do not auto-open the guide.
26. Builder page is full-width and uses a floating top-right action cluster with a manual `Guide` help button beside the primary `Done` action on desktop, plus the compact top dock on mobile instead of the old embedded summary/sidebar feeling.
27. Client auto-saves draft state in browser local storage (address + step + geometry + billing mode + unit mode) under `autoscape.quoteDraft.v2`; restore hydration completes before auto-save writes back, so map-step drafts reopen directly on the Mapbox builder, and legacy local `serviceFrequency` fields are stripped.
28. Client computes effective geometry and pricing with:

- `perVisit = max(20 + 0.05*A + 0.10*P + 1.0*D, 45)`
- `D` from `POST /api/service-area/check` (`distanceToNearestStationKm`)
- fixed visits: weekly=20 from May to September
- seasonal default discount: 20%

### Step 3: Review Quote

1. `Done` navigates to `/instant-quote/summary` only when the mapped draft passes the existing geometry guardrails.
2. Review page removes the step progress rail and shows a two-section quote-ready layout: one top `Back to Map` action, a desktop top row with address-first quote details and top season/per-visit price cards separated by an `or` divider on the left, a desktop-only map preview with quiet whole-number area/perimeter metadata on the right, then a full-width lower payment-plan section.
3. Review page presents `Per Season` and `Per Visit` as radio plan cards under `Choose how to pay`, separated by an `or` divider; `Per Season` shows a struck-through regular price plus savings inside the plan card, `Per Visit` shows the full-season total inline, and `billingMode` stays in sync with the selected card.
4. User sees Terms, Privacy Policy, and Estimate Terms links near the bottom `Submit Quote` button.
5. User taps the bottom `Submit Quote` button, which still creates the draft and then routes to contact details.
6. Client submits idempotent draft from the review page:

- `POST /api/quote/draft`
- header: `Idempotency-Key`
- payload includes `serviceFrequency` + `billingMode`
- payload includes `polygonSource.schemaVersion = 2` with `activePolygonId`, `polygons[].ringPoints`, and nullable `polygons[].rawStrokePoints`

7. Server validates geometry, derives canonical quote geometry from `ringPoints`, and stores draft quote + version 1 history row.
8. After the successful draft response, the client fires the Google Ads `Submit lead form` conversion `AW-17991079326/FqIMCOHXqYIcEJ6r6IJD` with the quote ID as the transaction ID.
9. If request is authenticated, server records draft address to Clerk account metadata (`addressHistory`, latest as `defaultAddress`).
10. Client clears local draft snapshot and routes to `/quote-confirmation/:quoteId`.
11. If the API is unreachable instead, client keeps the local draft and shows a direct API reachability error so the user can retry after the backend is available.

### Contact Finalize (Required)

1. User lands on `/quote-confirmation/:quoteId` (legacy `/quote-contact/:quoteId` routes redirect here).
2. If signed out, client redirects to `/sign-in/*` with a return URL for the confirmation page.
3. User signs in (email/password, Google, forgot/reset supported by Clerk).
4. If signed-in account has no phone (legacy profile), user is redirected to `/complete-profile/*`.
   - Complete Profile includes an optional unchecked email-marketing opt-in and stores it in Clerk unsafe metadata.
5. Client claims ownership of draft quote:

- `POST /api/quote/:quoteId/claim`
- header: `Authorization: Bearer <clerk session token>`

6. Confirmation page fetches the draft quote and auto-finalizes it when `contactPending === true`.
7. Client calls idempotent finalize endpoint:

- `POST /api/quote/:quoteId/contact`
- header: `Idempotency-Key`
- header: `Authorization: Bearer <clerk session token>`

8. Server marks quote `in_review`, `customer_status=pending`, `contact_pending=false`, and writes lead contact event.
9. Server records quote address again into Clerk metadata as a secondary sync pass and propagates any account email marketing opt-in to the lead.
10. Confirmation page renders the in-review workflow summary and 24-hour response-time note.

### Customer Dashboard

1. Signed-in user opens `/dashboard`.
2. If phone is missing, user is redirected to `/complete-profile/*`.
3. Client calls owner-scoped account APIs:

- `GET /api/account/quotes`
- `GET /api/account/quotes/:quoteId`
- `GET /api/quote/:quoteId` (owner/admin only)

4. Dashboard ranks one primary quote by urgency: awaiting payment/payment issue first, then in review, then draft/contact-pending recovery, then paid/active.
5. Dashboard shows an action-first customer home:

- `Next action` panel with one of: get instant quote, finish submitting quote, quote is in review, waiting for payment, or all done
- active property card with address, subdued quote ID, billing mode, and price only after `contact_pending=false`
- lifecycle timeline while the primary quote is not complete
- May-September schedule note and need-help contact panel
- conditional quote history only when multiple quotes exist and the primary quote is still in progress
- conditional Stripe `Card on file` panel only when Stripe returns a reusable saved/default payment method
- account summary card with link to `/dashboard/account/*` for Clerk-managed password, profile, and security tasks
- secondary quote detail screen (`/dashboard/quotes/:quoteId`) with grouped mobile-readable quote details
- authenticated approved-quote payment screen (`/dashboard/quotes/:quoteId/payment`) that can start Stripe Checkout for the owned quote with full-width mobile actions
6. On mobile, the dashboard and payment surfaces keep the amount/status/next CTA before secondary summaries and supporting account details.
7. If a saved Stripe billing method exists, `POST /api/account/quotes/:quoteId/billing-portal` creates a Stripe Customer Portal session so the customer can update the card on file from the dashboard without a custom card form.

### Admin-Created Quote Claim

1. Admin opens `/quotes/new`, reserves a real six-character Quote ID through `POST /api/admin/quotes/reserve-id`, and sees that ID before saving.
2. Admin selects an address, draws lawn and obstacle polygons on the Satellite Streets map, watches area/perimeter/lawn/obstacle/vertex stats update live, and sees warning-only service-area feedback. Building outlines and house-number labels appear where Mapbox has coverage; they are not treated as legal parcel lines.
3. Admin pricing uses the canonical formula, a global discount defaulting to `0%`, a seasonal discount defaulting to `20%`, and optional override mode where editing either per-visit or discounted seasonal price recalculates the other value from 20 weekly visits.
4. Admin saves through `POST /api/admin/quotes`; the server remeasures geometry, rejects invalid/self-intersecting geometry, consumes the reserved ID, writes `quotes.auth_user_id=null`, `status=verified`, `customer_status=awaiting_payment`, `contact_pending=false`, and creates quote version 1 with `actor_type=admin`.
5. Admin copies either `/claim-quote` or `/claim-quote?quoteId=ABC123` and gives it to the customer.
6. Customer opens `/claim-quote`, enters the six-character Quote ID in the grouped `ABC 123` code field or receives it from the direct URL, and loads `GET /api/quote-preview/:quoteId` before signing up. Legacy `Q-...` URLs still resolve.
7. If signed out, the customer continues to sign-up first, can switch to sign-in through Clerk, and returns through `/complete-profile?redirect_url=/claim-quote?quoteId=...&billing=...&continue=checkout`.
8. After phone completion, the customer claims the quote with `POST /api/quote/:quoteId/claim`; the server associates `quotes.auth_user_id` and records a `quote_claim` contact event when account contact data is available.
9. Customer chooses `seasonal` or `per_session`; `POST /api/account/quotes/:quoteId/billing-mode` persists the choice before payment starts.
10. Customer presses the single `Continue` button; `/claim-quote` calls `POST /api/account/quotes/:quoteId/payment/checkout` and redirects directly to Stripe Checkout.

### Public Approved Quote Payment

1. Admin approval or manual resend creates a fresh secure payment token and sends a simplified approved-quote payment email with one `/pay/:token` button, the actual selected payment amount/mode, quote details, and the unchanged approved map preview.
2. `GET /api/payment-links/:token` loads sanitized approved quote details, payment status, and the shared approved quote preview image without requiring sign-in.
3. `POST /api/payment-links/:token/checkout` creates or reuses a Stripe Checkout Session. Signed-in customers can also create/reuse Checkout from `POST /api/account/quotes/:quoteId/payment/checkout`.
   - Public and dashboard payment pages link the checkout action to the Refund, Cancellation, and Payment Policy plus Terms.
4. Seasonal quotes use one-time Checkout for the approved discounted seasonal total.
5. Per-session quotes use weekly subscription Checkout; if paid before May 1, the subscription uses a May 1 billing-cycle anchor with no proration, otherwise the first charge starts at checkout.
6. Per-session billing is capped at the approved `sessionsMax` count and no later than September 30.
7. Stripe webhooks, not success redirects, update payment state. Duplicate webhook events are ignored idempotently, and duplicate paid invoice IDs do not advance the visit counter twice.
8. Staging Checkout has the required API Stripe env configured and still needs to be smoke-tested end to end.

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

1. User opens `/contact` under the `Talk to the Autoscape Team` heading and sees compact direct phone and email actions beside the message form.
2. User can call/email directly or submit the contact form (name/email/phone/message required, address optional, email marketing opt-in optional and unchecked by default).
3. Client sends idempotent `POST /api/contact`.
4. Server writes/updates lead + contact event and persists `consentMarketing=true` only when the user explicitly opts in.

## Admin Operations Flow

### Sign-In Session

1. Admin app opens at `admin/`.
2. The shell uses the fixed Autoscape light theme with a sidebar that stays in place while content scrolls.
3. User signs in through Clerk.
4. App sends bearer token on all admin requests.
5. Server verifies token + organization membership + mapped admin role.
6. App verifies access via `GET /api/admin/health`.

### Quote Inbox

1. Load `GET /api/admin/quotes` (cursor pagination + search/filter/sort params); controls start inside a collapsed filter/sort disclosure.
2. Admin actions:

- create a quote on `/quotes/new`
  - reserve Quote ID (`POST /api/admin/quotes/reserve-id`)
  - draw/edit service and obstacle geometry with the same Satellite Streets map controls used by quote editing
  - save anonymous payable quote (`POST /api/admin/quotes`)
  - copy the Quote ID, generic claim link, or direct claim link
- open route-based editor `/quotes/:quoteId/edit` for `in_review` quotes
- full map edit with the same freehand draw + vertex-refine tools used in public quote flow
  - editor map uses the same Mapbox satellite imagery, polygon colors, selected-state styling, vertex markers, and control placement as the public instant quote map
  - saved quote polygons are rendered immediately when the editor opens from stored `polygonSource v2`
  - editor uses the same distance-normalized draw-end simplification pass as the public quote tool, including the per-distance vertex cap, straight-edge wobble cleanup, and close-loop overlap trimming
  - selected polygon outlines in both public and admin can be clicked near an edge to insert and select a new vertex; selected polygons or selected points can be deleted with the same toolbar action
- save new version (`POST /api/admin/quotes/:id/versions`)
- submit selected version (`POST /api/admin/quotes/:id/versions/:versionNumber/submit`)
  - sets `status=verified`, `customer_status=awaiting_payment`
  - creates a fresh secure payment token, attempts the one-button payment-focused approved-quote email through Resend, and records `approval_email_sent` or `approval_email_failed` without rolling back approval
  - creates a tokenized approved-quote preview URL backed by the saved client/admin polygon sources and Mapbox satellite static imagery
- resend approved quote email (`POST /api/admin/quotes/:id/approval-email/resend`) for verified quotes awaiting payment; resend rotates the payment token and revokes older active payment links
- public approved-quote preview image (`GET /api/approved-quote-preview/:token`) proxies the Mapbox image without exposing the Mapbox token
- public approved-quote payment link (`/pay/:token`) opens Stripe Checkout through `POST /api/payment-links/:token/checkout`
- quote editor shows the latest Stripe payment mode/status, paid invoice count, lifecycle timestamps, and related Stripe object IDs for support/debugging
- legacy revise endpoint remains for backward compatibility
- add internal note

### Expansion + CRM Views

- `Area requests`: `GET /api/admin/service-area-requests` (list)
- `GET /api/admin/service-area-requests/map` (heatmap + cluster point payload)
- `GET /api/admin/leads`
- `GET /api/admin/contacts`
- `GET /api/admin/audit-logs`

### Attribution + Export

- `GET /api/admin/attribution/summary` (launch-cutoff aware)
- `GET /api/admin/exports/quotes.csv` (masked/full based on role), exposed as a quieter bottom-page action in the admin UI
