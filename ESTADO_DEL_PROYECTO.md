# Estado del proyecto — Campus Alertas

Documento de referencia sobre qué hace el sistema, qué está implementado y qué
queda pendiente. Todas las cifras se verificaron contra el código y la base de
datos de desarrollo el **2 de septiembre de 2026**.

---

## 1. Qué es

Plataforma web para registrar, clasificar y atender incidencias dentro de un
campus universitario. Un miembro de la comunidad reporta desde el navegador de
su teléfono adjuntando fotografía y ubicación; el sistema recoge el reporte,
pide una recomendación a un modelo de visión cuando corresponde, avisa por
correo al área responsable, y ofrece a la administración un panel para
confirmar la clasificación, asignar, dar seguimiento y cerrar cada caso.

Sobre el sistema se está preparando un **artículo científico** que compara dos
regímenes de moderación: con IA asistiendo a una persona, y sin ella. Esa
finalidad condiciona varias decisiones de diseño descritas más abajo.

**Repositorio:** `https://github.com/MaycolPGR-aduch/App-Reportes-uch`

---

## 2. Estado general

| Área | Estado |
|---|---|
| Reporte de incidencias | Operativo |
| Georreferenciación por zonas | Operativo |
| Captura de zonas caminando | Operativo |
| Acceso, registro y recuperación | Operativo |
| Perfil de usuario | Operativo |
| Asignación y atención | Operativo |
| Notificaciones por correo | Operativo en código; **sin proveedor configurado** en el despliegue |
| Vista comunitaria y moderación | Operativo |
| Triaje humano de la clasificación | Operativo |
| **Clasificación por IA** | **Caída** — cuenta sin saldo, no es problema de código |
| Despliegue en producción | **Activo** |
| Pruebas automatizadas | 127 en verde |
| Integración continua | Activa en cada push y pull request |

**Resumen:** el sistema funciona de punta a punta. La clasificación automática
no responde por falta de saldo en el proveedor, pero eso ya no bloquea nada:
desde el cambio de régimen, ninguna incidencia dependía de ella para avanzar.

---

## 3. Tecnologías

### Backend
- **FastAPI** sobre Uvicorn (Python 3.11 en CI)
- **SQLAlchemy 2.0** con **PostgreSQL**; migraciones con **Alembic**
- **Argon2id** para contraseñas, con verificación heredada de `pbkdf2_sha256`
- **Pillow** para normalizar imágenes
- **httpx** para llamadas salientes
- **boto3** para almacenamiento compatible con S3
- **pytest** para las pruebas

### Frontend
- **Next.js 16** con App Router y **React 19**
- **TypeScript** en modo estricto
- **Tailwind CSS v4**
- Aplicación web progresiva con manifiesto y trabajador de servicio propio

### Servicios externos
- **TokenRouter** — modelos de visión para la clasificación
- **Brevo** — correo transaccional
- **Cloudflare Turnstile** — control anti-abuso (opcional)
- **Cloudflare R2** — almacenamiento de evidencias

---

## 4. Infraestructura de producción

| Servicio | Papel |
|---|---|
| **Neon** | Base de datos PostgreSQL. Región Ohio |
| **Cloudflare R2** | Archivos de evidencia. Bucket privado, región ENAM |
| **Render** | API y los tres trabajadores. Plan gratuito |
| **Vercel** | Aplicación web |

- API: `https://campus-alertas-api.onrender.com`
- Web: `https://app-reportes-uch.vercel.app`

Neon y R2 se reparten el trabajo: la tabla `incident_evidences` guarda la ficha
del archivo —tipo, tamaño, huella `sha256`— y una columna `storage_path` que es
su dirección; los bytes viven en R2.

`render.yaml` está en la raíz del repositorio, declara las variables del
servicio, y `backend/start.sh` aplica las migraciones antes de levantar la API.
Cada empujón a `main` despliega en Render y Vercel automáticamente.

> **Limitación conocida:** el plan gratuito de Render duerme el servicio tras
> unos minutos sin uso; la primera petición después puede tardar medio minuto.

---

## 5. Arquitectura

El reporte se guarda y responde de inmediato. Todo lo lento —clasificación y
correo— viaja por una **cola en PostgreSQL** que los trabajadores consumen con
`FOR UPDATE SKIP LOCKED`, con arrendamiento para recuperar trabajos huérfanos y
reintentos con retroceso.

Tres procesos acompañan a la API:

| Trabajador | Cometido |
|---|---|
| `ai_worker` | Pide la recomendación al modelo y la guarda |
| `notification_worker` | Envía los correos |
| `maintenance_worker` | Purga por retención, vigila plazos y salud del sistema |

---

## 6. Módulos implementados

### 6.1 Acceso, registro y recuperación
- Páginas propias: `/login`, `/register`, `/forgot-password`, `/reset-password`
  y `/verify-email`
- Una sola implementación del inicio de sesión, en `/login`
- Retorno tras entrar mediante `?next=`, validado para impedir que la pantalla
  de acceso redirija fuera del sitio
- Sesiones con testigo opaco en cookie `HttpOnly` y protección CSRF de doble
  envío; el testigo viaja también en el cuerpo porque el frontend y la API están
  en dominios distintos
- Registro restringido a los dominios de correo permitidos. Si no hay proveedor
  de correo configurado, la cuenta se crea igual y queda pendiente de que un
  administrador la active

### 6.2 Perfil de usuario
- `/profile`, igual para estudiantes, personal y administradores
- Muestra código campus, correo, rol, estado y antigüedad
- Cambio de contraseña exigiendo la actual; al cambiarla se cierran las demás
  sesiones
- Cierre de sesión en otros dispositivos, conservando la actual

### 6.3 Reporte de incidencias
- Anónimo o con cuenta, desde la misma página
- Fotografía obligatoria, normalizada y validada
- Ubicación del dispositivo con su precisión
- Consentimiento explícito para aparecer en la vista comunitaria
- La categoría que elige quien reporta se guarda aparte (`reported_category`) y
  no se sobrescribe nunca

### 6.4 Régimen de gobernanza
Cada incidencia se estampa al crearse con el régimen bajo el que se procesa:

| Régimen | Comportamiento |
|---|---|
| `MANUAL` | No se llama a la IA. Todo lo decide una persona |
| `AI_ASSISTED` | La IA propone; una persona acepta o corrige |
| `AI_AUTONOMOUS` | Régimen anterior. Solo etiqueta lo ya ocurrido |

El ajuste `GOVERNANCE_MODE` admite `MANUAL`, `AI_ASSISTED` o `RANDOM`. El valor
queda escrito en la fila y no se vuelve a consultar, de modo que cambiar el
ajuste no reetiqueta lo ya procesado.

### 6.5 Clasificación por IA
- Cadena de modelos con respaldo: si el primero falla, se intenta el siguiente
- Propone categoría, prioridad, puntuación y confianza, y evalúa si el
  contenido es apropiado y si es una incidencia real
- **La IA no decide.** Su recomendación vive en `ai_metrics`; la incidencia solo
  pasa a `IN_REVIEW`. No toca categoría, prioridad ni visibilidad, no crea
  asignaciones y no rechaza sola el contenido inapropiado
- Si se agotan los cinco intentos, la incidencia se queda como estaba: privada,
  esperando a una persona

Detalle completo en [CAPA_DE_IA.md](CAPA_DE_IA.md).

### 6.6 Triaje humano
- `PATCH /admin/incidents/{id}/triage` confirma o corrige categoría, prioridad y
  responsable
- Cada decisión se registra en `triage_decisions` junto a lo que propuso la IA,
  su confianza, quién decidió, cuándo y por qué
- La interfaz muestra la propuesta al lado de los campos, con botón para
  aceptarla de una vez

### 6.7 Georreferenciación y zonas
- Zonas como polígonos, con resolución de punto en polígono escrita a mano
- Desempate por prioridad, luego superficie menor, luego antigüedad
- Validación de coherencia: se rechazan zonas absurdamente lejanas del campus
- CRUD completo desde el panel

### 6.8 Captura de zonas caminando
- Registro punto por punto desde el teléfono, promediando cuatro segundos de
  lecturas por vértice
- Vista previa con superficie, perímetro y avisos de precisión, autocruce y
  solapamiento
- El encuadre lo manda el polígono que se captura; las zonas existentes se
  dibujan como contexto
- Guía en [GUIA_CAPTURA_DE_ZONAS.md](GUIA_CAPTURA_DE_ZONAS.md)

### 6.9 Notificaciones por correo
- Aviso al área responsable cuando se asigna una incidencia
- Aviso a quien reportó cuando se resuelve
- Aviso de plazo vencido
- Alertas de salud del sistema a la dirección configurada
- Todas con deduplicación por clave de evento

### 6.10 Vista comunitaria y moderación
- Muro de incidencias publicadas, solo con consentimiento de quien reportó
- Cola de moderación con vista previa de la evidencia
- La decisión humana prevalece sobre cualquier reevaluación posterior de la IA
- Cada decisión queda en `moderation_decisions`, copiando la etiqueta del actor
  para que el rastro sobreviva al borrado de la cuenta

### 6.11 Gestión administrativa
Panel con pestañas separadas por responsabilidad: incidencias, vista social,
sistema, personal, asignaciones, zonas y usuarios. Ventanas de confirmación en
las operaciones que guardan cambios.

### 6.12 Mantenimiento y vigilancia
- Purga por retención configurable
- Vigilancia de plazos vencidos
- Detección de trabajadores caídos, IA fallando y cuota agotada, con aviso por
  correo y ventana de silencio para no repetirse

---

## 7. Modelo de datos

**17 tablas.** Las que sostienen el estudio:

| Tabla | Para qué |
|---|---|
| `incidents` | Incluye `governance_mode` y `reported_category` |
| `ai_metrics` | La recomendación: modelo, versión de prompt, confianza, latencia, respuesta cruda |
| `triage_decisions` | La decisión humana sobre clasificación, junto a lo que propuso la IA |
| `moderation_decisions` | La decisión humana sobre visibilidad |

Las tres versiones de cada incidencia —lo que dijo quien reportó, lo que
propuso la IA, lo que decidió quien modera— son recuperables por separado. En
modo `MANUAL` las columnas de IA quedan vacías, y esa ausencia es el dato.

**8 migraciones**, la última `20260902_02`. La primera crea el esquema completo
desde `sql/schema.sql`; todas van envueltas en Alembic con el SQL auditable
aparte.

---

## 8. Seguridad

- Contraseñas con Argon2id
- Sesiones opacas en cookie `HttpOnly`; ningún testigo se guarda en el navegador
- CSRF de doble envío, con el testigo entregado en el cuerpo de la respuesta
  para funcionar entre dominios
- Límite de peticiones en acceso, registro, reporte público y cambio de clave
- Saneamiento del texto de entrada y normalización de imágenes
- Escapado de HTML en los correos
- Respuestas indistinguibles en la recuperación de contraseña, para no revelar
  qué correos están registrados
- Filtro de dominios de confianza y de orígenes CORS

---

## 9. Estado operativo (2 de septiembre de 2026)

Base de datos de desarrollo:

```
incidencias : 15  (todas AI_AUTONOMOUS, anteriores al estudio)
usuarios    : 12  (1 administrador, 8 personal, 3 estudiantes)
zonas       : 7 registradas, 6 activas
trabajos    : 26 completados, 10 fallidos, 0 pendientes
```

Los trabajos fallidos corresponden a la caída del proveedor de IA.

La base de producción en Neon arrancó vacía: las incidencias de desarrollo no
se migraron, por contener usuarios de prueba con contraseñas publicadas y
fotografías de banco con marca de agua.

---

## 10. Verificación

**127 pruebas automatizadas**, todas en verde. Cubren derivación de
contraseñas, saneamiento, normalización de imágenes, resolución de zonas,
coherencia geográfica, resistencia de los trabajadores, moderación, vigilancia,
almacenamiento, autenticación sin proveedor de correo, CSRF entre dominios,
cambio de contraseña y régimen de gobernanza.

Además, scripts de comprobación contra servicios reales:

| Script | Qué comprueba |
|---|---|
| `check_ai_models.py` | Que cada modelo configurado responde |
| `check_r2.py` | Ciclo completo del almacén: subir, leer, borrar |
| `check_mvp_health.py` | Salud general |
| `check_ai_pipeline.py` | Recorrido de clasificación |

La integración continua ejecuta compilación y pruebas del backend, y lint y
construcción del frontend.

---

## 11. Problemas conocidos

### Clasificación por IA caída — bloqueo externo
La cuenta de TokenRouter no tiene saldo. **No es un problema de código.**

Con la IA caída, una incidencia en modo `AI_ASSISTED` produce el mismo
resultado que en modo `MANUAL`: queda en revisión, sin propuesta. Para el
estudio esto es grave, porque **los dos brazos serían indistinguibles y nada lo
advertiría**. Hay que recargar y comprobar con `check_ai_models.py` antes de
empezar a recoger datos.

### Sin proveedor de correo en producción
Brevo no está configurado. Los avisos automáticos y la verificación de cuenta
no salen. El registro lo contempla: crea la cuenta y avisa de que un
administrador debe activarla.

### El frontend no tiene ejecutor de pruebas
No hay `vitest`, `jest` ni equivalente. `lib/geo.ts` —áreas, distancias, punto
en polígono, autocruces— es matemática pura sin ninguna prueba que la vigile, y
ya produjo un fallo real en la vista previa de captura de zonas.

La instalación está bloqueada por el cortafuegos de la universidad, que
intercepta TLS con un certificado de Fortinet que Node no reconoce. Se resuelve
instalando desde otra red.

### La red de la universidad bloquea el puerto 5432
No se puede conectar a Neon desde la máquina de desarrollo. No afecta al
despliegue —Render conecta desde su propia red— pero obliga a usar la consola
SQL de Neon para cualquier consulta directa.

---

## 12. Deuda técnica

- **`frontend/app/(dashboard)/dashboard/admin/page.tsx`** sigue siendo un
  archivo grande con varias responsabilidades. Apartado por decisión explícita
  mientras funcione
- **Los tres documentos de derechos de autor** (`docs/derechos-autor/`) están
  sin versionar y describen un sistema donde la IA decide sola. Hay que
  regenerarlos
- **Sin respaldo externo de evidencias**: R2 tiene su propia durabilidad, pero
  no hay copia en otro proveedor

---

## 13. Mejoras propuestas y no implementadas

- **Mensaje de ubicación ambigua**: el resolutor ya calcula la lista de zonas
  solapadas y la descarta. Podría decir «entre el pabellón C y el B»
- **Código de seguimiento para reportes anónimos**: hoy no se les puede avisar
  de nada, porque no hay a quién
- **Registro atómico**: el registro guarda la cuenta y después envía el correo;
  si el envío falla, la cuenta ya existe
- **Exportación de datos del estudio**: las consultas son posibles, pero no hay
  una salida preparada para el análisis

---

## 14. Documentos relacionados

| Archivo | Contenido |
|---|---|
| [README.md](README.md) | Presentación y puesta en marcha |
| [backend/README.md](backend/README.md) | API, procesos, migraciones y despliegue |
| [frontend/README.md](frontend/README.md) | Puesta en marcha de la aplicación web |
| [CAPA_DE_IA.md](CAPA_DE_IA.md) | Cómo funciona la clasificación y qué decide cada parte |
| [GUIA_DESPLIEGUE.md](GUIA_DESPLIEGUE.md) | Poner el sistema en línea paso a paso |
| [GUIA_CAPTURA_DE_ZONAS.md](GUIA_CAPTURA_DE_ZONAS.md) | Registrar zonas recorriendo el campus |
| [GUIA_ACTUALIZACION_GITHUB.md](GUIA_ACTUALIZACION_GITHUB.md) | Flujo de trabajo con el repositorio |
