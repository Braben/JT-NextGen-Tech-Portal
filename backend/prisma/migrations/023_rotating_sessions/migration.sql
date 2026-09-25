CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "current_hash" TEXT NOT NULL,
  "expires_at" BIGINT NOT NULL,
  "revoked" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE TABLE "refresh_tokens" (
  "token_hash" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "auth_sessions"("id") ON DELETE CASCADE
);
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");
