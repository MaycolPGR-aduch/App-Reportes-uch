-- Historial de cambios de estado de cada incidencia.
--
-- `incidents.status` solo guarda el estado actual y `updated_at` se pisa con
-- cualquier edicion, asi que el momento de la resolucion se perdia. El estudio
-- necesita ese momento para medir el tiempo hasta la resolucion.
--
-- Solo se insertan filas. Las marcas existen desde que se aplica esta
-- migracion: el historial anterior no se puede reconstruir, y no se inventa.

CREATE TABLE IF NOT EXISTS incident_status_events (
  id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  previous_status incident_status,
  status incident_status NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La consulta tipica: la historia de una incidencia, en orden.
CREATE INDEX IF NOT EXISTS ix_incident_status_events_incident_at
  ON incident_status_events (incident_id, at);

-- Y la del analisis: cuando llego cada incidencia a un estado dado.
CREATE INDEX IF NOT EXISTS ix_incident_status_events_status_at
  ON incident_status_events (status, at);
