-- Plantilla inicial de zonas del campus.
-- Reemplaza las coordenadas por valores reales de tu universidad (lng, lat).
-- Cada polígono debe cerrar repitiendo el primer punto al final.

INSERT INTO campus_zones (name, code, priority, polygon_geojson, is_active)
VALUES
  (
    'Pabellon A',
    'PAB_A',
    500,
    '{
      "type": "Polygon",
      "coordinates": [[
        [-77.084900, -12.056000],
        [-77.084500, -12.056000],
        [-77.084500, -12.055700],
        [-77.084900, -12.055700],
        [-77.084900, -12.056000]
      ]]
    }'::jsonb,
    TRUE
  ),
  (
    'Pabellon B',
    'PAB_B',
    500,
    '{
      "type": "Polygon",
      "coordinates": [[
        [-77.084400, -12.056000],
        [-77.084000, -12.056000],
        [-77.084000, -12.055700],
        [-77.084400, -12.055700],
        [-77.084400, -12.056000]
      ]]
    }'::jsonb,
    TRUE
  ),
  (
    'Patio Central',
    'PATIO',
    300,
    '{
      "type": "Polygon",
      "coordinates": [[
        [-77.084900, -12.055650],
        [-77.084000, -12.055650],
        [-77.084000, -12.055250],
        [-77.084900, -12.055250],
        [-77.084900, -12.055650]
      ]]
    }'::jsonb,
    TRUE
  ),
  (
    'Salida Principal',
    'SALIDA_PRINCIPAL',
    200,
    '{
      "type": "Polygon",
      "coordinates": [[
        [-77.085100, -12.055450],
        [-77.084900, -12.055450],
        [-77.084900, -12.055150],
        [-77.085100, -12.055150],
        [-77.085100, -12.055450]
      ]]
    }'::jsonb,
    TRUE
  )
ON CONFLICT (name) DO UPDATE
SET
  code = EXCLUDED.code,
  priority = EXCLUDED.priority,
  polygon_geojson = EXCLUDED.polygon_geojson,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

