ALTER TYPE "CustomerStatus" ADD VALUE IF NOT EXISTS 'awaiting_payment';

CREATE TYPE "QuoteVersionActorType" AS ENUM ('client', 'admin');

ALTER TABLE "quote_versions"
  ADD COLUMN "actor_type" "QuoteVersionActorType" NOT NULL DEFAULT 'client';

UPDATE "quote_versions"
SET "actor_type" = 'admin'
WHERE "change_type" IN ('admin_revision', 'pricing_override', 'verification');

UPDATE "quotes"
SET
  "status" = 'in_review',
  "customer_status" = 'pending',
  "updated_at" = now()
WHERE "status" = 'submitted';
