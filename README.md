# Campus Alertas

Sistema para registrar, clasificar y atender incidencias dentro de un campus universitario.
Los estudiantes pueden reportar una incidencia con evidencia fotográfica y GPS; el personal
asignado atiende sus tareas y los administradores gestionan usuarios, responsables, zonas y
el estado operativo.

## Componentes

- **Frontend:** Next.js PWA en `frontend/`.
- **API:** FastAPI y PostgreSQL en `backend/`.
- **Workers:** clasificación IA mediante TokenRouter, notificaciones por Brevo y mantenimiento diario.
- **Evidencias:** almacenamiento privado local para desarrollo o Render Disk en el despliegue
  actual; admite copia cifrada a almacenamiento S3 compatible.

## Seguridad y privacidad

- Sesiones opacas en cookies `HttpOnly`, con CSRF; el navegador no guarda tokens en
  `localStorage`.
- Roles: ADMIN ve la operación completa, STAFF solo sus asignaciones y STUDENT solo sus propios
  reportes.
- El panel de estudiantes incluye un feed privado de sus reportes y un mural comunitario anónimo.
  Una foto solo llega al mural con consentimiento explícito y después de validación IA; cada cuenta
  puede registrar un apoyo reversible sin revelar su identidad.
- Registro por dominios institucionales, verificación por correo y restablecimiento de contraseña.
- Protección antiabuso mediante rate limiting y Cloudflare Turnstile para flujos públicos.
- Las fotos se validan por contenido, se normalizan y eliminan metadatos EXIF.
- Las incidencias terminales y sus evidencias se eliminan automáticamente tras el período de
  retención configurado (180 días por defecto).

## Desarrollo local

1. Crea `backend/.env` desde `backend/.env.example` y `frontend/.env.local` desde
   `frontend/.env.example`.
2. Instala dependencias:

   ```powershell
   cd backend; .\venv\Scripts\python.exe -m pip install -r requirements.txt
   cd ..\frontend; npm install
   ```

3. En una base nueva ejecuta `alembic -c alembic.ini upgrade head` desde `backend/`.
   Para una base ya actualizada hasta `20260721_01`, ejecuta `alembic -c alembic.ini upgrade head`
   con el propietario de las tablas para aplicar el feed comunitario y el router IA.

## IA configurable

El análisis visual no está acoplado a una marca de modelo. La configuración define un VLM principal
y una cadena de respaldo: Kimi K3 Free → NVIDIA Nemotron Omni Free → Qwen 3.5 9B → revisión
manual. Solo el worker llama a IA, una vez por incidencia; el resultado y el modelo usado quedan
persistidos en PostgreSQL. Cambiar de modelo requiere actualizar las variables `AI_IMAGE_*`, no el
flujo de reportes ni las pantallas.
4. Inicia backend y workers con `backend\start-all.ps1`, y el frontend con `npm run dev` desde
   `frontend/`.

## Validación

```powershell
cd backend; .\venv\Scripts\python.exe -m pytest tests -q
cd frontend; npm run lint; npm run build
```

La integración continua ejecuta estas verificaciones en cada push y pull request.

## Despliegue

`backend/render.yaml` describe el despliegue en Render. Configura los secretos únicamente en
Render; nunca subas archivos `.env`. Consulta `backend/README.md` para migraciones, variables
de entorno y consideraciones del Render Disk.
