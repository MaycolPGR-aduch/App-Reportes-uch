-- Generado automaticamente desde CSV exportado de Google My Maps.
-- Origen: UCH- Capa sin nombre.csv
-- Fecha: 2026-03-26
-- Merge robusto: actualiza por code, luego por name, e inserta faltantes.

BEGIN;

CREATE TEMP TABLE tmp_incoming_campus_zones (
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) NOT NULL,
  priority INTEGER NOT NULL,
  polygon_geojson JSONB NOT NULL,
  is_active BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_incoming_campus_zones (name, code, priority, polygon_geojson, is_active)
VALUES
  ('Pabellon A', 'PABELLON_A', 300, '{"type":"Polygon","coordinates":[[[-77.065167,-11.961348],[-77.0652555,-11.9614228],[-77.0652421,-11.961554],[-77.0649243,-11.9615317],[-77.064935,-11.9613257],[-77.065167,-11.961348]]]}'::jsonb, TRUE),
  ('Pabellon B', 'PABELLON_B', 300, '{"type":"Polygon","coordinates":[[[-77.0653132,-11.961079],[-77.065289,-11.961289],[-77.0649953,-11.9612535],[-77.0650235,-11.9610384],[-77.0653132,-11.961079]]]}'::jsonb, TRUE),
  ('Pabellon C', 'PABELLON_C', 300, '{"type":"Polygon","coordinates":[[[-77.0658132,-11.9612943],[-77.0659178,-11.9614281],[-77.0658722,-11.9615121],[-77.0657824,-11.9615607],[-77.0655464,-11.9615948],[-77.0654243,-11.9615712],[-77.0654391,-11.9613927],[-77.0654967,-11.9614124],[-77.0658132,-11.9612943]]]}'::jsonb, TRUE),
  ('Zona de estacionamiento y cohes', 'ZONA_DE_ESTACIONAMIENTO_Y_COHES', 300, '{"type":"Polygon","coordinates":[[[-77.065433,-11.960688],[-77.0657213,-11.9610803],[-77.0655282,-11.9612404],[-77.0651929,-11.9607773],[-77.0652023,-11.960671],[-77.0654102,-11.9606277],[-77.065433,-11.960688]]]}'::jsonb, TRUE),
  ('Cancha de futbol', 'CANCHA_DE_FUTBOL', 300, '{"type":"Polygon","coordinates":[[[-77.0651795,-11.9606959],[-77.065158,-11.9610252],[-77.0649716,-11.9610069],[-77.0649984,-11.9606959],[-77.0651795,-11.9606959]]]}'::jsonb, TRUE),
  ('Patio', 'PATIO', 300, '{"type":"Polygon","coordinates":[[[-77.0654155,-11.9615802],[-77.0652693,-11.9615684],[-77.0652747,-11.9614005],[-77.0651889,-11.961344],[-77.0649716,-11.9613217],[-77.064977,-11.9612876],[-77.0653324,-11.9613126],[-77.0653364,-11.9610397],[-77.0655174,-11.9612561],[-77.0655121,-11.9613782],[-77.0654973,-11.9613939],[-77.0654115,-11.9613729],[-77.0654155,-11.9615802]]]}'::jsonb, TRUE);

-- 1) Actualiza registros existentes por CODE (evita choque de code duplicado).
UPDATE campus_zones AS cz
SET
  name = src.name,
  priority = src.priority,
  polygon_geojson = src.polygon_geojson,
  is_active = src.is_active,
  updated_at = NOW()
FROM tmp_incoming_campus_zones AS src
WHERE cz.code = src.code
  AND (
    cz.name = src.name
    OR NOT EXISTS (
      SELECT 1
      FROM campus_zones other_name
      WHERE other_name.name = src.name
        AND other_name.id <> cz.id
    )
  );

-- 2) Si coincide por NAME y el code nuevo está libre, actualiza code y demás campos.
UPDATE campus_zones AS cz
SET
  code = src.code,
  priority = src.priority,
  polygon_geojson = src.polygon_geojson,
  is_active = src.is_active,
  updated_at = NOW()
FROM tmp_incoming_campus_zones AS src
WHERE cz.name = src.name
  AND cz.code IS DISTINCT FROM src.code
  AND NOT EXISTS (
    SELECT 1
    FROM campus_zones other_code
    WHERE other_code.code = src.code
      AND other_code.id <> cz.id
  );

-- 3) Inserta solo los que no existen ni por NAME ni por CODE.
INSERT INTO campus_zones (name, code, priority, polygon_geojson, is_active)
SELECT
  src.name,
  src.code,
  src.priority,
  src.polygon_geojson,
  src.is_active
FROM tmp_incoming_campus_zones AS src
WHERE NOT EXISTS (
  SELECT 1
  FROM campus_zones cz
  WHERE cz.name = src.name OR cz.code = src.code
);

COMMIT;

-- Verificacion sugerida:
-- SELECT code, name, priority, is_active, updated_at FROM campus_zones ORDER BY name;
