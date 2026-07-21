-- Apply with the application role after the previous MVP migrations.
-- Existing deployments: run this once, then record it in your migration ledger.

ALTER TABLE incidents ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_reporter_id_fkey;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL;

UPDATE incidents
SET reporter_id = NULL, created_by = 'anonymous'
WHERE reporter_id IN (SELECT id FROM users WHERE campus_id = '__anonymous__');

ALTER TABLE responsibles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
UPDATE responsibles r SET user_id = u.id
FROM users u
WHERE lower(r.email) = lower(u.email) AND u.role = 'STAFF' AND r.user_id IS NULL;
CREATE INDEX IF NOT EXISTS ix_responsibles_user_id ON responsibles(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  scope VARCHAR(80) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, identifier)
);

CREATE TABLE IF NOT EXISTS account_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(32) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_account_tokens_token_hash ON account_tokens(token_hash);
CREATE INDEX IF NOT EXISTS ix_account_tokens_user_purpose ON account_tokens(user_id, purpose);

ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_event_key
  ON notifications(event_key) WHERE event_key IS NOT NULL;
