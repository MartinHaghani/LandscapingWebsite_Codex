# Design Decisions

## 1) Coverage-First Public UX
Decision:
- Lead with serviceability clarity before full quote workflow.

Implementation:
- Service Area section at top of `/services`
- dark basemap + green `#329F5B` coverage overlay
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
- `POST /api/quote/draft` from mapping step
- dedicated `/quote-contact/:quoteId` page
- `POST /api/quote/:quoteId/contact` finalizes submission
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
- revisions keep internal status in `in_review`

## 8) Option-A Quote Workflow
Decision:
- enforce strict state transitions and keep revision semantics explicit.

Transitions:
- `draft -> submitted -> in_review -> verified/rejected`
- no backward status moves
- revision updates `customer_status` while remaining `in_review`

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

## 12) Session-Range Pricing Model
Decision:
- expose quote value in two forms: per-session and seasonal planning range.

Implementation:
- cadence selector in public quote flow: `weekly` or `biweekly`
- session windows:
  - weekly: `26-30`
  - bi-weekly: `13-15`
- persistence fields on quotes and quote_versions:
  - `service_frequency`
  - `per_session_total`
  - `sessions_min`, `sessions_max`
  - `seasonal_total_min`, `seasonal_total_max`
- `quoteTotal` kept as compatibility alias for per-session value

## 13) Admin Usability-First Redesign
Decision:
- move from tab-strip utility layout to operations dashboard shell.

Implementation:
- persistent sidebar navigation + top utility bar
- auto light/dark theme with manual override
- unified toolbar pattern on all tabs:
  - search
  - tab-specific filters
  - sort field/direction
- requests tab combines:
  - map module (heatmap + clustered points toggles)
  - hotspot list
  - request table
