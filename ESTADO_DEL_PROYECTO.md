# Estado del proyecto — Campus Alertas

Documento de referencia sobre qué hace el sistema, qué está implementado y qué
queda pendiente. Todas las cifras se verificaron contra el código y la base de
datos de desarrollo el **25 de agosto de 2026**.

---

## 1. Qué es

Plataforma web para registrar, clasificar y atender incidencias dentro de un
campus universitario. Un miembro de la comunidad reporta desde el navegador de
su teléfono adjuntando fotografía y ubicación; el sistema clasifica y prioriza
el reporte, avisa por correo al área responsable, y ofrece a la administración
un panel para asignar, dar seguimiento y cerrar cada caso.

**Repositorio:** `https://github.com/MaycolPGR-aduch/App-Reportes-uch`

---

## 2. Estado general

| Área | Estado |
|---|---|
| Reporte de incidencias | Operativo |
| Georreferenciación por zonas | Operativo |
| Asignación y atención | Operativo |
| Notificaciones por correo | Operativo |
| Vista comunitaria y moderación | Operativo |
| **Clasificación por IA** | **Caída** — problema de cuenta, no de código |
| Pruebas automatizadas | 55 en verde |
| Integración continua | Activa en cada push y pull request |

**Resumen:** el sistema funciona de punta a punta salvo la clasificación
automática. Cuando el proveedor de IA no responde, las incidencias no se
publican solas: quedan en revisión manual, ocultas de la vista comunitaria, y
el administrador puede resolverlas desde la cola de moderación.

---

## 3. Tecnologías

### Backend
- **FastAPI** sobre Uvicorn (Python 3.11 en CI)
- **SQLAlchemy 2.0** con **PostgreSQL**; migraciones con **Alembic**
- **Argon2id** para contraseñas, con migración transparente desde PBKDF2
- **Pillow** para normalizar imágenes y eliminar metadatos EXIF
- **httpx** para los proveedores externos
- **pytest** para las pruebas

### Frontend
- **Next.js 16** con App Router y **React 19**
- **TypeScript** en modo estricto
- **Tailwind CSS v4**
- Aplicación web progresiva con manifiesto y service worker propios

### Servicios externos
- **TokenRouter** — clasificación por modelos de visión
- **Brevo** — correo transaccional
- **Cloudflare Turnstile** — protección antiabuso de los formularios públicos
- **S3 compatible** — respaldo cifrado opcional de evidencias

---

## 4. Arquitectura

Tres piezas ejecutables sobre una única base de datos:

1. **Aplicación web** — interfaz en el navegador: formulario público de reporte
   y paneles diferenciados por rol.
2. **Interfaz de programación** — concentra las reglas de negocio y el control
   de acceso. 47 rutas en cuatro grupos.
3. **Procesos de servicio** — tres programas independientes que consumen una
   cola de trabajos: clasificación, notificaciones y mantenimiento.

La comunicación usa cookies de sesión inaccesibles al código de la página. El
trabajo pesado se encola: al registrar una incidencia el servicio responde de
inmediato y un proceso aparte la clasifica, de modo que la lentitud de un
servicio externo no afecta al tiempo de respuesta de quien reporta.

**Nota operativa:** la API arranca con recarga automática; **los tres procesos
de servicio no**. Tras editar código que ellos usen hay que reiniciarlos con
`stop-all.ps1` + `start-all.ps1`.

---

## 5. Módulos implementados

### 5.1 Registro y autenticación
- Registro público restringido a dominios de correo institucionales
- Verificación de correo mediante enlace de un solo uso; la cuenta nace inactiva
- Inicio de sesión con cookie de sesión y protección CSRF por doble cookie
- Restablecimiento de contraseña y reenvío de verificación
- Cierre de sesión que revoca la sesión en el servidor, no solo en el navegador

### 5.2 Reporte de incidencias
- Dos modos: anónimo o con cuenta institucional
- Captura de fotografía y ubicación satelital desde el navegador
- Normalización de la imagen: verificación del contenido real, límite de
  resolución y recodificación que elimina los metadatos EXIF
- Almacenamiento privado, nunca expuesto públicamente
- Control de frecuencia y verificación antiabuso en el modo anónimo
- Consentimiento opcional para compartir en la vista comunitaria

### 5.3 Clasificación automática
- Cadena de modelos con respaldo: si el primero falla, se intenta el siguiente
- Determina categoría, prioridad, puntaje y confianza
- Actúa como filtro de moderación sobre la fotografía
- **Degradación segura:** cuando todos los modelos fallan, la incidencia pasa a
  revisión manual y queda oculta de la vista comunitaria. Nunca se publica sin
  evaluar.

### 5.4 Georreferenciación y zonas
- Resolución de zona por geometría propia, sin extensiones geoespaciales
- Admite polígonos con huecos y agrupaciones; reconoce el punto sobre el borde
- Desempate en tres niveles: prioridad declarada, menor superficie, antigüedad
- Estados diferenciados: coincidente, exterior o indeterminado, con grado de
  confianza según la precisión satelital
- **Validación de coherencia:** rechaza una zona cuyo centroide quede a más de
  2 km del resto del campus, con escape explícito para un segundo local legítimo
- **Captura sobre el terreno:** los vértices se registran caminando el perímetro
  con un teléfono, promediando lecturas, con vista previa de la forma, la
  superficie y el solape con las zonas vecinas — ver
  [GUIA_CAPTURA_DE_ZONAS.md](GUIA_CAPTURA_DE_ZONAS.md)

### 5.5 Procesamiento asíncrono
- Cola sobre la propia base de datos, sin intermediario adicional
- Entrega exclusiva mediante bloqueo selectivo de filas
- Reintentos con espera creciente y número máximo de intentos
- Recuperación de tareas cuyo proceso dejó de responder
- Los bucles sobreviven a cualquier fallo inesperado

### 5.6 Notificaciones por correo
- Destinatarios resueltos por categoría y prioridad mínima de cada responsable
- Idempotencia por clave de evento: un aviso no se envía dos veces
- Todo texto del usuario se escapa antes de componer el mensaje

### 5.7 Consulta y seguimiento
- Listados con alcance por rol y filtros combinables
- Cada incidencia muestra su responsable o «Sin asignar»
- Detalle con ubicación, evidencias, traza de clasificación y responsable
  asignado con su contacto y plazo; los plazos vencidos se marcan en rojo
- Evidencias servidas por ruta autenticada con validación de recorrido

### 5.8 Gestión administrativa
Panel de siete pestañas:

| Pestaña | Contenido |
|---|---|
| Incidencias | Listado, filtros y detalle completo |
| Vista social | Cola de moderación y feed comunitario |
| Sistema | Estado de procesos, cola de trabajos y diagnóstico del proveedor IA |
| Staff | Gestión de personal y su carga de trabajo |
| Asignaciones | Asignar incidencias y cambiar su estado |
| Zonas | Alta y edición de zonas del campus |
| Usuarios | Alta, edición, suspensión y reactivación de cuentas |

Toda operación que modifica datos pide confirmación, indicando la consecuencia
—por ejemplo, que se enviará un correo real al responsable—.

### 5.9 Atención de asignaciones
- Panel del personal, limitado a lo que le fue encomendado
- Cierre de asignación con transición condicional: la incidencia solo pasa a
  resuelta cuando todas sus asignaciones están completadas

### 5.10 Moderación de la vista comunitaria
- Cola siempre disponible, no un modo que haya que activar
- Estados diferenciados: sin evaluar, rechazada por IA, publicada por IA,
  publicada o retirada por un administrador
- **La fotografía se muestra antes de decidir**
- El administrador puede publicar lo que la IA rechazó; cada decisión queda
  registrada con autor, motivo y el veredicto que revirtió
- Publicar sin consentimiento del autor se rechaza
- Una decisión humana nunca se sobrescribe por una reevaluación posterior
- `AI_MODERATION_ENABLED` permite desactivar la moderación automática; la
  clasificación sigue corriendo, pero nada se publica sin decisión humana

### 5.11 Mantenimiento y retención
- Purga automática de incidencias terminales y sus evidencias tras el período
  configurado (180 días por omisión)
- Respaldo opcional a almacenamiento externo con cifrado en reposo

---

## 6. Modelo de datos

**15 tablas** y diez tipos enumerados nativos:

| Grupo | Tablas |
|---|---|
| Identidad y sesión | `users`, `auth_sessions`, `account_tokens` |
| Incidencia y evidencia | `incidents`, `incident_locations`, `incident_evidences` |
| Organización | `campus_zones`, `responsibles` |
| Atención y comunicación | `incident_assignments`, `notifications` |
| Comunidad | `community_reactions`, `moderation_decisions` |
| Automatización | `jobs`, `ai_metrics`, `rate_limit_buckets` |

Integridad referencial diferenciada: eliminar una incidencia arrastra su
ubicación, evidencias y asignaciones, mientras que eliminar una cuenta conserva
las incidencias que reportó, desvinculándolas. Esto permite reportes anónimos y
que dar de baja a alguien no destruya el histórico operativo.

**5 migraciones** versionadas, gestionadas con Alembic.

---

## 7. Seguridad

- Sesiones opacas en cookie inaccesible al código de la página; sin tokens en
  almacenamiento del navegador
- Protección CSRF por doble cookie
- Argon2id para contraseñas
- Control de acceso por rol aplicado en el servicio, no solo en la interfaz
- Campos sensibles suprimidos para todo rol distinto del administrador
- Control de frecuencia persistido y verificación antiabuso
- Validación de imágenes por contenido real y eliminación de metadatos
- Protección de recorrido de rutas en el acceso a evidencias
- Cabeceras de seguridad y política de contenido dependiente del entorno
- El arranque falla explícitamente si en producción falta el secreto de sesión
  o los orígenes autorizados

---

## 8. Estado operativo (25 de agosto de 2026)

```
incidencias : 15
usuarios    : 12  (1 administrador, 8 personal, 3 estudiantes)
zonas       : 7 registradas, 6 activas
trabajos    : 26 completados, 6 fallidos, 0 pendientes
```

Los 6 trabajos fallidos corresponden a la caída del proveedor de IA.

---

## 9. Verificación

**55 pruebas automatizadas** en 14 archivos, todas en verde. Cubren derivación
de contraseñas, saneamiento de texto, normalización de imágenes, resolución de
zonas, composición de correos, resiliencia de los procesos de servicio,
coherencia geográfica de zonas y estados de moderación.

Las pruebas de regresión de defectos corregidos se validaron **al revés**: se
restauró temporalmente el código anterior y se confirmó que fallan contra él.

**Integración continua** en cada push y pull request:

```
backend  : compileall · pytest · alembic heads
frontend : eslint · next build
```

---

## 10. Problemas conocidos

### Clasificación por IA caída — bloqueo externo

Los tres modelos configurados fallan. `check_ai_models.py` lo confirma: dos por
cuota agotada (`403 · $0.00`) y uno porque no existe en el proveedor.

**No se resuelve con código.** Requiere recargar la cuenta de TokenRouter o
cambiar de proveedor. Mientras tanto el sistema degrada correctamente y el
panel de Sistema lo reporta con claridad.

### Zona distante sin escape en la interfaz

El servicio acepta `allow_distant_zone` para registrar un segundo local
legítimo, pero el formulario no ofrece esa casilla. El mensaje de error la
menciona sin que exista.

### Sin respaldo de evidencias configurado

`BACKUP_S3_BUCKET` está vacío: las fotografías viven únicamente en el disco del
servidor. Sumado a que el almacenamiento local ata la API y los procesos al
mismo host, es un punto único de pérdida.

---

## 11. Deuda técnica

| Asunto | Detalle |
|---|---|
| Panel de administración | Un solo archivo de más de 1.500 líneas |
| Pruebas | Todas unitarias; sin pruebas de integración ni de frontend |
| Escalado horizontal | El almacenamiento local impide replicar el servicio |
| Documentación de instalación | Alembic convive con un flujo manual de SQL |

---

## 12. Mejoras propuestas y no implementadas

Ordenadas por lo que más aportaría:

1. **Avisos automáticos de estado.** El panel de Sistema requiere que alguien
   entre a mirarlo. La caída de IA pasó semanas inadvertida por eso.
2. **Avisar al reportante cuando su incidencia se resuelve.** Hoy el circuito
   es mudo hacia quien reporta, y eso determina si la gente sigue usando el
   sistema.
3. **Vigilancia de plazos.** El plazo de atención se calcula y se muestra, pero
   nada escala ni avisa cuando vence.
4. **Selector de zonas sobre mapa.** Se cargan pegando geometría a mano, que es
   como se coló una zona a 10 km del campus.
5. **Registro de acciones administrativas.** Solo la moderación deja traza.

---

## 13. Documentos relacionados

| Archivo | Contenido |
|---|---|
| [README.md](README.md) | Presentación y puesta en marcha |
| [backend/README.md](backend/README.md) | API, procesos, migraciones y despliegue |
| [frontend/README.md](frontend/README.md) | Puesta en marcha de la aplicación web |
| [GUIA_ACTUALIZACION_GITHUB.md](GUIA_ACTUALIZACION_GITHUB.md) | Flujo de trabajo con el repositorio |
| [GUIA_CAPTURA_DE_ZONAS.md](GUIA_CAPTURA_DE_ZONAS.md) | Registrar zonas recorriendo el campus con un teléfono |
