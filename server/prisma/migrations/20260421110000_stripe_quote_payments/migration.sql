DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'QuotePaymentMode'
  ) THEN
    CREATE TYPE "QuotePaymentMode" AS ENUM ('seasonal_payment', 'per_session_subscription');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'QuotePaymentStatus'
  ) THEN
    CREATE TYPE "QuotePaymentStatus" AS ENUM (
      'awaiting_payment',
      'checkout_created',
      'paid',
      'subscription_scheduled',
      'subscription_active',
      'past_due',
      'failed',
      'canceled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "quote_payment_links" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "approved_version_number" INTEGER NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "mode" "QuotePaymentMode" NOT NULL,
  "status" "QuotePaymentStatus" NOT NULL DEFAULT 'awaiting_payment',
  "currency" VARCHAR(8) NOT NULL DEFAULT 'CAD',
  "amount_cents" INTEGER NOT NULL,
  "recurring_interval" VARCHAR(20),
  "max_billable_visits" INTEGER,
  "paid_invoice_count" INTEGER NOT NULL DEFAULT 0,
  "paid_invoice_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "season_start_at" TIMESTAMP(3),
  "season_end_at" TIMESTAMP(3),
  "stripe_customer_id" VARCHAR(191),
  "stripe_checkout_session_id" VARCHAR(191),
  "stripe_checkout_url" VARCHAR(2048),
  "stripe_checkout_expires_at" TIMESTAMP(3),
  "stripe_payment_intent_id" VARCHAR(191),
  "stripe_subscription_id" VARCHAR(191),
  "token_revoked_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_payment_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_payment_links_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_payment_links_token_hash_key"
  ON "quote_payment_links"("token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "quote_payment_links_stripe_checkout_session_id_key"
  ON "quote_payment_links"("stripe_checkout_session_id");

CREATE INDEX IF NOT EXISTS "quote_payment_links_quote_id_created_at_idx"
  ON "quote_payment_links"("quote_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "quote_payment_links_status_created_at_idx"
  ON "quote_payment_links"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "quote_payment_links_stripe_subscription_id_idx"
  ON "quote_payment_links"("stripe_subscription_id");

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "id" TEXT NOT NULL,
  "stripe_event_id" VARCHAR(191) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "payload" JSONB,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_webhook_events_stripe_event_id_key"
  ON "stripe_webhook_events"("stripe_event_id");

CREATE INDEX IF NOT EXISTS "stripe_webhook_events_event_type_created_at_idx"
  ON "stripe_webhook_events"("event_type", "created_at" DESC);
