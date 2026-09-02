-- Cada vez que una persona confirma o corrige la clasificacion de una
-- incidencia.
--
-- Es la medicion del estudio. Junto a `incidents.reported_category` y al
-- `ai_metrics` de la propuesta, permite reconstruir las tres versiones de cada
-- caso: que dijo quien reporto, que propuso la IA y que decidio quien modera.
--
-- No cabe en `moderation_decisions`, que registra solo visibilidad: alli la
-- decision es un booleano, aqui son campos con valor previo y valor final.

CREATE TABLE IF NOT EXISTS triage_decisions (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,

  -- La cuenta puede eliminarse; la decision debe sobrevivir, con el nombre ya
  -- copiado para que la fila se sostenga por si sola.
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_label VARCHAR(160) NOT NULL,

  -- Copiado de la incidencia: fija bajo que regimen se tomo esta decision.
  governance_mode governance_mode NOT NULL,

  -- Lo que proponia la IA. NULL en modo manual, y esa ausencia es el dato:
  -- no hubo propuesta que aceptar ni que corregir.
  ai_suggested_category incident_category,
  ai_suggested_priority priority_level,
  ai_confidence NUMERIC(4,3),

  -- Lo que decidio la persona.
  final_category incident_category NOT NULL,
  final_priority priority_level NOT NULL,
  assigned_responsible_id UUID REFERENCES responsibles(id) ON DELETE SET NULL,

  reason VARCHAR(300),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconstruir el historial de una incidencia.
CREATE INDEX IF NOT EXISTS ix_triage_decisions_incident_created
  ON triage_decisions (incident_id, created_at);

-- Separar los brazos y recorrer por fecha: la consulta de todo el analisis.
CREATE INDEX IF NOT EXISTS ix_triage_decisions_mode_created
  ON triage_decisions (governance_mode, created_at);
