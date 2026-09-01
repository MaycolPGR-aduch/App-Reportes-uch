# Guía de despliegue — Campus Alertas

Objetivo inmediato: tener la aplicación en línea con HTTPS para **recorrer el
campus y grabar los polígonos de las zonas** desde el móvil.

> **Por qué HTTPS no es opcional:** los navegadores solo entregan la ubicación
> del dispositivo en un origen seguro. Sin HTTPS, la herramienta de captura de
> zonas no recibe ni una coordenada. Los cuatro servicios de abajo dan HTTPS sin
> configurar nada.

---

## Cómo se reparte el trabajo

Cuatro servicios, cada uno con un cometido que los demás no cubren:

| Servicio | Guarda / hace | Coste |
|---|---|---|
| **Neon** | La base de datos: usuarios, incidencias, **zonas y sus polígonos** | Gratis |
| **Cloudflare R2** | Los archivos de evidencia (`.webp`, `.jpg`) | Gratis hasta ~10 GB |
| **Render** | La API y los tres trabajadores | Gratis |
| **Vercel** | El frontend Next.js | Gratis |

**Neon y R2 no compiten, se complementan.** La tabla `incident_evidences` guarda
la *ficha* del archivo —tipo, tamaño, huella `sha256`, a qué incidencia
pertenece— y una columna `storage_path` que es la **dirección** del archivo:

```
storage_path: evidences/2026/03/19/3e9ea651….webp   ← la fila, en Neon (~200 bytes)
el archivo en sí                                     ← en R2 (121 KB)
```

La base de datos sabe buscar y relacionar; el almacén de objetos sabe servir
archivos grandes y baratos. Ninguno hace bien el trabajo del otro.

---

## Antes de empezar

El orden importa: **Render necesita saber la URL de Vercel** (para permitir el
origen) y **Vercel necesita saber la URL de Render** (para llamar a la API). Se
resuelve desplegando Render primero con un valor provisional y corrigiéndolo al
final. El paso 5 lo cierra.

---

## Paso 1 — Base de datos en Neon

1. Crear un proyecto en [neon.tech](https://neon.tech). Elegir la región más
   cercana a Perú (`us-east` suele ser la mejor opción disponible).
2. Copiar la cadena de conexión. Tiene esta forma:

   ```
   postgresql://usuario:clave@ep-algo-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   **`?sslmode=require` debe estar.** Neon rechaza conexiones sin cifrar.
3. Guardarla; es el valor de `DATABASE_URL` en el paso 3.

No hace falta crear tablas: `start.sh` ejecuta `alembic upgrade head` en cada
arranque y las crea en el primer despliegue.

---

## Paso 2 — Almacenamiento en Cloudflare R2

1. En el panel de Cloudflare, **R2 → Create bucket**. Nombre: `campus-evidences`.
2. **R2 → Manage API Tokens → Create API Token**, con permiso *Object Read &
   Write* sobre ese bucket. Anotar las tres cosas que muestra:
   - **Access Key ID**
   - **Secret Access Key** (solo se ve una vez)
   - **Endpoint**, con la forma `https://<id-de-cuenta>.r2.cloudflarestorage.com`

3. **Dejar el bucket privado.** No hace falta acceso público: la API descarga el
   objeto y lo reenvía, conservando el control de permisos que ya hacen los
   endpoints. Un bucket público dejaría ver cualquier evidencia a quien tuviera
   el enlace, sin importar si tiene permiso sobre la incidencia.

> **`S3_REGION` va en `auto`.** R2 exige esa palabra literal. Solo se cambia si
> algún día se migra a AWS S3, que espera una región real (`us-east-1`, etc.).

---

## Paso 3 — API en Render

1. **New → Blueprint**, apuntando al repositorio. Render lee `render.yaml`
   y declara el servicio y las 50 variables solo.
2. Render pedirá los valores marcados como secretos. Los mínimos para arrancar:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena de Neon del paso 1 |
   | `S3_BUCKET` | `campus-evidences` |
   | `S3_ENDPOINT_URL` | El endpoint de R2 del paso 2 |
   | `S3_ACCESS_KEY_ID` | Del token de R2 |
   | `S3_SECRET_ACCESS_KEY` | Del token de R2 |
   | `CORS_ORIGINS` | Provisional: `https://localhost` — se corrige en el paso 5 |
   | `TRUSTED_HOSTS` | **Vacío** — se rellena en el paso 5 |
   | `ALLOWED_EMAIL_DOMAINS` | `uch.edu.pe` |

   > **No adivines `TRUSTED_HOSTS` aquí.** `TrustedHostMiddleware` filtra *todas*
   > las peticiones, incluida la del health check de Render. Un dominio que no
   > coincida devuelve `400` a todo y Render da el despliegue por fallido, en
   > bucle — y en este paso el dominio todavía no existe. `app/main.py` solo monta
   > el middleware `if settings.trusted_hosts:`, así que con la variable vacía el
   > filtro ni se activa.

   `JWT_SECRET` se genera solo (`generateValue: true`); no hay que inventarlo.

   Las de correo (`BREVO_*`, `DEFAULT_ALERT_EMAIL`) y de IA
   (`AI_TOKENROUTER_API_KEY`, `AI_IMAGE_*`) pueden quedar vacías: la aplicación
   arranca igual y esas funciones quedan inactivas. Para grabar zonas no hacen
   falta.

3. Esperar a que `/health/ready` responda. El primer arranque tarda más porque
   corre todas las migraciones.

### Sembrar el primer administrador

Sin un usuario administrador no se puede entrar al panel.

> **No usar `sql/seed_test_users.sql` en un despliegue público.** Ese archivo trae
> las contraseñas **en texto plano en sus comentarios**, y el repositorio es
> público: cualquiera que lo lea entra como administrador. Sirve para la máquina
> de desarrollo y solo para eso.

Crear en su lugar un administrador con una contraseña propia. Desde la consola de
Render (**Shell**), o en local con `DATABASE_URL` apuntando a Neon:

```bash
python -c "from app.core.security import hash_password; print(hash_password('LA-CLAVE-QUE-ELIJAS'))"
```

Devuelve un hash `$argon2id$…`. Con él, en la consola SQL de Neon:

```sql
INSERT INTO users (campus_id, full_name, email, password_hash, role, status)
VALUES ('admin01', 'Nombre Apellido', 'admin@uch.edu.pe',
        '<pegar aquí el hash>', 'ADMIN', 'ACTIVE');
```

El correo debe pertenecer a un dominio de `ALLOWED_EMAIL_DOMAINS`, o el inicio de
sesión lo rechazará.

Las zonas sí conviene sembrarlas: `sql/seed_campus_zones_template.sql` deja unas
de partida que luego se corrigen caminando el campus. Recuerda que la zona de
ejemplo de esa plantilla está a 10 km del campus y hay que editarla o
desactivarla.

---

## Paso 4 — Frontend en Vercel

1. **Add New → Project**, importar el repositorio, y fijar **Root Directory** en
   `frontend`. Vercel detecta Next.js solo.
2. Variables de entorno:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://campus-alertas-api.onrender.com/api/v1` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vacío por ahora |

   **Con `/api/v1` al final y sin barra final.** Es el error más fácil de cometer
   y produce 404 en todas las llamadas.
3. Desplegar y anotar la URL que asigna Vercel.

---

## Paso 5 — Cerrar el círculo

Volver a Render y rellenar las dos variables que dependían de datos que hasta
ahora no existían:

```
CORS_ORIGINS  = https://campus-alertas.vercel.app
TRUSTED_HOSTS = campus-alertas-api.onrender.com
```

`CORS_ORIGINS` lleva el esquema `https://`; `TRUSTED_HOSTS` es solo el dominio.

**Sin barra final.** La comprobación de origen compara la cadena exacta; una barra
de más rechaza todas las peticiones con un error de CORS que en el navegador se
ve como un fallo de red genérico y despista mucho.

Render reinicia solo al guardar. Con eso el sistema queda operativo.

---

## Comprobar que funciona

En este orden, porque cada paso depende del anterior:

1. **`https://…onrender.com/health/ready`** → responde `200`.
2. **Entrar al panel** con el administrador sembrado. Si el inicio de sesión
   falla con error de red, `CORS_ORIGINS` no coincide.
3. **Crear una zona a mano** desde el panel → confirma que Neon escribe.
4. **Reportar una incidencia con foto** → confirma que R2 escribe. Volver a
   abrir la incidencia y ver la foto confirma que R2 también lee.
5. **Abrir la captura de zonas en el móvil** y comprobar que pide permiso de
   ubicación. Si no lo pide, no se está en HTTPS.

---

## Lo que conviene saber antes

**El plan gratuito de Render duerme el servicio tras unos minutos sin uso.** La
primera petición después tarda medio minuto en responder. Molesta en pruebas, no
rompe nada. Al salir a caminar el campus, conviene abrir la aplicación unos
minutos antes.

**Cuatro procesos en una instancia gratuita van justos de memoria.** `start.sh`
levanta los tres trabajadores y la API en el mismo contenedor. Si Render reporta
reinicios por memoria, se pueden desactivar los trabajadores que no hagan falta
para grabar zonas —dependen de la IA y del correo, no de la captura— comentando
sus líneas en `start.sh`.

**`REQUIRE_TURNSTILE` viene en `false`.** Es deliberado: la verificación
anti-abuso responde `403` si se exige sin clave configurada, y el reporte anónimo
dejaría de funcionar. Antes de abrirlo a usuarios reales hay que dar de alta
Turnstile en Cloudflare y poner la clave en ambos lados.

**La capa de IA depende del saldo de TokenRouter.** Con la cuenta agotada las
incidencias se clasifican como pendientes de revisión en vez de publicarse solas.
Es una limitación de saldo, no del despliegue.

---

## Cambiar de almacén más adelante

`local` y `s3` generan **exactamente la misma forma de clave**
(`evidences/AAAA/MM/DD/<32 hex>.<ext>`), y hay una prueba que lo fija. Migrar de
uno a otro es copiar los archivos conservando la ruta y cambiar
`STORAGE_BACKEND`: **las filas de la base siguen siendo válidas**, porque
`storage_path` significa lo mismo en ambos.

Para volver al disco de Render en vez de R2: poner `STORAGE_BACKEND=local`,
`LOCAL_STORAGE_PATH=/var/data/evidences`, y añadir el bloque de disco al
`render.yaml` (requiere plan de pago, ~7 USD/mes).
