# Backend MVP - Campus Incidencias

## Ejecutar API

1. Crear `.env` desde `.env.example`.
2. Instalar dependencias:
   `pip install -r requirements.txt`
3. Aplicar esquema SQL:
   `psql "$DATABASE_URL" -f sql/schema.sql`
3.1 Si las tablas fueron creadas por otro usuario y `campus_app` no puede leer/escribir:
   `psql "<ADMIN_DATABASE_URL>" -f sql/grant_permissions.sql`
4. (Opcional) Cargar usuarios de prueba:
   `psql "$DATABASE_URL" -f sql/seed_test_users.sql`
5. Levantar API:
   `uvicorn app.main:app --reload --port 8000`

## Workers

- Clasificacion IA:
  `python -m app.workers.ai_worker`
- Notificaciones correo:
  `python -m app.workers.notification_worker`

## Endpoints MVP

- `POST /api/v1/auth/bootstrap-admin` (solo primera vez, si no existe ADMIN)
- `POST /api/v1/auth/register` (registro publico, crea cuenta STUDENT)
- `POST /api/v1/auth/users` (ADMIN)
- `GET /api/v1/auth/users` (ADMIN)
- `POST /api/v1/auth/login`
- `POST /api/v1/reports` (acepta modo anonimo sin token o modo autenticado con Bearer)
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/{incident_id}`
- `GET /api/v1/incidents/{incident_id}/evidences/{evidence_id}` (descarga evidencia bajo demanda, requiere auth)

## Usuarios de prueba (seed SQL)

Si ejecutaste `sql/seed_test_users.sql`, puedes iniciar sesion con:

- Admin: `uadmin01` / `Admin12345!`
- Estudiante: `ustudent01` / `Campus12345!`
- Staff seguridad: `usec01` / `Seguridad123!`
- Staff limpieza: `uclean01` / `Limpieza123!`

Para crear usuarios via API (solo ADMIN):

`POST /api/v1/auth/users` con `Authorization: Bearer <token_admin>`.

## Troubleshooting CORS

Si ves `No 'Access-Control-Allow-Origin' header`, valida:

1. `backend/.env` tiene:
   `CORS_ORIGINS=http://localhost:3000`
2. Reiniciaste el backend despues de editar `.env`.
3. Frontend en `http://localhost:3000` y API en `http://localhost:8000`.
