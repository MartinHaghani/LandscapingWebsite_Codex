CREATE TYPE "ServiceFrequency" AS ENUM ('weekly', 'biweekly');

ALTER TABLE "quotes"
  ADD COLUMN "service_frequency" "ServiceFrequency" NOT NULL DEFAULT 'weekly',
  ADD COLUMN "sessions_min" INTEGER NOT NULL DEFAULT 26,
  ADD COLUMN "sessions_max" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "per_session_total" NUMERIC(14,2),
  ADD COLUMN "seasonal_total_min" NUMERIC(14,2),
  ADD COLUMN "seasonal_total_max" NUMERIC(14,2);

UPDATE "quotes"
SET
  "per_session_total" = COALESCE("final_total", 0),
  "seasonal_total_min" = ROUND(COALESCE("final_total", 0) * "sessions_min", 2),
  "seasonal_total_max" = ROUND(COALESCE("final_total", 0) * "sessions_max", 2);

ALTER TABLE "quotes"
  ALTER COLUMN "per_session_total" SET NOT NULL,
  ALTER COLUMN "seasonal_total_min" SET NOT NULL,
  ALTER COLUMN "seasonal_total_max" SET NOT NULL;

ALTER TABLE "quote_versions"
  ADD COLUMN "service_frequency" "ServiceFrequency" NOT NULL DEFAULT 'weekly',
  ADD COLUMN "sessions_min" INTEGER NOT NULL DEFAULT 26,
  ADD COLUMN "sessions_max" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "per_session_total" NUMERIC(14,2),
  ADD COLUMN "seasonal_total_min" NUMERIC(14,2),
  ADD COLUMN "seasonal_total_max" NUMERIC(14,2);

UPDATE "quote_versions"
SET
  "per_session_total" = COALESCE("final_total", 0),
  "seasonal_total_min" = ROUND(COALESCE("final_total", 0) * "sessions_min", 2),
  "seasonal_total_max" = ROUND(COALESCE("final_total", 0) * "sessions_max", 2);

ALTER TABLE "quote_versions"
  ALTER COLUMN "per_session_total" SET NOT NULL,
  ALTER COLUMN "seasonal_total_min" SET NOT NULL,
  ALTER COLUMN "seasonal_total_max" SET NOT NULL;

CREATE INDEX "quotes_service_frequency_idx" ON "quotes" ("service_frequency");
