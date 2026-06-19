-- Link local candidate users to Supabase Auth identities.
ALTER TABLE "users" ADD COLUMN "supabase_user_id" TEXT;

CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "users"("supabase_user_id");
CREATE INDEX "users_supabase_user_id_idx" ON "users"("supabase_user_id");
