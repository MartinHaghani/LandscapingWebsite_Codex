UPDATE "quotes"
SET
  "service_frequency" = 'weekly',
  "sessions_min" = 20,
  "sessions_max" = 20,
  "seasonal_total_min" = ROUND("per_session_total" * 20, 2),
  "seasonal_total_max" = ROUND("per_session_total" * 20, 2);

UPDATE "quote_versions"
SET
  "service_frequency" = 'weekly',
  "sessions_min" = 20,
  "sessions_max" = 20,
  "seasonal_total_min" = ROUND("per_session_total" * 20, 2),
  "seasonal_total_max" = ROUND("per_session_total" * 20, 2);

ALTER TABLE "quotes" ALTER COLUMN "sessions_min" SET DEFAULT 20;
ALTER TABLE "quotes" ALTER COLUMN "sessions_max" SET DEFAULT 20;
ALTER TABLE "quote_versions" ALTER COLUMN "sessions_min" SET DEFAULT 20;
ALTER TABLE "quote_versions" ALTER COLUMN "sessions_max" SET DEFAULT 20;

ALTER TYPE "ServiceFrequency" RENAME TO "ServiceFrequency_old";
CREATE TYPE "ServiceFrequency" AS ENUM ('weekly');

ALTER TABLE "quotes" ALTER COLUMN "service_frequency" DROP DEFAULT;
ALTER TABLE "quote_versions" ALTER COLUMN "service_frequency" DROP DEFAULT;

ALTER TABLE "quotes"
  ALTER COLUMN "service_frequency" TYPE "ServiceFrequency"
  USING "service_frequency"::text::"ServiceFrequency";

ALTER TABLE "quote_versions"
  ALTER COLUMN "service_frequency" TYPE "ServiceFrequency"
  USING "service_frequency"::text::"ServiceFrequency";

ALTER TABLE "quotes" ALTER COLUMN "service_frequency" SET DEFAULT 'weekly';
ALTER TABLE "quote_versions" ALTER COLUMN "service_frequency" SET DEFAULT 'weekly';

DROP TYPE "ServiceFrequency_old";
