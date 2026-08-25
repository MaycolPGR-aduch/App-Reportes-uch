-- Traza de auditoría de la moderación manual de la vista comunitaria.
-- Un administrador puede publicar una incidencia que la IA rechazó, así que
-- debe quedar constancia de quién decidió y contra qué veredicto.

CREATE TABLE IF NOT EXISTS moderation_decisions (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  -- La decisión sobrevive a la baja de la cuenta; actor_label conserva el nombre.
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_label VARCHAR(160) NOT NULL,
  published BOOLEAN NOT NULL,
  reason VARCHAR(300),
  ai_verdict VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_moderation_decisions_incident_created
  ON moderation_decisions (incident_id, created_at);
