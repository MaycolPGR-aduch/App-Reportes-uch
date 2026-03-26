CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS campus_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(40) UNIQUE,
  priority INTEGER NOT NULL DEFAULT 100,
  polygon_geojson JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_campus_zones_active_priority
  ON campus_zones (is_active, priority);

ALTER TABLE IF EXISTS incident_locations
ADD COLUMN IF NOT EXISTS resolved_zone_id UUID REFERENCES campus_zones(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS incident_locations
ADD COLUMN IF NOT EXISTS resolved_zone_name VARCHAR(120);

ALTER TABLE IF EXISTS incident_locations
ADD COLUMN IF NOT EXISTS location_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE IF EXISTS incident_locations
ADD COLUMN IF NOT EXISTS location_confidence DOUBLE PRECISION;

ALTER TABLE IF EXISTS incident_locations
DROP CONSTRAINT IF EXISTS chk_incident_locations_location_confidence;

ALTER TABLE IF EXISTS incident_locations
ADD CONSTRAINT chk_incident_locations_location_confidence
CHECK (location_confidence IS NULL OR (location_confidence >= 0 AND location_confidence <= 1));

CREATE INDEX IF NOT EXISTS ix_incident_locations_zone_status
  ON incident_locations (resolved_zone_name, location_status);

UPDATE incident_locations
SET location_status = COALESCE(NULLIF(location_status, ''), 'UNKNOWN')
WHERE location_status IS NULL OR location_status = '';
