CREATE TABLE "analytics_sessions" (
  "id" TEXT NOT NULL,
  "anonymous_id" VARCHAR(120) NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL,
  "landing_path" VARCHAR(300),
  "landing_url" VARCHAR(1000),
  "referrer" VARCHAR(500),
  "gclid" VARCHAR(120),
  "gbraid" VARCHAR(120),
  "wbraid" VARCHAR(120),
  "utm_source" VARCHAR(160),
  "utm_medium" VARCHAR(160),
  "utm_campaign" VARCHAR(200),
  "utm_term" VARCHAR(200),
  "utm_content" VARCHAR(200),
  "utm_id" VARCHAR(200),
  "google_campaign_id" VARCHAR(120),
  "google_ad_group_id" VARCHAR(120),
  "google_ad_id" VARCHAR(120),
  "google_keyword" VARCHAR(200),
  "google_match_type" VARCHAR(40),
  "google_device" VARCHAR(40),
  "google_network" VARCHAR(80),
  "device_type" VARCHAR(40),
  "browser" VARCHAR(80),
  "user_agent" VARCHAR(300),
  "functional_consent" BOOLEAN NOT NULL DEFAULT true,
  "analytics_consent" BOOLEAN NOT NULL DEFAULT true,
  "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_events" (
  "event_id" VARCHAR(120) NOT NULL,
  "session_id" TEXT,
  "anonymous_id" VARCHAR(120),
  "lead_id" TEXT,
  "quote_id" VARCHAR(120),
  "event_name" VARCHAR(80) NOT NULL,
  "route" VARCHAR(300) NOT NULL,
  "step" VARCHAR(80),
  "properties_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "gclid" VARCHAR(120),
  "gbraid" VARCHAR(120),
  "wbraid" VARCHAR(120),
  "utm_source" VARCHAR(160),
  "utm_medium" VARCHAR(160),
  "utm_campaign" VARCHAR(200),
  "utm_term" VARCHAR(200),
  "utm_content" VARCHAR(200),
  "utm_id" VARCHAR(200),
  "landing_path" VARCHAR(300),
  "landing_url" VARCHAR(1000),
  "referrer" VARCHAR(500),
  "google_campaign_id" VARCHAR(120),
  "google_ad_group_id" VARCHAR(120),
  "google_ad_id" VARCHAR(120),
  "google_keyword" VARCHAR(200),
  "google_match_type" VARCHAR(40),
  "google_device" VARCHAR(40),
  "google_network" VARCHAR(80),
  "device_type" VARCHAR(40),
  "browser" VARCHAR(80),
  "user_agent" VARCHAR(300),
  "functional_consent" BOOLEAN NOT NULL DEFAULT true,
  "analytics_consent" BOOLEAN NOT NULL DEFAULT true,
  "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "ad_platform_daily_metrics" (
  "id" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  "platform" VARCHAR(40) NOT NULL,
  "account_id" VARCHAR(120) NOT NULL,
  "date" DATE NOT NULL,
  "campaign_id" VARCHAR(120) NOT NULL DEFAULT 'unknown',
  "campaign_name" VARCHAR(300),
  "ad_group_id" VARCHAR(120) NOT NULL DEFAULT 'unknown',
  "ad_group_name" VARCHAR(300),
  "ad_id" VARCHAR(120) NOT NULL DEFAULT 'unknown',
  "ad_name" VARCHAR(300),
  "device" VARCHAR(40) NOT NULL DEFAULT 'unknown',
  "network" VARCHAR(80) NOT NULL DEFAULT 'unknown',
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "cost_micros" BIGINT NOT NULL DEFAULT 0,
  "conversions" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "conversion_value_micros" BIGINT NOT NULL DEFAULT 0,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ad_platform_daily_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_platform_daily_metrics_platform_check" CHECK ("platform" = 'google_ads')
);

CREATE TABLE "ad_spend_import_runs" (
  "id" TEXT NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "request_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "ad_spend_import_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_spend_import_runs_provider_check" CHECK ("provider" = 'google_ads'),
  CONSTRAINT "ad_spend_import_runs_status_check" CHECK ("status" IN ('running', 'succeeded', 'failed'))
);

CREATE UNIQUE INDEX "ad_platform_daily_metrics_unique_idx"
  ON "ad_platform_daily_metrics"(
    "platform",
    "account_id",
    "date",
    "campaign_id",
    "ad_group_id",
    "ad_id",
    "device",
    "network"
  );

CREATE INDEX "analytics_sessions_started_at_idx" ON "analytics_sessions"("started_at" DESC);
CREATE INDEX "analytics_sessions_google_campaign_id_idx" ON "analytics_sessions"("google_campaign_id");
CREATE INDEX "analytics_sessions_utm_idx" ON "analytics_sessions"("utm_source", "utm_campaign");
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at" DESC);
CREATE INDEX "analytics_events_event_name_created_at_idx" ON "analytics_events"("event_name", "created_at" DESC);
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");
CREATE INDEX "analytics_events_quote_id_idx" ON "analytics_events"("quote_id");
CREATE INDEX "analytics_events_google_campaign_id_idx" ON "analytics_events"("google_campaign_id");
CREATE INDEX "ad_platform_daily_metrics_date_idx" ON "ad_platform_daily_metrics"("date" DESC);
CREATE INDEX "ad_spend_import_runs_started_at_idx" ON "ad_spend_import_runs"("started_at" DESC);

ALTER TABLE "analytics_events"
  ADD CONSTRAINT "analytics_events_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "analytics_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE VIEW "marketing_funnel_daily" AS
WITH event_counts AS (
  SELECT
    "created_at"::date AS "date",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'page.viewed') AS "page_view_sessions",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started') AS "quote_start_sessions",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.address_selected') AS "address_selected_sessions",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.service_area_checked') AS "service_area_check_sessions",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.map_loaded') AS "map_loaded_sessions",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.summary_viewed') AS "summary_viewed_sessions",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.draft_created') AS "draft_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.finalized') AS "finalized_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.admin_approved') AS "approved_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'payment.completed') AS "paid_customers"
  FROM "analytics_events"
  GROUP BY "created_at"::date
)
SELECT
  "date",
  "page_view_sessions",
  "quote_start_sessions",
  "address_selected_sessions",
  "service_area_check_sessions",
  "map_loaded_sessions",
  "summary_viewed_sessions",
  "draft_quotes",
  "finalized_quotes",
  "approved_quotes",
  "paid_customers",
  ("quote_start_sessions"::decimal / NULLIF("page_view_sessions", 0)) AS "quote_start_rate",
  ("address_selected_sessions"::decimal / NULLIF("quote_start_sessions", 0)) AS "address_completion_rate",
  ("summary_viewed_sessions"::decimal / NULLIF("map_loaded_sessions", 0)) AS "map_completion_rate",
  ("draft_quotes"::decimal / NULLIF("quote_start_sessions", 0)) AS "draft_rate",
  ("finalized_quotes"::decimal / NULLIF("draft_quotes", 0)) AS "lead_completion_rate",
  ("approved_quotes"::decimal / NULLIF("finalized_quotes", 0)) AS "approval_rate",
  ("paid_customers"::decimal / NULLIF("quote_start_sessions", 0)) AS "paid_conversion_rate"
FROM event_counts;

CREATE OR REPLACE VIEW "campaign_performance_daily" AS
WITH spend AS (
  SELECT
    "date",
    "platform",
    "account_id",
    "campaign_id",
    MAX("campaign_name") AS "campaign_name",
    SUM("impressions") AS "impressions",
    SUM("clicks") AS "clicks",
    SUM("cost_micros") AS "cost_micros",
    SUM("conversions") AS "ad_reported_conversions",
    SUM("conversion_value_micros") AS "ad_reported_conversion_value_micros"
  FROM "ad_platform_daily_metrics"
  GROUP BY "date", "platform", "account_id", "campaign_id"
),
outcomes AS (
  SELECT
    "created_at"::date AS "date",
    COALESCE(NULLIF("google_campaign_id", ''), NULLIF("utm_id", ''), NULLIF("utm_campaign", ''), 'direct') AS "campaign_id",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started') AS "quote_starts",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.draft_created') AS "draft_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.finalized') AS "finalized_leads",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.admin_approved') AS "approved_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'payment.completed') AS "paid_customers"
  FROM "analytics_events"
  GROUP BY "created_at"::date, COALESCE(NULLIF("google_campaign_id", ''), NULLIF("utm_id", ''), NULLIF("utm_campaign", ''), 'direct')
)
SELECT
  COALESCE(spend."date", outcomes."date") AS "date",
  COALESCE(spend."platform", 'first_party') AS "platform",
  spend."account_id",
  COALESCE(spend."campaign_id", outcomes."campaign_id") AS "campaign_id",
  spend."campaign_name",
  COALESCE(spend."impressions", 0) AS "impressions",
  COALESCE(spend."clicks", 0) AS "clicks",
  COALESCE(spend."cost_micros", 0) AS "cost_micros",
  COALESCE(spend."cost_micros", 0)::decimal / 1000000 AS "cost",
  COALESCE(outcomes."quote_starts", 0) AS "quote_starts",
  COALESCE(outcomes."draft_quotes", 0) AS "draft_quotes",
  COALESCE(outcomes."finalized_leads", 0) AS "finalized_leads",
  COALESCE(outcomes."approved_quotes", 0) AS "approved_quotes",
  COALESCE(outcomes."paid_customers", 0) AS "paid_customers",
  (COALESCE(spend."cost_micros", 0)::decimal / 1000000 / NULLIF(outcomes."draft_quotes", 0)) AS "cost_per_quote",
  (COALESCE(spend."cost_micros", 0)::decimal / 1000000 / NULLIF(outcomes."finalized_leads", 0)) AS "cost_per_finalized_lead",
  (COALESCE(spend."cost_micros", 0)::decimal / 1000000 / NULLIF(outcomes."approved_quotes", 0)) AS "cost_per_approved_quote",
  (COALESCE(spend."cost_micros", 0)::decimal / 1000000 / NULLIF(outcomes."paid_customers", 0)) AS "cac"
FROM spend
FULL OUTER JOIN outcomes
  ON outcomes."date" = spend."date"
  AND outcomes."campaign_id" = spend."campaign_id";

CREATE OR REPLACE VIEW "source_landing_page_performance" AS
WITH sessions AS (
  SELECT
    COALESCE("landing_path", '/') AS "landing_path",
    COALESCE("utm_source", 'direct') AS "source",
    COALESCE("utm_campaign", "utm_id", 'none') AS "campaign",
    COUNT(*) AS "sessions"
  FROM "analytics_sessions"
  GROUP BY COALESCE("landing_path", '/'), COALESCE("utm_source", 'direct'), COALESCE("utm_campaign", "utm_id", 'none')
),
events AS (
  SELECT
    COALESCE("landing_path", '/') AS "landing_path",
    COALESCE("utm_source", 'direct') AS "source",
    COALESCE("utm_campaign", "utm_id", 'none') AS "campaign",
    COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started') AS "quote_starts",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.draft_created') AS "draft_quotes",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.finalized') AS "finalized_leads",
    COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'payment.completed') AS "paid_customers"
  FROM "analytics_events"
  GROUP BY COALESCE("landing_path", '/'), COALESCE("utm_source", 'direct'), COALESCE("utm_campaign", "utm_id", 'none')
)
SELECT
  sessions."landing_path",
  sessions."source",
  sessions."campaign",
  sessions."sessions",
  COALESCE(events."quote_starts", 0) AS "quote_starts",
  COALESCE(events."draft_quotes", 0) AS "draft_quotes",
  COALESCE(events."finalized_leads", 0) AS "finalized_leads",
  COALESCE(events."paid_customers", 0) AS "paid_customers",
  (COALESCE(events."quote_starts", 0)::decimal / NULLIF(sessions."sessions", 0)) AS "quote_start_rate",
  (COALESCE(events."draft_quotes", 0)::decimal / NULLIF(events."quote_starts", 0)) AS "draft_rate",
  (COALESCE(events."paid_customers", 0)::decimal / NULLIF(events."quote_starts", 0)) AS "paid_conversion_rate"
FROM sessions
LEFT JOIN events
  ON events."landing_path" = sessions."landing_path"
  AND events."source" = sessions."source"
  AND events."campaign" = sessions."campaign";

CREATE OR REPLACE VIEW "quote_dropoff_sessions" AS
WITH ranked AS (
  SELECT
    e.*,
    CASE e."event_name"
      WHEN 'quote.started' THEN 10
      WHEN 'quote.address_selected' THEN 20
      WHEN 'quote.service_area_checked' THEN 30
      WHEN 'quote.map_loaded' THEN 40
      WHEN 'quote.summary_viewed' THEN 50
      WHEN 'quote.draft_created' THEN 60
      WHEN 'quote.finalized' THEN 70
      WHEN 'quote.admin_approved' THEN 80
      WHEN 'payment.completed' THEN 90
      ELSE 0
    END AS "step_rank"
  FROM "analytics_events" e
  WHERE e."event_name" LIKE 'quote.%' OR e."event_name" = 'payment.completed'
),
last_step AS (
  SELECT DISTINCT ON ("session_id")
    "session_id",
    "anonymous_id",
    "event_name" AS "last_step",
    "step_rank",
    "created_at" AS "last_step_at",
    "landing_path",
    "utm_source",
    "utm_campaign",
    "google_campaign_id",
    "device_type",
    "browser"
  FROM ranked
  WHERE "session_id" IS NOT NULL
  ORDER BY "session_id", "step_rank" DESC, "created_at" DESC
)
SELECT
  last_step.*,
  EXTRACT(EPOCH FROM (s."last_seen_at" - s."started_at"))::int AS "time_spent_seconds",
  CASE
    WHEN "step_rank" < 20 THEN 'address'
    WHEN "step_rank" < 40 THEN 'service_area'
    WHEN "step_rank" < 50 THEN 'map'
    WHEN "step_rank" < 60 THEN 'summary'
    WHEN "step_rank" < 70 THEN 'draft_contact'
    WHEN "step_rank" < 80 THEN 'admin_review'
    WHEN "step_rank" < 90 THEN 'payment'
    ELSE 'paid'
  END AS "dropoff_bucket"
FROM last_step
LEFT JOIN "analytics_sessions" s ON s."id" = last_step."session_id";

CREATE OR REPLACE VIEW "experiment_performance_daily" AS
SELECT
  "created_at"::date AS "date",
  COALESCE(NULLIF("properties_json"->>'experiment_name', ''), 'none') AS "experiment_name",
  COALESCE(NULLIF("properties_json"->>'variant', ''), 'none') AS "variant",
  COUNT(DISTINCT NULLIF("properties_json"->>'exposure_id', '')) AS "exposures",
  COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started') AS "quote_starts",
  COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.summary_viewed') AS "summary_views",
  COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.draft_created') AS "draft_quotes",
  COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.finalized') AS "finalized_leads",
  COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.admin_approved') AS "approved_quotes",
  COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'payment.completed') AS "paid_customers",
  (COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'quote.draft_created'))::decimal
    / NULLIF(COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started'), 0) AS "draft_rate",
  (COUNT(DISTINCT "quote_id") FILTER (WHERE "event_name" = 'payment.completed'))::decimal
    / NULLIF(COUNT(DISTINCT "session_id") FILTER (WHERE "event_name" = 'quote.started'), 0) AS "paid_conversion_rate"
FROM "analytics_events"
WHERE "properties_json" ? 'experiment_name'
   OR "properties_json" ? 'variant'
   OR "properties_json" ? 'exposure_id'
GROUP BY
  "created_at"::date,
  COALESCE(NULLIF("properties_json"->>'experiment_name', ''), 'none'),
  COALESCE(NULLIF("properties_json"->>'variant', ''), 'none');

CREATE OR REPLACE VIEW "geo_demand_summary" AS
SELECT
  NULLIF(TRIM(split_part("address_text", ',', 2)), '') AS "city_candidate",
  "source",
  "status",
  "is_in_service_area_at_capture",
  COUNT(*) AS "request_count",
  AVG("distance_to_nearest_station_m") AS "avg_distance_to_station_m",
  MIN("created_at") AS "first_seen_at",
  MAX("created_at") AS "last_seen_at"
FROM "service_area_requests"
GROUP BY NULLIF(TRIM(split_part("address_text", ',', 2)), ''), "source", "status", "is_in_service_area_at_capture";

CREATE OR REPLACE VIEW "lead_quality_summary" AS
SELECT
  COALESCE(at."utm_source", 'direct') AS "source",
  COALESCE(at."utm_campaign", 'none') AS "campaign",
  CASE
    WHEN q."per_session_total" < 60 THEN 'under_60'
    WHEN q."per_session_total" < 90 THEN '60_90'
    WHEN q."per_session_total" < 130 THEN '90_130'
    ELSE '130_plus'
  END AS "quote_value_bucket",
  CASE
    WHEN q."area_m2" < 200 THEN 'small'
    WHEN q."area_m2" < 500 THEN 'medium'
    WHEN q."area_m2" < 1000 THEN 'large'
    ELSE 'estate'
  END AS "property_size_bucket",
  COUNT(*) AS "quote_count",
  COUNT(*) FILTER (WHERE q."status" = 'verified') AS "approved_count",
  COUNT(*) FILTER (WHERE q."status" = 'rejected') AS "rejected_count",
  COUNT(*) FILTER (WHERE pl."status" IN ('paid', 'subscription_active')) AS "paid_count",
  AVG(q."per_session_total") AS "avg_per_session_total",
  AVG(q."area_m2") AS "avg_area_m2"
FROM "quotes" q
LEFT JOIN "attribution_touches" at ON at."quote_id" = q."id" AND at."touch_type" = 'submit_snapshot'
LEFT JOIN LATERAL (
  SELECT "status"
  FROM "quote_payment_links"
  WHERE "quote_id" = q."id"
  ORDER BY "created_at" DESC
  LIMIT 1
) pl ON true
GROUP BY
  COALESCE(at."utm_source", 'direct'),
  COALESCE(at."utm_campaign", 'none'),
  CASE
    WHEN q."per_session_total" < 60 THEN 'under_60'
    WHEN q."per_session_total" < 90 THEN '60_90'
    WHEN q."per_session_total" < 130 THEN '90_130'
    ELSE '130_plus'
  END,
  CASE
    WHEN q."area_m2" < 200 THEN 'small'
    WHEN q."area_m2" < 500 THEN 'medium'
    WHEN q."area_m2" < 1000 THEN 'large'
    ELSE 'estate'
  END;

CREATE OR REPLACE VIEW "paid_customer_attribution" AS
SELECT
  q."public_quote_id",
  q."created_at" AS "quote_created_at",
  q."submitted_at",
  q."verified_at",
  q."address_text",
  lead."primary_name",
  lead."primary_email",
  lead."primary_phone",
  q."billing_mode",
  q."per_session_total",
  q."seasonal_total_max",
  q."area_m2",
  q."perimeter_m",
  pl."mode" AS "payment_mode",
  pl."status" AS "payment_status",
  pl."paid_at",
  ft."utm_source" AS "first_touch_source",
  ft."utm_campaign" AS "first_touch_campaign",
  lt."utm_source" AS "last_touch_source",
  lt."utm_campaign" AS "last_touch_campaign",
  ss."utm_source" AS "submit_source",
  ss."utm_campaign" AS "submit_campaign",
  ae."google_campaign_id",
  ae."google_ad_group_id",
  ae."google_ad_id",
  ae."gclid"
FROM "quotes" q
INNER JOIN "leads" lead ON lead."id" = q."lead_id"
INNER JOIN LATERAL (
  SELECT *
  FROM "quote_payment_links"
  WHERE "quote_id" = q."id"
    AND "status" IN ('paid', 'subscription_active')
  ORDER BY "paid_at" DESC NULLS LAST, "updated_at" DESC
  LIMIT 1
) pl ON true
LEFT JOIN "attribution_touches" ft ON ft."lead_id" = q."lead_id" AND ft."touch_type" = 'first_touch'
LEFT JOIN "attribution_touches" lt ON lt."lead_id" = q."lead_id" AND lt."touch_type" = 'last_touch'
LEFT JOIN "attribution_touches" ss ON ss."quote_id" = q."id" AND ss."touch_type" = 'submit_snapshot'
LEFT JOIN LATERAL (
  SELECT *
  FROM "analytics_events"
  WHERE "quote_id" = q."public_quote_id"
    AND "event_name" IN ('quote.draft_created', 'quote.finalized', 'payment.completed')
  ORDER BY "created_at" DESC
  LIMIT 1
) ae ON true;
