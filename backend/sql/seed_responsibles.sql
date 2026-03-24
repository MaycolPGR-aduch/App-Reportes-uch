-- Seed baseline operational responsibles for automatic assignment and notifications.
INSERT INTO responsibles (full_name, area_name, email, category, min_priority, is_active)
VALUES
  ('Equipo Infraestructura', 'Mantenimiento', 'mantenimiento@campus.edu', 'INFRASTRUCTURE', 'LOW', TRUE),
  ('Equipo Seguridad', 'Seguridad', 'seguridad@campus.edu', 'SECURITY', 'LOW', TRUE),
  ('Equipo Limpieza', 'Limpieza', 'limpieza@campus.edu', 'CLEANING', 'LOW', TRUE)
ON CONFLICT (email, category) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  area_name = EXCLUDED.area_name,
  min_priority = EXCLUDED.min_priority,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
