DO $$
BEGIN
  CREATE TYPE "BillingMode" AS ENUM ('seasonal', 'per_session');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "billing_mode" "BillingMode" NOT NULL DEFAULT 'seasonal',
  ADD COLUMN IF NOT EXISTS "seasonal_discount_rate" DECIMAL(6, 4) NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "distance_to_nearest_station_km" DECIMAL(14, 3) NOT NULL DEFAULT 0;

ALTER TABLE "quotes"
  ALTER COLUMN "sessions_max" SET DEFAULT 26;

ALTER TABLE "quote_versions"
  ALTER COLUMN "sessions_max" SET DEFAULT 26;
