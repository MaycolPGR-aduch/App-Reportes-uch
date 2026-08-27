# Guía para actualizar el repositorio en GitHub

Esta guía describe el flujo recomendado para publicar cambios de **Campus Alertas** sin subir
secretos ni modificar directamente la rama estable por accidente. Los comandos están preparados
para PowerShell y deben ejecutarse desde `C:\App_reportes`, salvo que se indique lo contrario.

## 1. Requisitos previos

- Tener Git instalado y acceso al repositorio de GitHub.
- Confirmar que el remoto sea el correcto:

  ```powershell
  git remote -v
  ```

  El remoto esperado es:

  ```text
  https://github.com/MaycolPGR-aduch/App-Reportes-uch.git
  ```

- No guardar claves reales en archivos versionados. En particular, no subir:
  - `backend/.env`
  - `frontend/.env.local`
  - claves de TokenRouter, Brevo, Turnstile o S3
  - contraseñas o cadenas privadas de PostgreSQL

Los archivos `.env.example` solo deben contener nombres de variables y valores de ejemplo seguros.

## 2. Revisar el estado antes de trabajar

```powershell
cd C:\App_reportes
git status
git branch --show-current
git fetch origin
```

Si vas a comenzar una mejora nueva, parte de la versión más reciente de `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/nombre-descriptivo
```

Usa nombres como `feature/feed-admin`, `fix/login-csrf` o `docs/guia-github`.

> No uses `git reset --hard` para resolver cambios locales: puede borrar trabajo sin posibilidad
> sencilla de recuperación.

## 3. Revisar los cambios locales

```powershell
git status --short
git diff
```

Antes de preparar el commit, verifica especialmente que no aparezcan archivos `.env`, volcados de
base de datos, evidencias fotográficas, logs ni carpetas personales de herramientas.

Para buscar posibles claves agregadas por accidente:

```powershell
git diff -- . ':!*.lock' | Select-String -Pattern 'API_KEY|SECRET|PASSWORD|sk-'
```

Una coincidencia no siempre representa un secreto, pero debe revisarse antes de continuar.

> **`git diff` no lo ve todo.** No muestra archivos nuevos sin seguimiento, así que una clave
> dentro de un archivo recién creado pasa invisible a ese comando. Revisa aparte las líneas que
> `git status --short` marca con `??`, y repite el escaneo sobre lo ya preparado en el paso 5.

## 4. Validar el proyecto

### Backend

```powershell
cd C:\App_reportes\backend
.\venv\Scripts\python.exe -m pytest tests -q
.\venv\Scripts\python.exe -m alembic -c alembic.ini heads
```

La salida de Alembic debe mostrar una sola revisión `head`. No ejecutes `stamp` para aplicar una
migración: `stamp` únicamente cambia el registro de versión y no crea tablas ni columnas.

### Si además probaste a mano contra el sistema en ejecución

La API arranca con `--reload` y recoge sola los cambios del código. **Los tres workers no.** Se
lanzan como `python -m` y mantienen en memoria la versión que tenían al arrancar, así que después
de editar cualquier archivo que ellos usen —`app/services/ai.py`, `app/services/notifications.py`,
`app/workers/*`— hay que reiniciarlos:

```powershell
cd C:\App_reportes\backend
.\stop-all.ps1
.\start-all.ps1
```

Sin ese reinicio la prueba manual sigue ejecutando el código anterior y el arreglo parece no
funcionar. Es un fallo silencioso: no aparece ningún error, simplemente el comportamiento no cambia.

### Frontend

```powershell
cd C:\App_reportes\frontend
npm run lint
npm run build
```

No publiques si fallan las pruebas, el lint o el build, salvo que el problema esté documentado y
sea ajeno a los cambios que se están entregando.

## 5. Preparar un commit

Regresa a la raíz y agrega únicamente los archivos que correspondan a la mejora:

```powershell
cd C:\App_reportes
git add ruta\del\archivo1 ruta\del\archivo2
git diff --cached --check
git diff --cached --stat
git status --short
```

Una vez preparados los archivos, repite el escaneo de secretos sobre el área de preparación. El
comando del paso 3 ya no sirve aquí: al preparar, los cambios salen de `git diff` y entran en
`git diff --cached`, de modo que volver a ejecutarlo sin `--cached` devuelve vacío y da una falsa
sensación de seguridad.

```powershell
git diff --cached -- . ':!*.lock' | Select-String -Pattern 'API_KEY|SECRET|PASSWORD|sk-'
```

Evita `git add .` cuando existan archivos personales o no relacionados. Si preparaste un archivo
por error, retíralo del área de preparación sin borrar su contenido:

```powershell
git restore --staged ruta\del\archivo
```

Crea un commit con un mensaje corto y descriptivo:

```powershell
git commit -m "feat: describe la mejora realizada"
```

Prefijos habituales:

- `feat:` nueva funcionalidad.
- `fix:` corrección de un error.
- `docs:` documentación.
- `test:` pruebas.
- `refactor:` reorganización sin cambiar el comportamiento esperado.
- `chore:` mantenimiento técnico.

## 6. Subir la rama a GitHub

La primera vez que se publica una rama:

```powershell
git push -u origin nombre-de-la-rama
```

En actualizaciones posteriores de la misma rama:

```powershell
git push
```

Después verifica:

```powershell
git status -sb
git log -1 --oneline
```

La rama local debe aparecer sincronizada con `origin/nombre-de-la-rama`.

## 7. Crear y fusionar el Pull Request

1. Abre el repositorio en GitHub.
2. Crea un **Pull Request** desde la rama de trabajo hacia `main`.
3. Resume qué cambió, por qué se hizo y cómo fue probado.
4. Confirma que GitHub Actions termine correctamente.
5. Revisa la pestaña **Files changed** para detectar secretos o archivos ajenos.
6. Fusiona el Pull Request solo cuando las verificaciones estén aprobadas.

No es necesario hacer `push` directo a `main`. El Pull Request conserva el historial de revisión y
reduce el riesgo de publicar cambios incompletos.

## 8. Actualizar la copia local después de fusionar

```powershell
cd C:\App_reportes
git switch main
git pull --ff-only origin main
```

La rama de trabajo puede conservarse o eliminarse cuando se confirme que el cambio funciona. Para
eliminarla localmente de forma segura:

```powershell
git branch -d nombre-de-la-rama
```

## 9. Cambios que incluyen migraciones

Las migraciones se versionan junto con el código en `backend/alembic/versions/`. Antes de publicar:

```powershell
cd C:\App_reportes\backend
.\venv\Scripts\python.exe -m alembic -c alembic.ini current
.\venv\Scripts\python.exe -m alembic -c alembic.ini heads
.\venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

En producción, realiza primero una copia de seguridad y ejecuta `upgrade head` con las variables de
entorno y permisos de la base correctos. No pegues credenciales en el commit ni en el Pull Request.

Si la base existente fue creada manualmente, comprueba que su estructura coincide exactamente con
la revisión antes de usar `alembic stamp`. Marcar una revisión inexistente en la estructura puede
dejar la base inconsistente.

### Si la migración falla por permisos

Las tablas suelen pertenecer a `postgres`, mientras que la aplicación se conecta como
`campus_app`. Crear una clave foránea exige el privilegio `REFERENCES` sobre la tabla destino, así
que una migración que la necesite falla con `permiso denegado a la tabla ...` aunque `campus_app`
pueda leer y escribir con normalidad.

`sql/grant_permissions.sql` ya lo concede. Si la base es anterior a esa corrección, ejecuta una vez
como `postgres` (por ejemplo desde pgAdmin):

```sql
GRANT REFERENCES ON ALL TABLES IN SCHEMA public TO campus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES ON TABLES TO campus_app;
```

La segunda línea evita repetirlo con cada tabla nueva. `REFERENCES` solo habilita apuntar claves
foráneas a esas tablas: no concede acceso a datos ni permite alterarlas.

## 10. Correcciones después de publicar

Si el commit todavía no fue fusionado, corrige los archivos, valida nuevamente, crea otro commit y
ejecuta `git push`.

Si el cambio ya llegó a `main`, evita reescribir el historial compartido. Crea una rama nueva y usa
`git revert` sobre el commit problemático:

```powershell
git switch main
git pull --ff-only origin main
git switch -c fix/revertir-cambio
git revert ID_DEL_COMMIT
git push -u origin fix/revertir-cambio
```

Después crea otro Pull Request.

## Lista de verificación rápida

- [ ] Estoy en una rama de trabajo y no en `main`.
- [ ] Revisé `git status` y `git diff`.
- [ ] No hay secretos, `.env`, evidencias, logs ni archivos personales.
- [ ] Las pruebas backend aprobaron.
- [ ] Si probé a mano, reinicié los workers para que corrieran el código nuevo.
- [ ] El lint y el build frontend aprobaron.
- [ ] Revisé las migraciones, si existen.
- [ ] Preparé únicamente los archivos relacionados.
- [ ] El commit explica claramente el cambio.
- [ ] La rama fue subida y el Pull Request apunta a `main`.
- [ ] GitHub Actions terminó correctamente.
