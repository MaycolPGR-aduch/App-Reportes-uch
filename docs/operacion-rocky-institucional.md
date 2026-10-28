# Operación institucional en Rocky Linux

El servidor existente usa Apache para `giia.uch.edu.pe`, FastAPI en `127.0.0.1:8000` y Next.js en `127.0.0.1:3001`. Otros sistemas comparten Apache y el puerto 3000. No detengas Apache ni reemplaces sus archivos globales sin coordinar con TI. El ejemplo Nginx es para otros despliegues y no debe activarse en este servidor.

Antes de un despliegue, confirma el certificado, DNS, rutas de proxy específicas, límites de petición y `httpd -t`; los cambios de Apache requieren revisión institucional. Define un límite ligeramente superior al máximo de imagen para permitir el resto del formulario, sin deshabilitar el límite del backend.

En el VirtualHost HTTPS de Campus, TI puede limitar únicamente la ruta de reportes, sin cambiar los límites globales de las demás aplicaciones. Por ejemplo, si `MAX_IMAGE_SIZE_MB=10`, 12 MiB dejan espacio para el formulario multipart:

```apache
<Location "/api/v1/reports">
    LimitRequestBody 12582912
</Location>
```

La ruta y el bloque deben integrarse con la configuración `<Location>` de proxy existente, sin duplicar ni reemplazar sus reglas. Comprobar `httpd -t` antes de recargar y probar una imagen válida y otra mayor al límite; Apache debe rechazar la petición grande con HTTP 413. Este límite cubre toda la petición, no solo la imagen. No se ha aplicado en el servidor. Para cuotas por IP, revisar con TI los proxies que preceden a Apache y probar la IP observada por Uvicorn; no confiar en cabeceras que puedan suministrar clientes directamente.

La API exige en producción `CORS_ORIGINS`, `TRUSTED_HOSTS`, `ALLOWED_EMAIL_DOMAINS`, `JWT_SECRET`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL` y, cuando Turnstile está habilitado, `TURNSTILE_SECRET_KEY`. Establece `COOKIE_SECURE=true`, `APP_DEBUG=false` y `AUTO_CREATE_SCHEMA=false`. Configura `DEFAULT_ALERT_EMAIL` y comprueba que la cuenta del remitente permita la entrega. No incluyas secretos en Git ni en capturas.

`STORAGE_BACKEND=local` usa el directorio `LOCAL_STORAGE_PATH`; `STORAGE_BACKEND=s3` requiere `S3_BUCKET` y las credenciales y endpoint apropiados. Configurar un endpoint de R2 no activa S3 por sí solo. No cambies el backend de evidencias sin migrar y verificar los archivos existentes.

La creación inicial de administrador está desactivada en producción por defecto. Para una instalación nueva y solo durante una ventana controlada, activa `BOOTSTRAP_ADMIN_ENABLED=true`, reinicia la API, invoca el endpoint desde loopback y vuelve a desactivarlo y reiniciar. Nunca lo expongas mediante el proxy público. Si no hay administrador y no está habilitado, consulta al responsable del servidor.

La migración `20261027_01` deja las cuentas inactivas históricas sin verificación pendiente: la aplicación no puede distinguir las antiguas suspensiones de las cuentas que esperaban correo. Una persona administradora debe revisar cada caso antes de reactivarlo. La migración `20261027_02` crea la cola durable de eliminación de evidencias. Aplica `alembic upgrade head` sin usar `stamp` en una base ya migrada; antes de operar con datos reales requiere una copia verificada. Para la prueba actual se acepta expresamente el riesgo de prescindir de los datos existentes.

Las incidencias antiguas sin historial fiable de cierre no se purgan automáticamente: requieren revisión administrativa. La cola de eliminación solo trabaja con el mismo almacén (directorio o endpoint y bucket) para el que se creó; si cambias el almacén, las eliminaciones pendientes requieren una migración controlada. La solución aún no incluye reconciliación automática de todos los archivos huérfanos.

Para diagnosticar posibles evidencias faltantes o huérfanas, con el entorno de producción cargado y permisos de lectura en PostgreSQL y el almacén, ejecutar desde `backend`:

```bash
/opt/campus-alertas/venv/bin/python check_evidence_inventory.py --grace-hours 24
```

Para investigar casos concretos, `--show-paths` imprime rutas sensibles: protege la salida y no la publiques. En R2 se requiere permiso de listado sobre el prefijo configurado. El resultado es una instantánea no atómica; cargas y purgas concurrentes pueden producir candidatos falsos. Verifica de nuevo cada caso, la configuración y la cola de borrado antes de decidir cualquier intervención. La herramienta no modifica ni elimina objetos, no comprueba sus hashes y no sustituye una copia de seguridad.

Para cada versión: conserva la ruta de `/opt/campus-alertas/current`, prepara una nueva carpeta, instala dependencias y compila con `NEXT_PUBLIC_API_BASE_URL` y la Site Key pública correctas. Cambia el enlace solo después de probar; reinicia API y frontend, comprueba `/health/ready`, correo, login, logout y mural. Para volver atrás, restablece el enlace anterior y reinicia los mismos servicios; una migración de base puede requerir un procedimiento de recuperación separado.

No existe todavía una solución verificada para respaldar PostgreSQL y restaurarlo. Para la prueba actual, el usuario considera prescindibles los datos del servidor y acepta proceder sin copia; una migración fallida puede exigir reconstruir la base y perder esos datos. Antes de operar con datos reales, acuerda el destino y cifrado de la copia y prueba una restauración aislada. Por decisión actual se pospone una copia independiente de evidencias: el bucket R2 principal no protege por sí solo contra el borrado accidental o la pérdida de objetos. Configura alertas de expiración del certificado y de ausencia de respaldos de PostgreSQL.
