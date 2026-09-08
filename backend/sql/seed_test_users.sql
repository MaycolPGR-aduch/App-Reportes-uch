-- Usuarios de ejemplo para desarrollo local.
--
-- Este archivo NO trae contrasenas utilizables, y es deliberado: antes incluia
-- los hashes junto a las contrasenas en claro en estos comentarios, de modo que
-- cualquiera que leyera el repositorio --que es publico-- podia entrar como
-- administrador en cualquier instalacion que lo hubiera sembrado.
--
-- Genera tu propio hash antes de usarlo, desde la carpeta backend:
--
--   python -c "from app.core.security import hash_password; print(hash_password('TU-CLAVE'))"
--
-- Sustituye cada PON_AQUI_TU_HASH por el resultado. Usa una contrasena
-- distinta por cuenta y no la compartas fuera de tu maquina.
--
-- NUNCA siembres estos usuarios en una instalacion accesible desde internet:
-- son cuentas de prueba con nombres predecibles. Para produccion, crea un solo
-- administrador con su propia contrasena, como describe GUIA_DESPLIEGUE.md.

INSERT INTO users (campus_id, full_name, email, password_hash, role, status)
VALUES
(
  'uadmin01',
  'Admin Campus',
  'admin@campus.edu',
  'PON_AQUI_TU_HASH',
  'ADMIN',
  'ACTIVE'
),
(
  'ustudent01',
  'Estudiante Demo',
  'estudiante@campus.edu',
  'PON_AQUI_TU_HASH',
  'STUDENT',
  'ACTIVE'
),
(
  'usec01',
  'Operador Seguridad',
  'seguridad@campus.edu',
  'PON_AQUI_TU_HASH',
  'STAFF',
  'ACTIVE'
),
(
  'uclean01',
  'Operador Limpieza',
  'limpieza@campus.edu',
  'PON_AQUI_TU_HASH',
  'STAFF',
  'ACTIVE'
)
ON CONFLICT (campus_id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = NOW();
