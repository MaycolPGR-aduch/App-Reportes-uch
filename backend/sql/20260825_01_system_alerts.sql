-- Deduplicacion de los avisos automaticos de salud del sistema.
-- No cuelgan de una incidencia, asi que no caben en notifications.

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY,
  kind VARCHAR(40) NOT NULL,
  detail TEXT,
  sent_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buscar la alerta abierta de un tipo es la consulta de cada revision.
CREATE INDEX IF NOT EXISTS ix_system_alerts_kind_resolved
  ON system_alerts (kind, resolved_at);
