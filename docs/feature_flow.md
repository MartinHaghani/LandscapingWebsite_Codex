# Feature Flow

## Services: Coverage-First Entry

1. User opens `/services`.
2. Page loads `GET /api/service-area` and renders approximate coverage overlay.
3. User clicks `Check my address` CTA to start Instant Quote.

## Instant Quote: Draft + Finalize

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

1. User draws service polygons and optional obstacles.
2. User can clear all geometry, undo/redo edits, and delete selected polygon/vertex.
3. User selects cadence (`Weekly` or `Bi-weekly`).
4. Client auto-saves draft state in browser local storage (address + step + geometry + cadence + unit mode).
5. Client computes effective geometry, per-session pricing, and seasonal range.
6. Client submits idempotent draft:

- `POST /api/quote/draft`
- header: `Idempotency-Key`
- payload includes `serviceFrequency`

7. Server validates geometry and stores draft quote + v1 version.
8. Client clears local draft snapshot and routes to `/quote-contact/:quoteId`.

### Contact Finalize (Required)

1. User lands on `/quote-contact/:quoteId`.
2. If signed out, page shows auth wall (sign-in/sign-up).
3. User signs in (email/password, Google, forgot/reset supported by Clerk).
4. Client claims ownership of draft quote:

- `POST /api/quote/:quoteId/claim`
- header: `Authorization: Bearer <clerk session token>`

5. User submits phone (required), address (optional), and notes (optional). Name/email come from account profile.
6. Client calls idempotent finalize endpoint:

- `POST /api/quote/:quoteId/contact`
- header: `Idempotency-Key`
- header: `Authorization: Bearer <clerk session token>`

7. Server marks quote `in_review`, `customer_status=pending`, `contact_pending=false`, and writes lead contact event.
8. Client routes to `/quote-confirmation/:quoteId`.

### Customer Dashboard

1. Signed-in user opens `/dashboard`.
2. Client calls owner-scoped account APIs:

- `GET /api/account/quotes`
- `GET /api/account/quotes/:quoteId`
- `GET /api/quote/:quoteId` (owner/admin only)

3. Dashboard shows:

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
- full map edit with the same polygon tools used in public quote flow
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
