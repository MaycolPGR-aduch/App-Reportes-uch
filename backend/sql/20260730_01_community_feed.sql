-- Community feed is opt-in. Existing and anonymous incidents remain private.
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS community_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_community_visible BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_incidents_community_feed
  ON incidents (is_community_visible, created_at);

CREATE TABLE IF NOT EXISTS community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_reactions_incident_user UNIQUE (incident_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_community_reactions_incident_id
  ON community_reactions (incident_id);
