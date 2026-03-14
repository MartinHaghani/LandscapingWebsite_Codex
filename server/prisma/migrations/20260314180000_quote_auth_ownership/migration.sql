ALTER TABLE "quotes"
  ADD COLUMN "auth_user_id" VARCHAR(255);

CREATE INDEX "quotes_auth_user_id_created_at_idx"
  ON "quotes"("auth_user_id", "created_at" DESC);
