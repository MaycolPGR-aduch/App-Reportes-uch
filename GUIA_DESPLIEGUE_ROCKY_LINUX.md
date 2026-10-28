# Despliegue institucional en Rocky Linux 10

> **Servidor institucional existente:** el resto de esta guía contiene un ejemplo genérico con Nginx y puerto 3000; no lo apliques sobre el servidor de la institución. Allí ya funciona Apache en 80/443 y el frontend usa 127.0.0.1:3001. Consulta [la guía específica](docs/operacion-rocky-institucional.md) y coordina cualquier cambio de proxy con TI.

Guía de preparación para alojar Campus Alertas en un servidor institucional. Los archivos de
`deploy/rocky-linux/` contienen las unidades `systemd` y el ejemplo Nginx.

## Alcance de esta primera etapa

La instalación inicial alojará la aplicación y una base PostgreSQL nueva en Rocky Linux. La base
de Neon contiene solo datos de prueba y no se importará. Las evidencias pueden seguir en Cloudflare
R2 durante esta etapa para no llenar el disco local; la API y los workers también seguirán usando
TokenRouter y Brevo, por lo que necesitan conexión HTTPS saliente hacia esos servicios.

Si más adelante se cambia R2 por un almacén institucional, se copian las evidencias conservando sus
rutas antes de cambiar la configuración. No se cambia solamente la variable de conexión.

## Diseño de procesos

```text
Navegador
   │ HTTPS :443
   ▼
Nginx ── /api/ y /health/ ──► FastAPI :8000 (127.0.0.1)
   └── resto de rutas ──────► Next.js :3000 (127.0.0.1)

systemd mantiene API, frontend y tres workers como procesos separados.
PostgreSQL vive en este servidor; las fotos pueden seguir en R2.
```

## Estado del servidor recibido

La sesión SSH reporta Rocky Linux 10.1 x86_64, 8 CPU, 14 GiB de RAM y 50 GiB de disco raíz. Es
suficiente para preparar una primera instancia si las fotos permanecen en R2, pero hay que vigilar
el crecimiento de PostgreSQL, registros y artefactos; los respaldos deben salir del servidor. El
firewall está activo y SELinux aparece desactivado. Para producción institucional, acuerda con TI
un plan para habilitar SELinux en modo enforcing y las políticas necesarias para Nginx. No lo
actives en esta sesión remota sin ventana de mantenimiento y acceso de recuperación. Esta guía no
desactiva SELinux ni abre puertos.

Rocky 10 incluye Python 3.12, Node.js 22 y PostgreSQL 16 en sus repositorios de distribución. Usa
los paquetes mantenidos por Rocky y consulta los repositorios habilitados en el servidor antes de
instalar. Rocky 10 usa DNF 5 y ya no administra versiones por módulos `dnf module`. Rocky Linux
10.2 es la versión menor vigente; coordina con TI su actualización desde 10.1 y el reinicio en una
ventana de mantenimiento antes de producción. [Notas oficiales de Rocky Linux
10.2](https://docs.rockylinux.org/latest/releases/release_notes/10_2/) y [descarga de PostgreSQL
para Rocky/RHEL](https://www.postgresql.org/download/linux/redhat/).

## Requisitos que debe confirmar TI

- Rocky Linux 10 actualizado y arquitectura x86_64 o aarch64 soportada por las dependencias.
- Un nombre DNS institucional, por ejemplo `alertas.universidad.edu`, apuntando al servidor.
- Python 3.12, Node.js 22, npm, Git, Nginx, PostgreSQL y Certbot instalados desde fuentes aprobadas
  por TI.
- Acceso a los registros de paquetes aprobados (PyPI y npm), o mirrors internos; `npm ci` y `pip`
  deben resolver las dependencias durante la preparación de una release.
- Acceso HTTPS saliente a TokenRouter, Brevo y R2 si se conservan esos proveedores.
- Puertos entrantes 80/443 desde las redes autorizadas. Los puertos 3000 y 8000 no se abren al
  exterior; ambos servicios solo escuchan en loopback.
- Definir quién administra certificados, respaldos y alertas del servidor.

Los comandos de firewall, certificados y SELinux pueden variar según las políticas institucionales.
Coordina esos cambios con TI antes de abrir el servicio a usuarios.

Como SELinux está desactivado ahora, no hay políticas de confinamiento ni registros AVC. Si TI lo
habilita, Nginx puede necesitar permiso SELinux para conectar con los backends locales; TI debe
revisar los registros y aplicar la regla mínima aprobada (por ejemplo, la política booleana de
conexión de red para el dominio web), no generar una política amplia automáticamente. Consulta la
[guía oficial de SELinux de Rocky Linux](https://docs.rockylinux.org/guides/security/selinux/).

## 1. Preparar el servidor

Conéctate por SSH con la cuenta institucional autorizada. Evita ejecutar la aplicación como `root`.
Como administrador del servidor, crea la cuenta y los directorios de servicio:

```bash
useradd --system --home-dir /opt/campus-alertas --shell /sbin/nologin campus-alertas
install -d -o root -g campus-alertas -m 0750 /opt/campus-alertas/releases
install -d -o root -g campus-alertas -m 0750 /etc/campus-alertas
install -d -o campus-alertas -g campus-alertas -m 0750 /var/lib/campus-alertas/evidences
```

Instala desde los repositorios habilitados por TI:

```bash
dnf install -y python3 python3-pip nodejs npm git nginx postgresql-server
```

Verifica que `python3`, `node`, `npm`, `nginx` y `git` estén disponibles. Rocky 10 incluye Python
3.12 y Node.js 22; el backend se preparará con el Python del sistema y el frontend requiere Node 22.

## 2. Crear PostgreSQL local desde cero

El servidor institucional revisado ya tiene PostgreSQL 16 instalado, el servicio activo y un clúster
inicializado. Solo contiene las bases predeterminadas (`postgres`, `template0`, `template1`); el rol
`campus_app` no existe y PostgreSQL escucha únicamente en `127.0.0.1` y `::1`. Para esta instalación
se reutilizará ese clúster y se creará una base nueva `campus_alertas`. No ejecutes `initdb`, no
borres `/var/lib/pgsql/data` y no modifiques las bases existentes.

Para otro servidor, antes de inicializar comprueba si PostgreSQL ya está instalado y si su
directorio de datos tiene contenido. No borres el directorio si encuentras datos; detente y revisa
ese estado con el administrador.

```bash
rpm -q postgresql-server
ls -la /var/lib/pgsql/data 2>/dev/null || true
```

Solo si se trata de una instalación realmente nueva, el directorio está vacío y TI confirma que no
existe información que preservar, inicializa el clúster, activa PostgreSQL y comprueba el servicio:

```bash
postgresql-setup --initdb
systemctl enable --now postgresql
systemctl status postgresql --no-pager
```

El paquete requiere inicialización explícita. No abras el puerto 5432 al exterior: la API y
PostgreSQL corren en la misma máquina. Mantén `listen_addresses = 'localhost'` y limita `pg_hba`
a conexiones locales TCP con autenticación SCRAM. [Instrucciones oficiales de instalación de
PostgreSQL para RHEL/Rocky](https://www.postgresql.org/download/linux/redhat/).

Crea un rol de aplicación y una base vacía. El comando `\password` te pedirá la clave sin ponerla
en el historial de SQL:

```bash
runuser -u postgres -- psql
```

En la consola `psql`:

```sql
CREATE ROLE campus_app LOGIN;
\password campus_app
CREATE DATABASE campus_alertas OWNER campus_app ENCODING 'UTF8';
\q
```

Comprueba la conexión local. `-W` solicita la contraseña de forma interactiva:

```bash
psql -h 127.0.0.1 -U campus_app -d campus_alertas -W -c 'SELECT version();'
ss -lnt | grep 5432
```

El listener debe quedar restringido a loopback. No agregues reglas del firewall para 5432. Para
otra máquina administradora, usa el mecanismo institucional aprobado, como una VPN o un túnel SSH
temporal, sin exponer PostgreSQL públicamente.

## 3. Descargar y preparar una versión

Usa una carpeta nueva por versión; no reemplaces archivos de una versión que esté atendiendo
usuarios. Para esta migración, clona la rama revisada `codex/rocky-institutional-deploy`; en
despliegues posteriores, fija el commit o tag aprobado:

```bash
RELEASE=/opt/campus-alertas/releases/2026-10-20-01
git clone --branch codex/rocky-institutional-deploy --depth 1 https://github.com/MaycolPGR-aduch/App-Reportes-uch.git "$RELEASE"
```

Si GitHub requiere autenticación, configura el mecanismo institucional aprobado. No pongas un token
de acceso dentro de la URL ni en el historial de comandos.

Prepara el entorno Python y dependencias:

```bash
python3 -m venv /opt/campus-alertas/venv
/opt/campus-alertas/venv/bin/pip install --upgrade pip
/opt/campus-alertas/venv/bin/pip install -r "$RELEASE/backend/requirements.txt"
```

Prepara Next.js en la misma máquina que ejecutará la aplicación:

```bash
cd "$RELEASE/frontend"
npm ci
export NEXT_PUBLIC_API_BASE_URL=https://alertas.universidad.edu/api/v1
export NEXT_PUBLIC_TURNSTILE_SITE_KEY=CLAVE_PUBLICA_TURNSTILE
npm run build
install -d -o campus-alertas -g campus-alertas -m 0750 .next/cache
```

`NEXT_PUBLIC_API_BASE_URL` se incorpora en el bundle durante `npm run build`; cambiarlo solo en el
archivo de entorno después de compilar no cambia el frontend publicado.

Da al servicio acceso de lectura al código. El usuario `campus-alertas` necesita escritura en
`/var/lib/campus-alertas`; Next también debe poder escribir en `.next/cache`.

## 4. Configurar secretos y dominios

Crea `/etc/campus-alertas/app.env`, modo `0600`, propiedad `root:root`. Es un archivo de variables
de entorno para systemd, no debe guardarse en Git. Usa valores reales solo en el servidor:

```ini
APP_ENV=production
APP_DEBUG=false
AUTO_CREATE_SCHEMA=false
DATABASE_URL=postgresql+psycopg2://campus_app:CLAVE_URL_SEGURA@127.0.0.1:5432/campus_alertas
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_LARGO
CORS_ORIGINS=https://alertas.universidad.edu
TRUSTED_HOSTS=alertas.universidad.edu
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
ALLOWED_EMAIL_DOMAINS=universidad.edu
LOCAL_STORAGE_PATH=/var/lib/campus-alertas/evidences
STORAGE_BACKEND=s3
S3_BUCKET=BUCKET_PRIVADO
S3_PREFIX=evidences
S3_ENDPOINT_URL=https://ENDPOINT_S3
S3_ACCESS_KEY_ID=CLAVE_DE_ACCESO
S3_SECRET_ACCESS_KEY=SECRETO_DE_ACCESO
S3_REGION=auto
AI_TOKENROUTER_API_KEY=CLAVE_TOKENROUTER
AI_TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
AI_IMAGE_PRIMARY_MODEL=moonshotai/kimi-k3-free
AI_IMAGE_FALLBACK_MODELS=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,qwen/qwen3.5-9b
BREVO_API_KEY=CLAVE_BREVO
BREVO_FROM_EMAIL=alertas@universidad.edu
BREVO_FROM_NAME=Campus Alertas
DEFAULT_ALERT_EMAIL=seguridad@universidad.edu
DASHBOARD_BASE_URL=https://alertas.universidad.edu/dashboard
FRONTEND_BASE_URL=https://alertas.universidad.edu
REQUIRE_TURNSTILE=true
TURNSTILE_SECRET_KEY=CLAVE_SECRETA_TURNSTILE
RETENTION_DAYS=180
```

Adapta proveedor, host, dominio, remitente y valores requeridos por la institución. Para la clave de
PostgreSQL usa, por ejemplo, `openssl rand -hex 32` y una cadena hexadecimal: evita caracteres que
deban codificarse en una URL (`@`, `:`, `/`, `%`, `#`). Si usas otra clave, codifica correctamente
sus caracteres antes de incluirlos en `DATABASE_URL`. Si se elige disco
local para fotos, cambia `STORAGE_BACKEND=local`; conserva la ruta bajo `/var/lib/campus-alertas` y
define cómo se respaldará. No omitas Turnstile en producción pública sin una excepción aprobada.

Protege el archivo y prepara el enlace a la versión:

```bash
chown root:root /etc/campus-alertas/app.env
chmod 600 /etc/campus-alertas/app.env
chown -R root:campus-alertas "$RELEASE"
chmod -R o-rwx "$RELEASE"
ln -sfn "$RELEASE" /opt/campus-alertas/current
```

Genera `JWT_SECRET` con un generador criptográfico del servidor o de la organización. No reutilices
la clave de desarrollo ni la publiques en tickets o mensajes.

## 5. Aplicar esquema e inicializar el administrador

Antes de poner el sitio en línea:

1. Comprueba que `DATABASE_URL` apunta al PostgreSQL local y que `campus_app` puede iniciar sesión.
2. La base nueva no necesita `stamp`: `alembic upgrade head` crea el esquema completo a partir de
   las migraciones versionadas. La rama actual tiene una sola revisión final, `20260922_01`.
3. Instala las unidades de `systemd` de la sección 6 y ejecuta una vez
   `campus-alertas-migrate.service`; esa unidad ejecuta `alembic upgrade head`.
4. Inicializa el administrador con el procedimiento de instalación aprobado mientras el firewall
   todavía bloquea el acceso público. El endpoint `/auth/bootstrap-admin` está habilitado mientras
   no exista una cuenta ADMIN; no abras el sitio a visitantes hasta verificar que el administrador
   ya existe.

No ejecutes `alembic stamp` como sustituto de `upgrade`. `stamp` no aplica cambios al esquema.

## 6. Instalar unidades de systemd

Desde la raíz del repositorio:

```bash
install -m 0644 deploy/rocky-linux/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
```

Ejecuta migraciones una vez, después activa los procesos:

```bash
systemctl start campus-alertas-migrate.service
systemctl status campus-alertas-migrate.service --no-pager
systemctl enable --now campus-alertas-api.service
systemctl enable --now campus-alertas-frontend.service
systemctl enable --now campus-alertas-ai-worker.service
systemctl enable --now campus-alertas-notification-worker.service
systemctl enable --now campus-alertas-maintenance-worker.service
```

La unidad de migración es manual para evitar que cada reinicio de la API intente modificar la base.
Node está configurado como `/usr/bin/npm`; adapta `ExecStart` si TI instala Node en otra ruta. La
unidad Python espera el virtualenv en `/opt/campus-alertas/venv`.

Consulta logs con:

```bash
journalctl -u campus-alertas-api -f
journalctl -u campus-alertas-ai-worker -f
systemctl --failed
```

## 7. Configurar Nginx, firewall y TLS

Copia `deploy/rocky-linux/nginx/campus-alertas.conf` a la carpeta de configuración de Nginx que use
el servidor y sustituye `alertas.universidad.edu` por el nombre DNS real. Comprueba y recarga:

```bash
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

Configura el firewall institucional para permitir 80/443 solo desde redes autorizadas. Los procesos
Next y FastAPI no deben publicarse directamente en 3000/8000. En Rocky, SELinux puede bloquear las
conexiones de proxy de Nginx a loopback; TI debe revisar el AVC y aplicar la política aprobada para
el servicio web, en vez de desactivar SELinux.

Cuando DNS, firewall y proxy respondan por HTTP, instala un certificado con el método aprobado por
TI (por ejemplo Certbot si la institución lo permite). Fuerza HTTPS y verifica que renueve
automáticamente. `COOKIE_SECURE=true` requiere que las personas accedan por HTTPS.

## 8. Comprobación de arranque

Antes de entregar el servicio:

```bash
curl -fsS https://alertas.universidad.edu/health/live
curl -fsS https://alertas.universidad.edu/health/ready
systemctl is-active campus-alertas-api campus-alertas-frontend \
  campus-alertas-ai-worker campus-alertas-notification-worker \
  campus-alertas-maintenance-worker nginx
```

Luego prueba inicio/cierre de sesión, registro, creación de reporte con imagen, apertura autorizada
de la evidencia, feed, notificaciones, moderación y panel del sistema. Confirma en los logs que el
worker de IA leyó la imagen desde el almacén configurado.

## 9. Actualizar la aplicación

1. Descarga el commit aprobado en un nuevo directorio `releases/`.
2. Instala dependencias y compila frontend con `NEXT_PUBLIC_API_BASE_URL` correcto.
3. Toma respaldo de PostgreSQL y confirma la recuperación posible.
4. Apunta `current` a la nueva versión.
5. Ejecuta `systemctl start campus-alertas-migrate.service`.
6. Reinicia API, frontend y workers; revisa `/health/ready` y los logs.
7. Si falla el código, vuelve el enlace `current` a la versión anterior y reinicia procesos. Una
   migración de esquema puede no admitir rollback automático: documenta el plan de reversión de cada
   migración antes de desplegarla.

## Pendientes institucionales antes de producción

- Acordar respaldo cifrado de PostgreSQL fuera del servidor y probar restauración.
- Acordar respaldo de evidencias si se usa disco local. R2 tiene durabilidad externa, pero debe
  incluirse en el plan institucional de continuidad.
- Definir supervisión de disco, memoria, procesos, certificado, PostgreSQL, correo y workers.
- Ejecutar pruebas de aceptación en Rocky 10 y una prueba de recuperación ante desastre.
- Configurar respaldos cifrados y externos de PostgreSQL local; probar restauración antes de abrir el
  sistema a usuarios.
