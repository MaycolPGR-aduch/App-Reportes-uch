-- Zonas reales del campus UCH, trazadas en Google My Maps.
--
-- Sustituyen por completo a las anteriores, que eran aproximaciones de marzo.
-- El borrado es seguro: incident_locations.resolved_zone_id tiene ON DELETE
-- SET NULL, y resolved_zone_name conserva el nombre historico de cada
-- incidencia ya resuelta.

BEGIN;

DELETE FROM campus_zones;

INSERT INTO campus_zones (id, name, code, priority, polygon_geojson, is_active)
VALUES
  (gen_random_uuid(), 'Pabellon A', 'PABELLON_A', 100,
   '{"type":"Polygon","coordinates":[[[-77.065167,-11.961348],[-77.0652555,-11.9614228],[-77.0652381,-11.9616117],[-77.0650792,-11.9615953],[-77.0649189,-11.9615632],[-77.064935,-11.9613257],[-77.065167,-11.961348]]]}'::jsonb, true),
  (gen_random_uuid(), 'Pabellon B', 'PABELLON_B', 100,
   '{"type":"Polygon","coordinates":[[[-77.0653132,-11.961079],[-77.065289,-11.961289],[-77.0649953,-11.9612535],[-77.0650235,-11.9610384],[-77.0653132,-11.961079]]]}'::jsonb, true),
  (gen_random_uuid(), 'Pabellon C', 'PABELLON_C', 100,
   '{"type":"Polygon","coordinates":[[[-77.0658132,-11.9612943],[-77.0659178,-11.9614281],[-77.0659849,-11.9615292],[-77.065836,-11.9616237],[-77.0656067,-11.961684],[-77.0655464,-11.9615948],[-77.0654243,-11.9615712],[-77.0654391,-11.9613927],[-77.0654967,-11.9614124],[-77.0658132,-11.9612943]]]}'::jsonb, true),
  (gen_random_uuid(), 'Zona de estacionamiento y coches', 'ZONA_ESTACIONAMIENTO_COCHES', 100,
   '{"type":"Polygon","coordinates":[[[-77.065433,-11.960688],[-77.0657213,-11.9610803],[-77.0655282,-11.9612404],[-77.0651929,-11.9607773],[-77.0652023,-11.960671],[-77.0654102,-11.9606277],[-77.065433,-11.960688]]]}'::jsonb, true),
  (gen_random_uuid(), 'Cancha de futbol', 'CANCHA_FUTBOL', 100,
   '{"type":"Polygon","coordinates":[[[-77.0651795,-11.9606959],[-77.065158,-11.9610252],[-77.0649716,-11.9610069],[-77.0649984,-11.9606959],[-77.0651795,-11.9606959]]]}'::jsonb, true),
  (gen_random_uuid(), 'Patio', 'PATIO', 100,
   '{"type":"Polygon","coordinates":[[[-77.0654155,-11.9615802],[-77.0652693,-11.9615684],[-77.0652747,-11.9614005],[-77.0651889,-11.961344],[-77.0649716,-11.9613217],[-77.064977,-11.9612876],[-77.0653324,-11.9613126],[-77.0653364,-11.9610397],[-77.0655174,-11.9612561],[-77.0655121,-11.9613782],[-77.0654973,-11.9613939],[-77.0654115,-11.9613729],[-77.0654155,-11.9615802]]]}'::jsonb, true);

COMMIT;
