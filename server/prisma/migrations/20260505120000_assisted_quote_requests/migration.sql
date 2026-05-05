DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'QuoteOrigin'
  ) THEN
    CREATE TYPE "QuoteOrigin" AS ENUM ('instant_tool', 'admin_generated', 'assisted_request');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'QuoteRequestStatus'
  ) THEN
    CREATE TYPE "QuoteRequestStatus" AS ENUM ('requested', 'in_progress', 'quoted', 'canceled');
  END IF;
END $$;

ALTER TYPE "IdempotencyScope" ADD VALUE IF NOT EXISTS 'quote_request';

CREATE TABLE IF NOT EXISTS "quote_requests" (
  "id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "auth_user_id" VARCHAR(255) NOT NULL,
  "address_text" VARCHAR(300) NOT NULL,
  "location_geog" geography(Point,4326) NOT NULL,
  "status" "QuoteRequestStatus" NOT NULL DEFAULT 'requested',
  "assigned_to" VARCHAR(128),
  "quoted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_requests_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "quote_requests_auth_user_id_created_at_idx"
  ON "quote_requests"("auth_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "quote_requests_status_created_at_idx"
  ON "quote_requests"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "quote_requests_created_at_idx"
  ON "quote_requests"("created_at" DESC);

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "origin" "QuoteOrigin" NOT NULL DEFAULT 'instant_tool',
  ADD COLUMN IF NOT EXISTS "assisted_request_id" TEXT;

UPDATE "quotes"
SET "origin" = 'admin_generated'::"QuoteOrigin"
WHERE "auth_user_id" IS NULL
  AND "status" = 'verified'
  AND "contact_pending" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_assisted_request_id_key"
  ON "quotes"("assisted_request_id");

CREATE INDEX IF NOT EXISTS "quotes_origin_created_at_idx"
  ON "quotes"("origin", "created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_assisted_request_id_fkey'
  ) THEN
    ALTER TABLE "quotes"
      ADD CONSTRAINT "quotes_assisted_request_id_fkey"
      FOREIGN KEY ("assisted_request_id") REFERENCES "quote_requests"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
