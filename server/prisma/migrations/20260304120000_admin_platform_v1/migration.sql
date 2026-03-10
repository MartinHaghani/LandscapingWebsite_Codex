-- Enable PostGIS for geography/geometry storage and spatial indexes.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "LeadContactChannel" AS ENUM ('quote_finalize', 'contact_form');
CREATE TYPE "LocationSource" AS ENUM ('address_geocode', 'polygon_centroid_fallback');
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'submitted', 'in_review', 'verified', 'rejected');
CREATE TYPE "CustomerStatus" AS ENUM ('pending', 'updated', 'verified', 'rejected');
CREATE TYPE "QuoteVersionChangeType" AS ENUM ('initial', 'admin_revision', 'pricing_override', 'verification');
CREATE TYPE "ServiceAreaRequestSource" AS ENUM ('out_of_area_page', 'coverage_checker', 'instant_quote', 'contact_form');
CREATE TYPE "ServiceAreaRequestStatus" AS ENUM ('open', 'reviewed', 'planned', 'rejected');
CREATE TYPE "AttributionTouchType" AS ENUM ('first_touch', 'last_touch', 'session_touch', 'submit_snapshot');
CREATE TYPE "AuditActorRole" AS ENUM ('OWNER', 'ADMIN', 'REVIEWER', 'MARKETING', 'SYSTEM');
CREATE TYPE "IdempotencyScope" AS ENUM ('quote_draft', 'quote_contact', 'service_area_request', 'contact_submit');

CREATE TABLE "leads" (
  "id" TEXT PRIMARY KEY,
  "primary_name" VARCHAR(120),
  "primary_email" VARCHAR(160),
  "primary_phone" VARCHAR(40),
  "consent_marketing" BOOLEAN NOT NULL DEFAULT false,
  "external_ids" JSONB,
  "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "lead_contacts" (
  "id" TEXT PRIMARY KEY,
  "lead_id" TEXT NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "channel" "LeadContactChannel" NOT NULL,
  "name" VARCHAR(120),
  "email" VARCHAR(160),
  "phone" VARCHAR(40),
  "address_text" VARCHAR(300),
  "message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "quotes" (
  "id" TEXT PRIMARY KEY,
  "public_quote_id" VARCHAR(32) NOT NULL UNIQUE,
  "lead_id" TEXT NOT NULL REFERENCES "leads"("id") ON DELETE RESTRICT,
  "address_text" VARCHAR(300) NOT NULL,
  "location_geog" geography(Point, 4326),
  "location_source" "LocationSource" NOT NULL DEFAULT 'address_geocode',
  "polygon_geom" geometry(MultiPolygon, 4326) NOT NULL,
  "polygon_source_json" JSONB,
  "polygon_centroid_geog" geography(Point, 4326),
  "area_m2" NUMERIC(14,2) NOT NULL,
  "perimeter_m" NUMERIC(14,2) NOT NULL,
  "recommended_plan" VARCHAR(120) NOT NULL,
  "pricing_version" VARCHAR(40) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'CAD',
  "base_total" NUMERIC(14,2) NOT NULL,
  "final_total" NUMERIC(14,2) NOT NULL,
  "override_amount" NUMERIC(14,2),
  "override_reason" TEXT,
  "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
  "customer_status" "CustomerStatus" NOT NULL DEFAULT 'pending',
  "contact_pending" BOOLEAN NOT NULL DEFAULT true,
  "assigned_to" VARCHAR(128),
  "team_id" VARCHAR(128),
  "submitted_at" TIMESTAMPTZ,
  "verified_at" TIMESTAMPTZ,
  "verified_by" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "quote_versions" (
  "id" TEXT PRIMARY KEY,
  "quote_id" TEXT NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "change_type" "QuoteVersionChangeType" NOT NULL,
  "polygon_geom" geometry(MultiPolygon, 4326) NOT NULL,
  "polygon_source_json" JSONB,
  "polygon_centroid_geog" geography(Point, 4326),
  "area_m2" NUMERIC(14,2) NOT NULL,
  "perimeter_m" NUMERIC(14,2) NOT NULL,
  "recommended_plan" VARCHAR(120) NOT NULL,
  "base_total" NUMERIC(14,2) NOT NULL,
  "final_total" NUMERIC(14,2) NOT NULL,
  "override_amount" NUMERIC(14,2),
  "override_reason" TEXT,
  "changed_by" VARCHAR(128) NOT NULL,
  "changed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "quote_versions_quote_id_version_number_key" UNIQUE ("quote_id", "version_number")
);

CREATE TABLE "quote_notes" (
  "id" TEXT PRIMARY KEY,
  "quote_id" TEXT NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "note" TEXT NOT NULL,
  "created_by" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "service_area_requests" (
  "id" TEXT PRIMARY KEY,
  "lead_id" TEXT REFERENCES "leads"("id") ON DELETE SET NULL,
  "address_text" VARCHAR(300) NOT NULL,
  "location_geog" geography(Point, 4326) NOT NULL,
  "is_in_service_area_at_capture" BOOLEAN NOT NULL,
  "distance_to_nearest_station_m" NUMERIC(14,2) NOT NULL,
  "source" "ServiceAreaRequestSource" NOT NULL,
  "status" "ServiceAreaRequestStatus" NOT NULL DEFAULT 'open',
  "idempotency_key" VARCHAR(120) NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "attribution_touches" (
  "id" TEXT PRIMARY KEY,
  "lead_id" TEXT REFERENCES "leads"("id") ON DELETE SET NULL,
  "quote_id" TEXT REFERENCES "quotes"("id") ON DELETE SET NULL,
  "touch_type" "AttributionTouchType" NOT NULL,
  "gclid" VARCHAR(120),
  "gbraid" VARCHAR(120),
  "wbraid" VARCHAR(120),
  "utm_source" VARCHAR(160),
  "utm_medium" VARCHAR(160),
  "utm_campaign" VARCHAR(200),
  "utm_term" VARCHAR(200),
  "utm_content" VARCHAR(200),
  "landing_path" VARCHAR(300),
  "referrer" VARCHAR(500),
  "device_type" VARCHAR(40),
  "browser" VARCHAR(80),
  "geo_city" VARCHAR(120),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY,
  "actor_user_id" VARCHAR(128),
  "actor_role" "AuditActorRole" NOT NULL DEFAULT 'SYSTEM',
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(128) NOT NULL,
  "changed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "before_redacted" JSONB,
  "after_redacted" JSONB,
  "before_full" JSONB,
  "after_full" JSONB,
  "request_id" VARCHAR(120),
  "correlation_id" VARCHAR(120),
  "ip_hash" VARCHAR(128),
  "user_agent" VARCHAR(300),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "base_stations" (
  "id" TEXT PRIMARY KEY,
  "internal_label" VARCHAR(120) NOT NULL UNIQUE,
  "internal_address" VARCHAR(300) NOT NULL,
  "location_geog" geography(Point, 4326) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "idempotency_records" (
  "id" TEXT PRIMARY KEY,
  "scope" "IdempotencyScope" NOT NULL,
  "idempotency_key" VARCHAR(120) NOT NULL,
  "request_hash" VARCHAR(128) NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_json" JSONB NOT NULL,
  "response_hash" VARCHAR(128) NOT NULL,
  "resource_type" VARCHAR(80),
  "resource_id" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "idempotency_records_scope_idempotency_key_key" UNIQUE ("scope", "idempotency_key")
);

CREATE INDEX "leads_created_at_idx" ON "leads" ("created_at" DESC);
CREATE INDEX "lead_contacts_lead_id_created_at_idx" ON "lead_contacts" ("lead_id", "created_at" DESC);
CREATE INDEX "quotes_submitted_at_idx" ON "quotes" ("submitted_at" DESC);
CREATE INDEX "quotes_status_submitted_at_idx" ON "quotes" ("status", "submitted_at" DESC);
CREATE INDEX "quotes_created_at_idx" ON "quotes" ("created_at" DESC);
CREATE INDEX "quote_versions_quote_id_changed_at_idx" ON "quote_versions" ("quote_id", "changed_at" DESC);
CREATE INDEX "quote_notes_quote_id_created_at_idx" ON "quote_notes" ("quote_id", "created_at" DESC);
CREATE INDEX "service_area_requests_created_at_idx" ON "service_area_requests" ("created_at" DESC);
CREATE INDEX "attribution_touches_created_at_idx" ON "attribution_touches" ("created_at" DESC);
CREATE INDEX "attribution_touches_gclid_idx" ON "attribution_touches" ("gclid");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at" DESC);
CREATE INDEX "audit_logs_entity_created_at_idx" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC);
CREATE INDEX "idempotency_records_created_at_idx" ON "idempotency_records" ("created_at" DESC);
CREATE INDEX "base_stations_active_idx" ON "base_stations" ("active");

CREATE INDEX "quotes_location_geog_gix" ON "quotes" USING GIST ("location_geog");
CREATE INDEX "quotes_polygon_geom_gix" ON "quotes" USING GIST ("polygon_geom");
CREATE INDEX "service_area_requests_location_geog_gix" ON "service_area_requests" USING GIST ("location_geog");
CREATE INDEX "base_stations_location_geog_gix" ON "base_stations" USING GIST ("location_geog");

CREATE UNIQUE INDEX "attribution_one_first_touch_per_lead_idx"
  ON "attribution_touches" ("lead_id")
  WHERE "touch_type" = 'first_touch' AND "lead_id" IS NOT NULL;

CREATE UNIQUE INDEX "attribution_one_last_touch_per_lead_idx"
  ON "attribution_touches" ("lead_id")
  WHERE "touch_type" = 'last_touch' AND "lead_id" IS NOT NULL;

CREATE UNIQUE INDEX "attribution_one_submit_snapshot_per_quote_idx"
  ON "attribution_touches" ("quote_id")
  WHERE "touch_type" = 'submit_snapshot' AND "quote_id" IS NOT NULL;

-- Keep timestamps consistent on updates.
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_leads_updated_at
BEFORE UPDATE ON "leads"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER set_quotes_updated_at
BEFORE UPDATE ON "quotes"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER set_base_stations_updated_at
BEFORE UPDATE ON "base_stations"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
