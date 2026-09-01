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
4.1 (Opcional, recomendado) Cargar responsables para asignación manual/automática:
   `psql "$DATABASE_URL" -f sql/seed_responsibles.sql`
4.2 Si ya tenías una BD previa, aplica migración de teléfono de staff:
   `psql "$DATABASE_URL" -f sql/20260325_add_phone_to_responsibles.sql`
4.3 Si ya tenías una BD previa, aplica migración de zonas campus + resolución de ubicación:
   `psql "$DATABASE_URL" -f sql/20260326_add_campus_zones_and_location_resolution.sql`
4.4 (Opcional) Cargar plantilla inicial de zonas (edita coordenadas reales antes de ejecutar):
   `psql "$DATABASE_URL" -f sql/seed_campus_zones_template.sql`
4.5 (Opcional) Actualizar zonas existentes por code (sin insertar nuevas):
   `psql "$DATABASE_URL" -f sql/update_campus_zones_template.sql`
5. Levantar API:
   `uvicorn app.main:app --reload --port 8000`

## Arranque rápido desarrollo

Desde `backend/`:

- Iniciar API + workers en un solo comando:
  `.\start-all.ps1`
- Detener todos los procesos lanzados por el script:
  `.\stop-all.ps1`

## Producción (Render)

1. Configura las variables de `backend/.env.example` como secretos de Render; usa
   `APP_ENV=production`, un `JWT_SECRET` aleatorio, `COOKIE_SECURE=true`, orígenes
   CORS explícitos, Turnstile y un Disk montado en `/var/data`.
2. Para una base existente, aplica las migraciones manuales anteriores y ejecuta:
   `alembic -c alembic.ini stamp 20260318_01` seguido de
   `alembic -c alembic.ini upgrade head`.
   En una base nueva basta `alembic -c alembic.ini upgrade head`.
   Si la base ya está en `20260721_01`, basta `alembic -c alembic.ini upgrade head` para aplicar
   `20260730_01` y `20260804_01`, usando el propietario de las tablas para la migración.
3. Despliega el servicio definido en `render.yaml`, que vive en la raíz del
   repositorio porque es donde Render busca los Blueprint. Con `STORAGE_BACKEND=s3`
   las evidencias van a un almacén de objetos y el servicio no necesita disco,
   lo que además habilita el escalamiento horizontal. Render debe comprobar
   `/health/ready` antes de enrutar tráfico.

Las sesiones son cookies HttpOnly, no tokens Bearer. El frontend debe configurar
`NEXT_PUBLIC_API_BASE_URL` y enviar solicitudes con credenciales incluidas.

## Configuración IA (TokenRouter)

- Proveedor: TokenRouter, mediante su API compatible con OpenAI. El código no depende de una familia de modelos concreta.
- Cadena inicial de VLMs: `moonshotai/kimi-k3-free` →
  `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` → `qwen/qwen3.5-9b`.
- Variables clave en `.env`:
  - `AI_TOKENROUTER_API_KEY`
  - `AI_IMAGE_PRIMARY_MODEL`
  - `AI_IMAGE_FALLBACK_MODELS` (lista separada por comas y en orden de uso)
  - `AI_PROMPT_VERSION`, `AI_REQUEST_TIMEOUT_SECONDS`, `AI_MAX_OUTPUT_TOKENS`
- La foto se analiza una sola vez, después de crear el reporte. El resultado se guarda en `ai_metrics`; los paneles nunca vuelven a llamar al proveedor.
- Si todos los modelos fallan o devuelven JSON inválido, el job se reintenta y finalmente queda en `IN_REVIEW`; no hay fallback heurístico que apruebe, publique o autoasigne una incidencia.
- `AUTO_ASSIGN_ENABLED=false` (default): desactiva auto-asignación IA para operar con asignación manual desde dashboard admin.

## Configuracion correo (Brevo API)

- Canal de correo MVP: Brevo Transactional Email API.
- Variables clave en `.env`:
  - `BREVO_API_KEY`
  - `BREVO_FROM_EMAIL`
  - `BREVO_FROM_NAME`

## Workers

- Clasificacion IA:
  `python -m app.workers.ai_worker`
- Notificaciones correo:
  `python -m app.workers.notification_worker`

Si no ejecutas workers, los jobs quedan en `PENDING` y no aparecerán métricas IA en el dashboard.

## Diagnóstico IA rápido

Para validar pipeline IA (DB + jobs + métricas + configuración TokenRouter):

`python check_ai_pipeline.py`

Para probar disponibilidad real, entrada de imagen y JSON de cada modelo configurado
(hace una solicitud no sensible por modelo):

`python check_ai_models.py`

## Endpoints MVP

- `POST /api/v1/auth/bootstrap-admin` (solo primera vez, si no existe ADMIN)
- `POST /api/v1/auth/register` (registro publico, crea cuenta STUDENT)
- `POST /api/v1/auth/users` (ADMIN)
- `GET /api/v1/auth/users` (ADMIN)
- `POST /api/v1/auth/login` (crea cookie de sesión)
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/password-reset`
- `POST /api/v1/reports` (sesión por cookie; `community_consent=true` solo para estudiantes autenticados)
- `GET /api/v1/incidents` (ADMIN)
- `GET /api/v1/incidents/mine` (STUDENT)
- `GET /api/v1/incidents/mine/feed` y `GET /api/v1/incidents/mine/{incident_id}/image` (STUDENT)
- `GET /api/v1/incidents/community` y `GET /api/v1/incidents/community/{incident_id}/image` (STUDENT)
- `POST`/`DELETE /api/v1/incidents/community/{incident_id}/reaction` (STUDENT)
- `PATCH /api/v1/incidents/{incident_id}/community-consent` (STUDENT, retira publicación)
- `GET /api/v1/incidents/{incident_id}`
- `GET /api/v1/incidents/{incident_id}/evidences/{evidence_id}` (descarga evidencia bajo demanda, requiere auth)
- `GET /api/v1/admin/staff` (ADMIN)
- `POST /api/v1/admin/staff` (ADMIN)
- `PATCH /api/v1/admin/staff/{staff_id}` (ADMIN)
- `GET /api/v1/admin/staff/{staff_id}/assignments` (ADMIN)
- `GET /api/v1/admin/campus-zones` (ADMIN)
- `POST /api/v1/admin/campus-zones` (ADMIN)
- `PATCH /api/v1/admin/campus-zones/{zone_id}` (ADMIN)
- `POST /api/v1/admin/incidents/{incident_id}/assign` (ADMIN, asignación manual + trigger de correo)
- `PATCH /api/v1/admin/assignments/{assignment_id}` (ADMIN, estado ASSIGNED/ACKNOWLEDGED/COMPLETED)
- `PATCH /api/v1/admin/incidents/{incident_id}/status` (ADMIN)
- `POST /api/v1/admin/incidents/{incident_id}/resolve-location` (ADMIN, recalcula zona por lat/lng)

## Usuarios de prueba (seed SQL)

Si ejecutaste `sql/seed_test_users.sql`, puedes iniciar sesion con:

- Admin: `uadmin01` / `Admin12345!`
- Estudiante: `ustudent01` / `Campus12345!`
- Staff seguridad: `usec01` / `Seguridad123!`
- Staff limpieza: `uclean01` / `Limpieza123!`

Para crear usuarios via API (solo ADMIN):

`POST /api/v1/auth/users` usando la cookie de sesión ADMIN y el encabezado CSRF.

## Feed Comunidad

Los reportes existentes y anónimos permanecen privados. Un estudiante puede autorizar la publicación
anónima al crear un reporte; el worker IA solo lo muestra si la imagen y la incidencia pasan la
validación. La persona autora puede retirar el consentimiento desde su feed, y las reacciones no
exponen identidades.

## Troubleshooting CORS

Si ves `No 'Access-Control-Allow-Origin' header`, valida:

1. `backend/.env` tiene:
   `CORS_ORIGINS=http://localhost:3000`
2. Reiniciaste el backend despues de editar `.env`.
3. Frontend en `http://localhost:3000` y API en `http://localhost:8000`.
