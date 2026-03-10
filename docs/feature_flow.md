# Feature Flow

## Services: Coverage-First Entry
1. User opens `/services`.
2. Page loads `GET /api/service-area` and renders approximate coverage overlay.
3. User clicks `Check my address` CTA to start Instant Quote.

## Instant Quote: Draft + Finalize

### Step 1: Address + Coverage Gate
1. User enters/selects address (Canada/US suggestions only).
2. Client resolves selection to `lat/lng`.
3. Client calls `POST /api/service-area/check`.
4. Gate outcomes:
- in area: proceed to map step
- out of area: redirect `/service-unavailable`
- check failure: redirect `/service-check-error`

### Step 2: Geometry Mapping
1. User draws service polygons and optional obstacles.
2. User selects cadence (`Weekly` or `Bi-weekly`).
3. Client computes effective geometry, per-session pricing, and seasonal range.
4. Client submits idempotent draft:
- `POST /api/quote/draft`
- header: `Idempotency-Key`
- payload includes `serviceFrequency`
5. Server validates geometry and stores draft quote + v1 version.
6. Client routes to `/quote-contact/:quoteId`.

### Contact Finalize (Required)
1. User submits name/email/phone (address optional, notes optional).
2. Client calls idempotent finalize endpoint:
- `POST /api/quote/:quoteId/contact`
- header: `Idempotency-Key`
3. Server marks quote `submitted`, `contact_pending=false`, writes lead contact event.
4. Client routes to `/quote-confirmation/:quoteId`.

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
2. User enters role/user ID/token (local header mode or static token mode).
3. App verifies access via `GET /api/admin/health`.

### Quote Inbox
1. Load `GET /api/admin/quotes` (cursor pagination + search/filter/sort params).
2. Admin actions:
- move `submitted -> in_review`
- verify `in_review -> verified`
- revise per-session pricing in `in_review` (append quote version, seasonal range recomputed)
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
