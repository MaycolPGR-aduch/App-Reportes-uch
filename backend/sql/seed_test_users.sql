-- Seed users for local testing (MVP).
-- Passwords (plain text):
--   uadmin01  -> Admin12345!
--   ustudent01 -> Campus12345!
--   usec01 -> Seguridad123!
--   uclean01 -> Limpieza123!

INSERT INTO users (campus_id, full_name, email, password_hash, role, status)
VALUES
(
  'uadmin01',
  'Admin Campus',
  'admin@campus.edu',
  'pbkdf2_sha256$100000$ddd0a317156af2050f445f2a82d39f07$27f49546cc2fe61cfe215f7d6945910b4f9102dab3201d61702edc248eec8c0e',
  'ADMIN',
  'ACTIVE'
),
(
  'ustudent01',
  'Estudiante Demo',
  'estudiante@campus.edu',
  'pbkdf2_sha256$100000$a28c3f24bfb3da2fad9c8a789b9619cf$0f034cb40e9963b164bd14f36f263110bceb02e047070885d0fc1bf9aa0fadc4',
  'STUDENT',
  'ACTIVE'
),
(
  'usec01',
  'Operador Seguridad',
  'seguridad@campus.edu',
  'pbkdf2_sha256$100000$a0978b5d2b3c1a4d4ad55175d69098e9$e26a0ce1bd254d795f8057d504c85ab6c9a9b63e0f6b6877d7e039585066a9ef',
  'STAFF',
  'ACTIVE'
),
(
  'uclean01',
  'Operador Limpieza',
  'limpieza@campus.edu',
  'pbkdf2_sha256$100000$52ddc0dbb780a61326f8505420fb6045$b2e5d229dc8b1a69e46443643b21cb2519643251a3cf0b747a35a02a70568cde',
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

