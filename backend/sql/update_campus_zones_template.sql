-- Plantilla para ACTUALIZAR zonas existentes en campus_zones.
-- No inserta nuevas zonas: solo actualiza por code.
-- Reemplaza coordenadas por valores reales en formato [lng, lat].
-- Cada poligono debe cerrar repitiendo el primer punto al final.

BEGIN;

-- Pabellon A
UPDATE campus_zones
SET
  name = 'Pabellon A',
  priority = 500,
  polygon_geojson = '{
    "type": "Polygon",
    "coordinates": [[
      [-77.084900, -12.056000],
      [-77.084500, -12.056000],
      [-77.084500, -12.055700],
      [-77.084900, -12.055700],
      [-77.084900, -12.056000]
    ]]
  }'::jsonb,
  is_active = TRUE,
  updated_at = NOW()
WHERE code = 'PAB_A';

-- Pabellon B
UPDATE campus_zones
SET
  name = 'Pabellon B',
  priority = 500,
  polygon_geojson = '{
    "type": "Polygon",
    "coordinates": [[
      [-77.084400, -12.056000],
      [-77.084000, -12.056000],
      [-77.084000, -12.055700],
      [-77.084400, -12.055700],
      [-77.084400, -12.056000]
    ]]
  }'::jsonb,
  is_active = TRUE,
  updated_at = NOW()
WHERE code = 'PAB_B';

-- Patio Central
UPDATE campus_zones
SET
  name = 'Patio Central',
  priority = 300,
  polygon_geojson = '{
    "type": "Polygon",
    "coordinates": [[
      [-77.084900, -12.055650],
      [-77.084000, -12.055650],
      [-77.084000, -12.055250],
      [-77.084900, -12.055250],
      [-77.084900, -12.055650]
    ]]
  }'::jsonb,
  is_active = TRUE,
  updated_at = NOW()
WHERE code = 'PATIO';

-- Salida Principal
UPDATE campus_zones
SET
  name = 'Salida Principal',
  priority = 200,
  polygon_geojson = '{
    "type": "Polygon",
    "coordinates": [[
      [-77.085100, -12.055450],
      [-77.084900, -12.055450],
      [-77.084900, -12.055150],
      [-77.085100, -12.055150],
      [-77.085100, -12.055450]
    ]]
  }'::jsonb,
  is_active = TRUE,
  updated_at = NOW()
WHERE code = 'SALIDA_PRINCIPAL';

COMMIT;

-- Verificacion opcional:
-- SELECT code, name, priority, is_active, updated_at FROM campus_zones ORDER BY code;
-- Nota para el futuro, ejeuctar cuando las coordendas de los poligonos esten listas.

