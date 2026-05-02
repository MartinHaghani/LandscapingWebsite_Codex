ALTER TYPE "LeadContactChannel" ADD VALUE IF NOT EXISTS 'quote_claim';

ALTER TABLE "quotes"
  ADD COLUMN "global_discount_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "price_override_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "override_base_per_session_total" DECIMAL(14,2);

ALTER TABLE "quote_versions"
  ADD COLUMN "global_discount_rate" DECIMAL(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN "seasonal_discount_rate" DECIMAL(6,4) NOT NULL DEFAULT 0.2,
  ADD COLUMN "price_override_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "override_base_per_session_total" DECIMAL(14,2);

CREATE TABLE "quote_id_reservations" (
  "quote_id" VARCHAR(32) PRIMARY KEY,
  "reserved_by" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_quote_id" VARCHAR(128),
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "quote_id_reservations_expires_at_idx" ON "quote_id_reservations"("expires_at");
CREATE INDEX "quote_id_reservations_consumed_quote_id_idx" ON "quote_id_reservations"("consumed_quote_id");
