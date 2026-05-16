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
- confirmation-first `/quote-confirmation/:quoteId` handoff with a legacy redirect from `/quote-contact/:quoteId`
- `POST /api/quote/:quoteId/contact` finalizes submission and moves quote to `in_review` with `customer_status=pending`
- client keeps the browser-local draft and shows a direct API reachability error when the backend is unavailable, rather than a generic submit failure
- confirmation shown after finalize

## 4) Idempotency by Default on Retry-Prone Writes

Decision:

- Protect against duplicate mobile retries/back-button resubmits.

Implementation:

- `Idempotency-Key` required for:
  - quote draft
  - quote contact finalize
  - assisted quote request
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
- staging and production run on separate DigitalOcean Managed PostgreSQL databases with PostGIS enabled

## 6) Lead vs Contact vs Quote Separation

Decision:

- Keep people, communications, and quote transactions distinct.

Implementation:

- `leads` = identity container
- `lead_contacts` = communication events (`contact_form`, `quote_finalize`, `quote_claim`)
- `quotes` = transactional object + workflow state

## 7) Isolated Hosted Environments

Decision:

- Use staging as the hosted integration environment before production promotion.

Implementation:

- DigitalOcean App Platform runs separate staging and production apps.
- Staging auto-deploys from `staging`; production auto-deploys from `main`.
- Each environment has isolated public/admin/API components and a separate managed Postgres/PostGIS database.
- Node is pinned to `20.x` through the committed package `engines` fields so DigitalOcean builds do not drift to the platform default.
- Prisma migrations run as a pre-deploy job so schema changes block rollout if they fail.
- Secrets live in DigitalOcean environment variables, not committed app specs or `.env` files.
- Live status on 2026-05-02 UTC keeps this separation intact: staging is active with PostgreSQL 16/PostGIS and self-managed GoDaddy CNAMEs, authenticated quote/admin smoke tests pass through admin verification, redeploy persistence, approval-email resend, and Stripe sandbox Checkout/webhook payment confirmation. Production is active with the same App Platform shape, a separate empty managed database, GoDaddy DNS and HTTPS for `autoscape.ca`, `www`, `api`, and `admin`, live Clerk/Mapbox/Resend/Stripe env values in DigitalOcean, and auto-deploys only from `main`.

## 8) Immutable Revision History

Decision:

- Preserve full quote timeline and prevent in-place revision loss.

Implementation:

- append-only `quote_versions`
- unique `(quote_id, version_number)`
- version metadata includes `actor_type` (`client`/`admin`) + `changed_at`
- revisions keep internal status in `in_review`

## 9) Option-A Quote Workflow

Decision:

- enforce strict state transitions and keep revision semantics explicit.

Transitions:

- `draft -> submitted -> in_review -> verified/rejected`
- no backward status moves
- revision updates `customer_status` while remaining `in_review`
- runtime finalize path moves `draft -> in_review` directly (while preserving enum compatibility for `submitted`)
- selected version submit sets `status=verified`, `customer_status=awaiting_payment`
- verified submit creates a fresh secure payment token, attempts a one-button Resend quote email using the quote-origin email variant, records sent/failed delivery state for auditability, keeps approval successful on delivery failure, and exposes manual resend for verified quotes awaiting payment
- approved quote map previews are tokenized public image URLs backed by server-proxied Mapbox satellite static imagery; they show approved service area, added-by-admin area, and removed-by-admin area using the quote-tool color family, while email legends only include added/removed keys when those deltas exist
- approved quote payment links are tokenized public URLs (`/pay/:token`) stored as hashes server-side; resend rotates the payment token, and superseded emailed URLs resolve to the current payment link without creating separate checkout state
- public payment-link Checkout and authenticated dashboard Checkout share one post-payment completion page at `/payment-complete`, while cancellation returns customers to the originating payment page so retry remains clear

## 10) Event-Oriented Audit Logging

Decision:

- prefer compact event records and avoid default full-PII snapshots.

Implementation:

- `changed_fields` + redacted before/after by default
- full snapshots reserved for high-risk events (e.g., revisions)
- correlation metadata (`request_id`, `correlation_id`, `ip_hash`, `user_agent`)

## 11) Role-Based PII and Export Controls

Decision:

- default least-privilege for marketing access.

Implementation:

- roles: `OWNER`, `ADMIN`, `REVIEWER`, `MARKETING`
- MARKETING sees masked PII in API and CSV exports
- full PII export restricted to OWNER/ADMIN/REVIEWER

## 12) Launch-Cutoff Analytics Guard

Decision:

- keep analytics coherent at rollout boundaries.

Implementation:

- `SYSTEM_LAUNCH_AT` cutoff applied to attribution summary queries

## 13) Distance-Aware Seasonal Pricing Model

Decision:

- expose quote value in two forms: per-visit and seasonal discounted billing.

Implementation:

- service frequency is weekly-only in the public and admin quote flows
- visit count:
  - weekly: `20` visits from May to September
- pricing formula: `max(20 + 0.05*A + 0.10*P + 1.0*D, 45)`
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
- `quoteTotal` kept as compatibility alias for per-visit value

## 14) Admin Usability-First Redesign

Decision:

- move from tab-strip utility layout to operations dashboard shell.

Implementation:

- persistent sidebar navigation that stays fixed while content scrolls + top utility bar
- fixed Autoscape light theme matching the public site; no theme selector
- route-based quote editor (`/quotes/:quoteId/edit`) with full polygon controls and version submit flow
  - Mapbox satellite basemap to align map context with on-site property imagery
  - map surface mirrors the public instant quote editor controls, polygon colors, selected state, vertex markers, freehand drawing, and outline-click vertex insertion
  - immediate polygon hydration on load to avoid blank-editor states
  - latest quote email attempt is visible in the editor with manual resend support for verified quotes
- collapsed filter/sort disclosure on all tabs:
  - search
  - tab-specific filters
  - sort field/direction
- `Area requests` tab combines:
  - map module (heatmap + clustered points toggles)
  - hotspot list
  - request table
- quote CSV export moves out of the top bar into a less prominent bottom-page action

## 15) Admin Quote Creation + Quote ID Claim

Decision:

- Let staff create a polished, payable quote without entering customer contact details, then let the customer claim it by Quote ID.

Implementation:

- `/quotes/new` is a standalone admin workbench with a black/white/light-neutral base, Autoscape green primary actions, a large Satellite Streets map workspace with building outline context where Mapbox has coverage, a sticky stats/pricing panel, and a compact top bar centered on the reserved six-character Quote ID.
- `/quotes/new?requestId=...` switches the same workbench into assisted-request mode: the request address/customer context is preloaded, the saved quote links back to `quote_requests`, and the prepared quote email is triggered automatically.
- Assisted request creation requires a signed-in customer profile with phone, reuses an existing non-canceled same customer/address/location request, and its email uses a `View your quote` CTA-only action block without visible payment amount/mode or map legend/adjustment language.
- The creator reserves Quote IDs before save, exposes `Copy ID`, generic `/claim-quote`, and direct `/claim-quote?quoteId=...` actions, and saves directly to `status=verified` / `customer_status=awaiting_payment` with `auth_user_id=null`.
- Stats are grouped into geometry, pricing, validation, override, and customer-handoff sections so admin users can scan area, perimeter, per-visit price, full season, seasonal discount, discounted seasonal total, service-area warnings, and blocking geometry errors quickly.
- Service-area results warn but do not block admin quote creation; self-intersection, empty geometry, and missing valid lawn geometry block save.
- `/claim-quote` intentionally allows Quote ID-only preview before sign-up. The generic entry uses six large SMS-code style boxes grouped 3+3; the loaded page shows only quote summary, a small map preview, the two billing cards, and one `Continue` button before direct Stripe Checkout.
- Visual style uses restrained borders/shadows, 8px-radius operational surfaces, red only for blocking geometry errors, amber for out-of-area/admin warnings, and green for primary/save/valid states.
- The Quotes admin tab is split into nested operational subtabs (`All`, `Manual quote requests`, `Instant quote tool quotes`, `Admin generated quotes`) so request queues, customer-drawn quotes, and staff-created quotes do not compete for the same mental model.

## 16) Launch-Ready Public Content

Decision:

- remove placeholder production copy and tighten conversion-first messaging.

Implementation:

- home/services/gallery/contact pages now use production content
- contact page uses the warm-light section rhythm with phone and email promoted as compact direct actions beside the message form
- desktop signed-out navigation uses a slim divider between `Sign In` and `Sign Up` instead of punctuation
- services page uses a top-of-page `Services included` section with four real PNG image cards for Autonomous Mowing, Smart Edging, Cleanup & Debris, and Performance Reporting, removing the old inline SVG/placeholder card treatment and Seasonal Maintenance
- gallery page uses nine unique before/after PNGs in a restrained responsive grid, puts Richmond Hill examples first, removes per-image titles, and keeps captions to general Vaughan/Richmond Hill city labels plus `Before / After`
- footer uses real contact links (`tel:` + `mailto:`), quick navigation links, and a compact variant for quote/auth/payment funnel routes
- footer variants now expose core legal links and `/legal` indexes all launch legal documents rendered from Markdown source
- contact, quote submit, complete-profile, claim-quote, and payment checkout surfaces include nearby legal links matched to the action
- the post-Checkout success surface is a compact thank-you page that says `Thank you for choosing Autoscape! We start mowing the same week.` for both instant-quote and admin-generated quote payments
- mobile navigation includes in-header menu with quote CTA
- metadata updates in `client/index.html` improve social preview and launch polish
- `client/index.html` also loads the public Google Ads tag `AW-17991079326`; the admin shell stays separate from public advertising measurement
- successful public quote draft submissions fire the Google Ads `Submit lead form` conversion after server acceptance, using the quote ID as the transaction ID so repeat fires can be deduplicated

## 17) Quote Draft Recovery UX

Decision:

- prevent accidental loss of mapped geometry during refreshes/navigation.

Implementation:

- local snapshot persisted under `autoscape.quoteDraft.v2`
- snapshot includes:
  - step state
  - selected address metadata + map center
  - polygon history and active editing state (`ringPoints` + nullable `rawStrokePoints`)
  - unit mode and billing mode
- restore hydration completes before auto-save writes back, preserving map-step refreshes
- legacy local `serviceFrequency` fields are accepted and stripped during restore
- UI controls:
  - clear all geometry (map controls)
  - reset saved draft (address + map panels)

## 18) Unified Clerk Authentication

Decision:

- Use one auth provider (Clerk) across customer and admin surfaces.

Implementation:

- public app:
  - `/sign-in/*`, `/sign-up/*`
  - Google sign-in enabled
  - email/password with forgot/reset
  - shared `autoscapeClerkAppearance` themes Clerk cards, buttons, inputs, and account profile UI with Autoscape colors
  - required phone captured through in-app `/complete-profile/*`
  - phone persisted to `unsafeMetadata.autoscapeProfile.phone`
  - optional email marketing consent persisted to `unsafeMetadata.autoscapeProfile.emailMarketingConsent`
  - users missing phone are routed to `/complete-profile/*` before dashboard/confirmation
- admin app:
  - Clerk sign-in required before rendering admin shell
  - bearer token sent on all `/api/admin/*` requests
- server:
  - verifies bearer JWT via Clerk issuer/JWKS
  - derives customer profile identity (name/email/phone) for quote finalize actions
  - propagates account email-marketing opt-in to lead `consentMarketing` during quote claim/finalize

## 19) Progress-First Quote Entry

Decision:

- orient the instant quote page with workflow progress, not extra marketing copy.

Implementation:

- `/instant-quote` keeps only the `Instant Quote` badge above the working UI
- top-of-page step chrome is a compact-on-mobile non-interactive three-step rail for `Enter address`, `Map your lawn`, and `Review quote`
- rail states show `Current step`, `Complete`, and `Up next` instead of button-like cards
- address step stacks the input and continue button on mobile, then the in-service address choice step uses two matching cards for `Autoscape-Assisted Quote` and `Draw It Yourself`
- the assisted card intentionally says account/phone are required, Autoscape maps the lawn, and payment options arrive by email in less than 24 hours; the self-serve card says users can use the satellite map now and see pricing before submitting for review
- the map step uses a thin low-contrast address pill instead of a larger step header/instruction card
- clicked address suggestions and highlighted Enter selections immediately run the service-area gate from the selected suggestion data, with a pending state to prevent duplicate coverage checks
- after a fresh successful address-to-map transition, the map step reveals a centered guide modal shell 1 second after the map finishes loading
- guide step 1 now plays a looping miniature of the real draw-lawn workspace, including the live toolbar styling, no mini address pill, the polished popup-house SVG as the live background, and a visible cursor
- the tutorial now traces the front down lawn zone inside the same framed viewport treatment used by step 2, first as one loose curvy freehand outline and then with a shared 1.6-second camera transform while cursor movement and vertex dragging stay at normal guide speed, before drawing the top-left lawn so both left-side zones are complete
- the demo still uses the shared freehand finalizer so the first completed polygon lands on a plausible freehand-cleanup shape before the edit pass snaps it into place
- guide step 2 now starts from those two finished left-side lawns, draws only the right-side backyard zone as a separate service polygon, keeps the non-selected polygons on the lighter live-map styling, and uses the same 1.6-second camera transform timing without slowing cursor/edit phases while teaching one missing garden-notch point plus one explicit direct toolbar-Delete click/removal of an extra redundant point on the selected right-side polygon
- guide step 3 now keeps the same popup-house SVG background and completed three-zone lawn state from step 2, clicks `Draw obstacle`, traces a selected red obstacle polygon around the front tree in the bottom-left lawn, then holds that finished obstacle scene for 2 seconds before looping again
- selected guide vertices now use a live-tool-style marker treatment with a larger green core, pale green border, white outer ring, and soft halo so add, move, and delete selections are obvious
- the guide shell now uses a cleaner editorial panel with fewer nested rounded boxes: one white modal, shorter responsive mobile demo heights, a slowly fading unified demo-and-caption media unit with no divider or white caption box between SVG and text, a right-sized desktop demo stage whose camera layer aligns with the map-body clip window so the SVG starts centered and the bottom stays visible, a tighter centered caption strip directly under the demo, equal-width toolbar buttons, and progress pills in a flat navigation row between Back and Next
- the animated SVG guide stages now fade in softly when they appear, fade back out as each loop finishes, and use a slower fade-based transition between slides so resets feel less abrupt
- on the third slide, the right-side nav control changes from `Next` to a green `Done` button that slowly fades the popup back into the quote tool instead of dismissing the guide session
- the popup-house SVG now uses brighter greens and warmer accent materials so the background feels more vivid and less dull
- the caption strip is now step-aware: step 1 fades from `Draw loosely around your lawn.` to `Move the points to match your lawn.`, step 2 moves through `Draw each separate lawn area on its own.`, `Add extra points`, and `Delete extra points`, and step 3 shows `Use Draw obstacle for gardens, pools, and other no-mow areas.`
- guide dismissal is scoped to the current mapped-address session; restored local drafts do not auto-open it
- map step removes the embedded quote summary and uses a full-width map-first layout with a floating top-right `Guide` plus `Done` action cluster on desktop and a compact two-row mobile top dock that keeps `Done` visible above `Lawn`, `Obstacle`, `Delete`, and `Clear`
- the detailed under-map metrics/unit/draft summary card is desktop-only so mobile keeps the tool focused on mapping and blocking status messages above the map
- review step removes the progress rail and uses a two-section quote-ready layout: one top `Back to Map` action, a desktop top row with address-first property details, top season/per-visit price cards separated by an `or` divider, and a desktop-only right-side fitted map preview with quiet whole-number area/perimeter metadata, then a full-width lower payment-plan section with accessible radio plan cards separated by an `or` divider under `Choose how to pay`
- summary savings are kept inside the season plan card instead of a separate savings tile so the mobile review stays tighter
- review step moves the main CTA to a single page-bottom `Submit Quote` button

## 20) Freehand Quote Mapping

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

## 21) Home Hero Visual Language

Decision:

- Evolve the home hero into a calm, premium parcel animation that keeps restrained CAD dimensioning while pairing a wall-learning pass with a generated mowing infill.

Implementation:

- transparent hero module with no backdrop box or opaque background fill
- hero uses a true desktop 50/50 split with the content block on the left and the lawn graphic on the right
- on mobile, the lawn graphic is reordered under `Precise Cuts, Lower Costs` and before the CTA buttons
- CTA group keeps a small `No sign-up required.` helper line directly beneath the buttons
- one curated parcel silhouette anchors the hero, with a mower that first learns the perimeter walls, then follows a generated 11-pass horizontal boustrophedon infill with rounded U-turns before fading out and restarting
- parcel geometry is a fixed luxury-plan drawing made from four straight runs plus four true circular arcs, with displayed labels derived from the same geometry constants
- overlay uses eight thin CAD-style perimeter annotations outside the lawn: four close-set dashed metric linear lengths and four straight radius leaders that reveal only after the mower clears their segment and remain visible during path generation/mowing
- generated infill path uses a subtle, light sage raster line set inside the lawn so the pattern reads like a premium 3D-printer-style coverage plan rather than a harsh technical overlay, with denser directional arrows that clarify travel without cluttering the shape
- primary fill stays anchored to the brand green (`#329F5B`) with no texture, blueprint panel, or heavy gradient treatment
- a slightly heavier white outline and restrained under-shadow keep the parcel crisp over the page background
- the mower status cycles through `learning your lawn...`, `Generating path`, and `Mowing...` inside a compact glass-like capsule stacked immediately beneath the lawn, centered against the full lawn graphic width, with width that follows the active label and a ticker-flip transition for state changes
- no separate stats strip sits beneath the hero; the lawn animation and under-lawn status capsule carry the right-side emphasis on their own
- mobile ordering keeps product visuals early without changing desktop layout:
  - home hero renders one mobile-only lawn graphic directly between the value line and CTA buttons
  - mower section reuses one mower artwork block and renders it directly under the `Meet our lawnmowers` heading on mobile, while desktop keeps the text/image two-column split

## 22) Quote Ownership + Account Dashboard

Decision:

- Enforce owner-only customer quote access, bind drafts to authenticated users before finalize, and make the customer dashboard a single-action home rather than a generic profile/quote list.

Implementation:

- quote ownership column: `quotes.auth_user_id`
- ownership claim endpoint: `POST /api/quote/:quoteId/claim`
- owner/admin-only quote lookup: `GET /api/quote/:quoteId`
- finalize endpoint now auth-required and is triggered from the confirmation handoff
- finalize uses account name/email/phone server-side, with address sourced from quote draft
- signed-in draft creation and finalize sync quote address to Clerk private metadata:
  - `autoscapeProfile.defaultAddress`
  - `autoscapeProfile.addressHistory` (latest-first, deduped, max 10)
- account APIs:
  - `GET /api/account/quotes` returns owned quotes plus customer status, verification timing, payment summary, and dashboard payment-page URL
  - `GET /api/account/quotes/:quoteId` returns owned quote detail plus conditional Stripe card-on-file metadata
  - `POST /api/account/quotes/:quoteId/billing-portal` creates a Stripe-hosted customer portal session when billing context exists
- dashboard routes:
  - `/complete-profile/*`
  - `/dashboard`
  - `/dashboard/account/*`
  - `/dashboard/quotes/:quoteId`
  - `/dashboard/quotes/:quoteId/payment`
- `/dashboard` selects one primary quote by urgency (`awaiting payment/payment issue` -> `in review` -> `draft/contact pending` -> `paid/active`) and keeps quote history secondary so the page always leads with the next customer action, especially on mobile where amount/status/CTA sit before secondary details
- the top dashboard panel uses a dark account shell with state-driven copy for `Get instant quote`, `Quote is in review`, `Waiting for payment`, `All done`, plus a draft recovery state for unfinished submissions
- assisted requests get a dashboard tracking state before a payable quote exists, and assisted/admin-generated payable quotes skip the customer verification copy in favor of payment-ready lifecycle language
- the active property card keeps the address prominent, quote ID subdued, price conditional on `contact_pending=false`, and action buttons full-width on mobile
- incomplete quotes show a simple lifecycle timeline, May-September schedule note, and help panel; complete quotes swap the timeline for plan summary details
- saved-card management is intentionally delegated to Stripe Customer Portal instead of a custom card editor, and the `Card on file` panel is hidden when Stripe has no reusable default payment method
- public `/pay/:token` page uses the approved quote/payment visual language, shows the tokenized preview image when available, summarizes the exact approved payment terms in a task-first mobile layout, and sends the client to Stripe Checkout without a sign-in gate
- seasonal payments present one final upfront amount; per-session payments present weekly billing terms, May 1/start-at-checkout timing, the approved visit cap, and the September 30 outer stop
- `/dashboard/quotes/:quoteId/payment` uses the same approved payment visual language as an authenticated checkout surface for signed-in customers, with the amount/status/checkout action prioritized on mobile

## 28) Autoscape-Assisted Quote Path

Decision:

- Reduce client intimidation by offering a staff-prepared quote path without weakening geometry or pricing integrity.

Implementation:

- Post-address `/instant-quote` now branches into `Autoscape-Assisted Quote` and `Draw It Yourself`.
- Assisted selection preserves the address draft through Clerk sign-up and phone completion, then creates an idempotent `quote_requests` record.
- `QuoteOrigin` separates `instant_tool`, `admin_generated`, and `assisted_request` rows so dashboards/admin filters can skip the wrong verification assumptions.
- Admins fulfill assisted requests from the Manual quote requests tab; generated quotes are still real quote rows with valid server-measured geometry before payment links or emails exist.

## 23) Warm-Light Premium Public Refresh

Decision:

- Move public frontend from dark-first styling to a warm-light, readability-first design system while preserving all quote behavior.

Implementation:

- semantic token families in `tailwind.config.ts` + `client/src/index.css` (`canvas`, `surface`, `copy`, `line`, `brand`)
- public navbar and footer render the horizontal Autoscape PNG brand mark from `client/public/images/brand/autoscape-horizontal-brand.png`
- service-area map, home hero media, and pricing formula surfaces use shorter/mobile-readable layouts so key CTAs are visible without long scrolling
- larger default reading scale, higher text contrast, and clearer spacing rhythm for older homeowners
- standardized focus-visible treatment and form primitives (`form-label`, `form-input`, `status-*`)
- service-area map remains privacy-hardened but now uses light-compatible controls/popup treatment
- service-area coverage falls back to the default Vaughan station when no base-station env is provided, so deployment without station env still exposes non-empty approximate coverage
- instant-quote mapping keeps satellite basemap default for property precision, with warm-light control and review panels

## 24) Home Page Mower Action Video

Decision:

- Add a real mower footage section below the savings section so the price comparison is followed by proof of consistent maintenance without looking like an embedded video player.

Implementation:

- inserted directly below the pricing comparison and before the mower technology section
- uses a compact warm-light ruled band with `max-w-6xl` section width, text on the left, and one restrained rounded media surface on the right
- video asset comes from `/Users/martinhaghani/Downloads/Mower in action.mp4`, optimized to `client/public/videos/home/lawnmower-in-action.mp4`, with poster `client/public/videos/home/lawnmower-in-action-poster.png`
- intro content uses:
  - badge: `In Action`
  - heading: `Reliable. Consistent. Every Time.`
  - body: `Get the same clean cut every week, down to the centimetre. No rushed jobs, and no uneven patches, just steady and reliable maintenance that keeps your lawn looking sharp without you having to think about it.`
- compact labels are removed
- video autoplays muted, loops, plays inline, omits native controls, preloads metadata, and keeps an accessible label
- video fills the warm media surface edge-to-edge with no black backing; the overflow-hidden wrapper applies `scale-[1.025] origin-top-left` to subtly trim the bottom-right edge

## 25) Home Page Pricing Comparison

Decision:

- Keep the tighter two-part comparison layout while removing only the sample-lawn lead-in from the intro copy.

Implementation:

- inserted directly below the hero
- uses a 3,000 sq ft weekly sample lawn so visitors can compare one simple example quickly
- top copy keeps the sales sentence but drops the sample-lawn opener:
  - badge: `Price Check`
  - heading: `Save with Autoscape`
  - intro: `Get a cheaper visit rate and 20% off when you choose the seasonal plan.`
- Autoscape values come from existing quote helpers: `$45` per visit and `$720` per season after the default 20% seasonal savings
- layout keeps one unboxed sample context on the left and one shared comparison panel on the right instead of three tall marketing cards, with flatter ruled surfaces instead of stacked rounded bubbles
- the lawn visual stays as supporting context only, using a larger realistic lawn-only SVG that reads like lawn masked out of a top-view property, with asymmetrical broad lawn areas, firmer corners, a downward-facing driveway cutout, the same solid brand-green fill treatment as the hero parcel, a white outline, hero-style shadow, no decorative interior line strokes, and no rounded wrapper around the sample lawn area
- the sample size and schedule sit in one muted row below the lawn visual
- the shared comparison panel uses a narrower row-label column with structured `Autoscape` and `Local competitors` column headers, larger `Per visit` and `Per season` row headers, green Autoscape pricing, a slight rounded panel corner, and a top-right `20% off` badge lifted above the Autoscape season price so `$720` stays centered in its column
- on desktop, the shared comparison panel stretches to match the sample context box height
- footer copy keeps only the benchmark source and final-quote caveats close to the comparison in smaller grey supporting text, and the two price columns stay visually adjacent on mobile

## 26) Streamlined Home Page Narrative

Decision:

- Reduce the landing page to the highest-signal sections and remove secondary marketing blocks that slow the path to quote.

Implementation:

- home page now flows from hero to pricing comparison, mower action video, then into the mower technology section, a three-card services overview with Autonomous Mowing, Edging, and Cleanup & Debris, an FAQ with larger answer text and bold key phrases, and the closing quote CTA, with the post-hero sections using a flatter warm-light border rhythm that better matches the hero
- removed the standalone `Why Electric`, `How It Works`, `Why Autoscape`, and `Testimonials` sections
- removed the separate `/about` page and its navbar link so the public marketing surface is limited to home, services, gallery, contact, and the quote flow

## 27) Home Page Lawnmower Section

Decision:

- Add a dedicated trust-building mower section below pricing so visitors understand the product hardware before the services overview.

Implementation:

- inserted directly below `Save with Autoscape`
- uses a responsive two-column layout with information on the left and the mower image on the right
- the right-side asset is a cleaned transparent export derived from `/Users/martinhaghani/Downloads/Gemini_Generated_Image_7pnfyf7pnfyf7pnf.png` and stored as `client/public/images/home/mower-technology-transparent.png`
- left-side content uses:
  - heading: `Meet our lawnmowers`
- an unnumbered editorial spec list calls out:
  - `Centimetre precision`
  - `5 sensor types`
  - `Rigorously tested`
  - `Built-in safety features`
- the sensor point uses sensor fusion language
- each spec uses a consistent line-style green icon: horizontal ruler, signal/sensor, flask/experiment, and safety shield
- section remains informational only, with no CTA, and removes the boxed artwork treatment so the transparent mower sits directly in the page background with only restrained ambient shadow

## 28) Legal Launch Surface

Decision:

- Ship editable legal drafts as website content while keeping legal/business unknowns visible for attorney review.

Implementation:

- Markdown sources live in `client/src/content/legal/`
- `client/src/pages/LegalPage.tsx` renders `/legal` and `/legal/:slug` through raw Vite imports, avoiding a Markdown dependency for this pass
- launch documents cover privacy, terms, cookies, payments/refunds, landscaping/service disclaimers, automation, SMS/email communications, accessibility, acceptable use, third-party services, service area, and estimate/booking terms
- no media release terms were added because the app does not expose photo upload, testimonials, public reviews, before/after galleries, or customer media publishing
- footer legal links are present in full and compact footer variants
- action-adjacent legal notices are added to contact, quote submit, complete-profile, claim-quote, and payment checkout surfaces
- cookie banner behavior was intentionally not added because no consent framework exists in the app yet; the legal evidence report flags cookie consent strategy for business/legal review
