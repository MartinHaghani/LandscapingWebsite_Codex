DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ApprovedQuoteEmailTriggerSource'
  ) THEN
    CREATE TYPE "ApprovedQuoteEmailTriggerSource" AS ENUM ('approval', 'manual_resend');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ApprovedQuoteEmailDeliveryStatus'
  ) THEN
    CREATE TYPE "ApprovedQuoteEmailDeliveryStatus" AS ENUM ('sent', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "approved_quote_email_deliveries" (
  "id" VARCHAR(25) NOT NULL,
  "quote_id" VARCHAR(25) NOT NULL,
  "approved_version_number" INTEGER NOT NULL,
  "recipient_email" VARCHAR(160) NOT NULL,
  "trigger_source" "ApprovedQuoteEmailTriggerSource" NOT NULL,
  "delivery_status" "ApprovedQuoteEmailDeliveryStatus" NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_message_id" VARCHAR(191),
  "error_message" TEXT,
  "public_preview_token" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "approved_quote_email_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approved_quote_email_deliveries_quote_id_fkey"
    FOREIGN KEY ("quote_id")
    REFERENCES "quotes"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "approved_quote_email_deliveries_public_preview_token_key"
  ON "approved_quote_email_deliveries"("public_preview_token");

CREATE INDEX IF NOT EXISTS "approved_quote_email_deliveries_quote_id_created_at_idx"
  ON "approved_quote_email_deliveries"("quote_id", "created_at" DESC);
