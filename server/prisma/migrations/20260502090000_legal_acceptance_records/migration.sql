CREATE TYPE "LegalAcceptanceAction" AS ENUM (
  'contact_privacy_ack',
  'complete_profile_terms',
  'quote_submit_terms',
  'quote_claim_terms',
  'payment_checkout_terms'
);

CREATE TABLE "legal_acceptances" (
  "id" TEXT NOT NULL,
  "action" "LegalAcceptanceAction" NOT NULL,
  "document_slugs" TEXT[] NOT NULL,
  "document_version" VARCHAR(40) NOT NULL,
  "lead_id" TEXT,
  "quote_id" TEXT,
  "auth_user_id" VARCHAR(255),
  "email" VARCHAR(160),
  "ip_hash" VARCHAR(128),
  "user_agent" VARCHAR(300),
  "metadata" JSONB,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_acceptances_action_accepted_at_idx" ON "legal_acceptances"("action", "accepted_at" DESC);
CREATE INDEX "legal_acceptances_lead_id_accepted_at_idx" ON "legal_acceptances"("lead_id", "accepted_at" DESC);
CREATE INDEX "legal_acceptances_quote_id_accepted_at_idx" ON "legal_acceptances"("quote_id", "accepted_at" DESC);
CREATE INDEX "legal_acceptances_auth_user_id_accepted_at_idx" ON "legal_acceptances"("auth_user_id", "accepted_at" DESC);

ALTER TABLE "legal_acceptances"
  ADD CONSTRAINT "legal_acceptances_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legal_acceptances"
  ADD CONSTRAINT "legal_acceptances_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
