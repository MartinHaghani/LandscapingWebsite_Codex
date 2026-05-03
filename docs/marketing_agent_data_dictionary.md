# Marketing Agent Data Dictionary

This document is the operating contract for an external ChatGPT/Codex-style analyst agent with read-only production database access.

## Analyst Defaults

- Prefer reporting views before raw tables.
- Answer briefly by default.
- Use raw PII only for internal marketing analysis when it materially improves the answer.
- Treat pricing constants, geometry validation, and quote measurement logic as review-required product controls.
- Do not recommend changing quote formulas, geometry math, security controls, or runtime/deployment settings without explicit human review.
- Attribution is directional: first touch, last touch, submit snapshot, and ad-platform spend can disagree because of delayed conversions, consent state, blocked storage, or cross-device behavior.

## Canonical Views

- `marketing_funnel_daily`: daily first-party funnel counts and conversion rates.
- `campaign_performance_daily`: Google Ads spend joined to first-party funnel outcomes by campaign/date.
- `source_landing_page_performance`: landing path/source/campaign performance.
- `quote_dropoff_sessions`: last observed quote step and time spent per analytics session.
- `experiment_performance_daily`: experiment/variant outcomes when events include `experiment_name`, `variant`, or `exposure_id`.
- `geo_demand_summary`: service-area request demand grouped by address-derived city candidate and coverage status.
- `lead_quality_summary`: quote quality by source/campaign, value bucket, property-size bucket, approval, rejection, and payment.
- `paid_customer_attribution`: paid customer rows joined to first touch, last touch, submit snapshot, latest analytics attribution, customer contact fields, and payment status.

## Core Tables

- `analytics_sessions`: browser session, anonymous ID, landing attribution, Google ValueTrack fields, device/browser, and consent snapshot.
- `analytics_events`: allowlisted user/server events with event ID dedupe, route, step, optional public quote ID, event properties, and attribution snapshot.
- `ad_platform_daily_metrics`: Google Ads daily spend/performance by account, date, campaign, ad group, ad, device, and network.
- `ad_spend_import_runs`: Google Ads import run status, date range, row count, request IDs, and error message.
- `attribution_touches`: lead/quote attribution snapshots for first touch, last touch, session touch, and submit snapshot.
- `quotes`, `leads`, `lead_contacts`, `quote_payment_links`, `service_area_requests`: business source of truth for lead quality and customer outcomes.

## Canonical Metrics

- `quote_start_rate = quote.started sessions / page.viewed sessions`
- `address_completion_rate = quote.address_selected sessions / quote.started sessions`
- `serviceable_rate = in-area service checks / all service checks`
- `map_completion_rate = quote.summary_viewed sessions / quote.map_loaded sessions`
- `draft_rate = quote.draft_created quotes / quote.started sessions`
- `lead_completion_rate = quote.finalized quotes / quote.draft_created quotes`
- `approval_rate = quote.admin_approved quotes / quote.finalized quotes`
- `paid_conversion_rate = payment.completed quotes / quote.started sessions`
- `cost_per_quote = spend / quote.draft_created`
- `cost_per_finalized_lead = spend / quote.finalized`
- `cost_per_approved_quote = spend / quote.admin_approved`
- `CAC = spend / payment.completed`

## Event Taxonomy

Page and CTA:

- `page.viewed`
- `cta.clicked`
- `faq.opened`
- `contact.action_clicked`
- `contact.started`
- `contact.submitted`

Quote funnel:

- `quote.started`
- `quote.address_started`
- `quote.address_selected`
- `quote.service_area_checked`
- `quote.service_area_rejected`
- `quote.map_loaded`
- `quote.guide_opened`
- `quote.guide_completed`
- `quote.drawing_started`
- `quote.polygon_completed`
- `quote.obstacle_completed`
- `quote.validation_failed`
- `quote.summary_viewed`
- `quote.billing_mode_selected`
- `quote.submit_clicked`
- `quote.draft_created`
- `quote.auth_required`
- `quote.claimed`
- `quote.finalized`
- `quote.confirmation_viewed`

Payment and admin outcome:

- `payment.link_viewed`
- `payment.checkout_started`
- `payment.completed`
- `quote.admin_approved`
- `quote.admin_rejected`

## Common Questions

- Which campaigns have the lowest CAC?
- Which campaigns generate many drafts but few finalized leads?
- Where do mobile users drop in the quote flow?
- Which landing pages have high quote starts but weak map completion?
- Which source/campaign combinations produce rejected quotes?
- Which cities or out-of-area clusters should inform service expansion?
- Which quote value/property-size buckets become paid customers most often?
- Did a specific experiment variant improve the next-step conversion rate enough to be considered directional?

## Caveats

- `analytics_events.quote_id` stores the public quote ID when available; `quotes.id` is the internal database ID.
- Server lifecycle events use synthetic server sessions so they appear in analytics without depending on browser delivery.
- `ad_platform_daily_metrics.conversion_value_micros` stores Google Ads reported conversion value converted to micros.
- The Google Ads importer refreshes a trailing date window because Google Ads metrics can change after the first import.
- `GET /api/admin/analytics/health` surfaces data-quality counters for missing session links, missing attribution on submitted/paid quotes, lifecycle events without matching quote records, impossible funnel order, UTM casing drift, sudden event-volume drops, and recent Google Ads import failures.
- The read-only agent role may see full PII by business choice; access should be limited, rotated, and audited outside the application where possible.
- Experiment rows are directional unless sample sizes are large enough for a human-approved decision standard.
