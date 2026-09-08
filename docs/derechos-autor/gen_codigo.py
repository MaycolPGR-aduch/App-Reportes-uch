"""Genera «CÓDIGO FUENTE DEL SOFTWARE» para Campus Alertas.

Transcribe **la totalidad** del código fuente de autoría propia, agrupado por
áreas funcionales que espejan los módulos de la Memoria Descriptiva.

La versión anterior de este generador transcribía una selección hecha a mano y
el documento se presentaba como «partes más importantes del código fuente». La
oficina de registro observó que el documento debe contener el código completo,
de modo que ahora los archivos **se descubren recorriendo el repositorio** en
lugar de enumerarse: una lista escrita a mano se queda atrás en cuanto alguien
añade un archivo, y volveríamos al mismo problema sin darnos cuenta.

Las áreas solo definen el orden de presentación. Cualquier archivo que no encaje
en ninguna acaba igualmente en el documento, en un apartado final, porque el
criterio que manda es la completitud y no la clasificación.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import (  # noqa: E402
    NOTA, RECURSOS_GRAFICOS, STACK, bloque_codigo, guardar, h1, h2, indice,
    nuevo_documento, parrafo, portada, salto_de_pagina,
)

RAIZ = Path(__file__).resolve().parents[2]

LENGUAJES = {
    ".py": "python", ".ts": "typescript", ".tsx": "tsx", ".sql": "sql",
    ".yaml": "yaml", ".yml": "yaml", ".ps1": "powershell", ".sh": "bash",
    ".js": "javascript", ".svg": "svg", ".webmanifest": "json",
}

# --------------------------------------------------------------- descubrimiento

#: Carpetas donde vive el codigo de autoria propia.
RAICES = (
    "backend/app", "backend/alembic", "backend/sql",
    "frontend/app", "frontend/components", "frontend/lib", "frontend/public",
    ".github/workflows",
)

#: Archivos propios que no cuelgan de esas carpetas.
SUELTOS = (
    "render.yaml", "backend/start.sh",
    "backend/start-all.ps1", "backend/stop-all.ps1",
    "frontend/next.config.ts",
)

EXTENSIONES = {
    ".py", ".ts", ".tsx", ".sql", ".js", ".yaml", ".yml", ".ps1", ".sh",
    ".svg", ".webmanifest",
}

#: Nada de esto es obra propia ni es codigo: dependencias de terceros,
#: artefactos de compilacion, y la suite de pruebas, que se documenta aparte.
EXCLUIR_DIRECTORIO = {
    "node_modules", "venv", "__pycache__", ".next", ".git", "tests", "docs",
}

EXCLUIR_ARCHIVO = {"package-lock.json", "tsconfig.tsbuildinfo", "pytest.ini"}


def descubrir() -> list[Path]:
    """Todos los archivos de codigo propio del repositorio.

    Se recorre el arbol en vez de mantener una lista porque la completitud es un
    requisito del registro: si alguien anade un modulo manana, tiene que
    aparecer aqui sin que nadie se acuerde de anotarlo.
    """
    encontrados: set[Path] = set()

    for raiz in RAICES:
        base = RAIZ / raiz
        if not base.exists():
            continue
        for ruta in base.rglob("*"):
            if not ruta.is_file() or ruta.suffix not in EXTENSIONES:
                continue
            if any(parte in EXCLUIR_DIRECTORIO for parte in ruta.parts):
                continue
            if ruta.name in EXCLUIR_ARCHIVO:
                continue
            encontrados.add(ruta)

    for suelto in SUELTOS:
        ruta = RAIZ / suelto
        if ruta.is_file():
            encontrados.add(ruta)

    # Guiones de comprobacion contra servicios reales, en la raiz del backend.
    for ruta in (RAIZ / "backend").glob("*.py"):
        encontrados.add(ruta)

    return sorted(encontrados)


# ---------------------------------------------------------------------- areas

#: (titulo, descripcion, prefijos). El orden manda: un archivo se asigna a la
#: primera area cuyo prefijo coincida.
AREAS = [
    ("Punto de entrada e infraestructura del servicio",
     "Arranque de la interfaz de programación, middleware de seguridad, configuración por "
     "entorno, sesión de base de datos y tipos enumerados compartidos por todo el sistema.",
     ["backend/app/main.py", "backend/app/core/", "backend/app/db/",
      "backend/app/models/base.py", "backend/app/models/enums.py"]),

    ("Modelo de datos: esquema, migraciones y entidades",
     "Definición del esquema relacional, migraciones versionadas y declaración de las "
     "entidades persistentes con sus relaciones e índices.",
     ["backend/sql/", "backend/alembic/", "backend/app/models/"]),

    ("Registro y autenticación",
     "Registro restringido por dominio institucional, verificación de correo, derivación de "
     "contraseñas con Argon2id, sesiones opacas en cookie, protección contra falsificación de "
     "peticiones y control de acceso por rol.",
     ["backend/app/api/deps.py", "backend/app/api/v1/auth.py",
      "backend/app/services/sessions.py", "backend/app/services/accounts.py",
      "backend/app/schemas/auth.py",
      "frontend/app/login/", "frontend/app/register/",
      "frontend/app/forgot-password/", "frontend/app/reset-password/",
      "frontend/app/verify-email/", "frontend/app/profile/",
      "frontend/components/auth-card.tsx", "frontend/components/password-input.tsx",
      "frontend/components/nav-session.tsx", "frontend/lib/next-url.ts"]),

    ("Reporte de incidencias y tratamiento de la evidencia",
     "Registro de incidencias en modo anónimo y autenticado, normalización de imágenes con "
     "supresión de metadatos, almacenamiento privado, saneamiento de texto, control de "
     "frecuencia y verificación antiabuso.",
     ["backend/app/api/v1/reports.py", "backend/app/services/images.py",
      "backend/app/services/sanitizer.py", "backend/app/services/storage.py",
      "backend/app/services/rate_limit.py", "backend/app/services/captcha.py",
      "backend/app/schemas/report.py", "backend/app/schemas/incident.py",
      "frontend/app/(report)/", "frontend/components/report-form.tsx",
      "frontend/components/turnstile-widget.tsx"]),

    ("Régimen de gobernanza y clasificación asistida",
     "Determinación del régimen bajo el que se procesa cada incidencia, consumo del modelo de "
     "visión con esquema de respuesta estricto, y proceso de servicio que registra la "
     "recomendación sin aplicarla: la decisión corresponde siempre a una persona.",
     ["backend/app/services/governance.py", "backend/app/services/ai.py",
      "backend/app/workers/ai_worker.py"]),

    ("Georreferenciación y zonas del campus",
     "Resolución de la zona a partir de coordenadas mediante el método de proyección de "
     "rayos, con soporte de polígonos con huecos y desempate por prioridad, superficie y "
     "antigüedad; y captura de zonas recorriendo el campus con el receptor del teléfono.",
     ["backend/app/services/location_resolver.py", "frontend/lib/geo.ts",
      "frontend/components/zone-capture.tsx"]),

    ("Procesamiento asíncrono de trabajos",
     "Cola de trabajos implementada sobre la propia base de datos, con reserva exclusiva, "
     "vencimiento de reservas y reintentos con espera creciente.",
     ["backend/app/services/jobs.py"]),

    ("Notificaciones por correo y vigilancia del sistema",
     "Resolución de destinatarios por categoría y prioridad mínima, composición del mensaje "
     "con escapado del texto del usuario, despacho idempotente mediante clave de evento, y "
     "detección automática de procesos caídos, plazos vencidos y cuota agotada.",
     ["backend/app/services/notifications.py", "backend/app/services/monitoring.py",
      "backend/app/services/incident_events.py",
      "backend/app/workers/notification_worker.py"]),

    ("Gestión administrativa, triaje y moderación",
     "Operaciones reservadas al administrador —cuentas, personal, zonas, asignación y estado "
     "del sistema—, confirmación o corrección de la clasificación propuesta, moderación de la "
     "vista comunitaria, y panel del personal asignado.",
     ["backend/app/api/v1/admin.py", "backend/app/api/v1/staff.py",
      "backend/app/schemas/admin.py", "backend/app/schemas/staff.py",
      "frontend/app/(dashboard)/", "frontend/components/moderation-queue.tsx",
      "frontend/components/incidents-workspace.tsx",
      "frontend/components/admin-incidents-feed.tsx",
      "frontend/components/confirm-dialog.tsx"]),

    ("Consulta y seguimiento de incidencias",
     "Cliente de la interfaz de programación con su contrato de tipos, y superficies de "
     "consulta para estudiantes.",
     ["frontend/lib/api-client.ts", "frontend/components/student-incidents-feed.tsx"]),

    ("Mantenimiento y retención de datos",
     "Purga automática de incidencias terminales y de sus evidencias una vez cumplido el "
     "período de conservación, y respaldo cifrado opcional.",
     ["backend/app/services/maintenance.py", "backend/app/workers/maintenance_worker.py"]),

    ("Aplicación web progresiva, despliegue e integración continua",
     "Estructura común de la aplicación web, cabeceras de seguridad, manifiesto y service "
     "worker propios, íconos vectoriales de autoría propia, guiones de arranque y de "
     "comprobación, y definición del despliegue y de la verificación automática.",
     ["frontend/app/layout.tsx", "frontend/next.config.ts", "frontend/public/",
      "frontend/components/pwa-register.tsx", "render.yaml", "backend/start",
      "backend/stop", "backend/check_", ".github/"]),
]


def clasificar(archivos: list[Path]) -> tuple[list[tuple], list[Path]]:
    """Reparte cada archivo en la primera área cuyo prefijo coincida."""
    pendientes = list(archivos)
    resultado = []
    for titulo, descripcion, prefijos in AREAS:
        del_area = []
        for ruta in list(pendientes):
            relativa = ruta.relative_to(RAIZ).as_posix()
            if any(relativa.startswith(p) for p in prefijos):
                del_area.append(ruta)
                pendientes.remove(ruta)
        if del_area:
            resultado.append((titulo, descripcion, sorted(del_area)))
    return resultado, pendientes


# ------------------------------------------------------------------ documento

archivos = descubrir()
areas, sin_clasificar = clasificar(archivos)

if sin_clasificar:
    # No se descartan: entran igual. La completitud manda sobre el orden.
    areas.append((
        "Otros componentes del sistema",
        "Archivos de autoría propia que no encajan en las áreas anteriores. Se transcriben "
        "igualmente, para que el documento contenga la totalidad del código fuente.",
        sorted(sin_clasificar),
    ))

doc = nuevo_documento()
portada(doc, "CÓDIGO FUENTE DEL SOFTWARE")

h1(doc, "Alcance de este documento")
parrafo(doc,
    "Este documento contiene la totalidad del código fuente de autoría propia del software "
    "«Campus Alertas», organizado por áreas funcionales. Campus Alertas es una aplicación web "
    "progresiva de uso institucional, orientada al registro, la clasificación y la atención de "
    "incidencias ocurridas dentro de un campus universitario. Las áreas de este documento se "
    "corresponden con los módulos descritos en la Memoria Descriptiva, de modo que ambos "
    "documentos puedan consultarse en paralelo.")
parrafo(doc, STACK, negrita_hasta_punto=True)
parrafo(doc,
    "Criterio de inclusión. Se transcriben íntegramente todos los archivos de código fuente "
    "de autoría propia: los enrutadores de la interfaz de programación, los servicios de "
    "negocio, los procesos de servicio, las entidades persistentes, el esquema de base de "
    "datos y sus migraciones, los componentes y páginas de la aplicación web, el cliente de "
    "la interfaz de programación, el service worker y el manifiesto de la aplicación "
    "progresiva, los íconos vectoriales, los guiones de arranque y de comprobación, y la "
    "definición del despliegue y de la integración continua. Ningún archivo se transcribe de "
    "forma parcial. Cada uno se presenta con su ruta y su número de líneas; el código se "
    "muestra en tipografía monoespaciada dentro de recuadros, para distinguirlo claramente "
    "del texto descriptivo.",
    negrita_hasta_punto=True)
parrafo(doc,
    "Criterio de exclusión. No se incluye nada que no sea obra propia ni constituya código "
    "fuente: las dependencias de terceros (los directorios «node_modules» y «venv»), los "
    "artefactos de compilación (los directorios «.next» y «__pycache__»), los archivos de "
    "bloqueo y de caché de compilación («package-lock.json», «tsconfig.tsbuildinfo»), la "
    "configuración de las herramientas de desarrollo («tsconfig.json», «postcss.config.mjs», "
    "«eslint.config.mjs», «alembic.ini»), los manifiestos de dependencias, las hojas de "
    "estilo y las fotografías cargadas durante las pruebas.",
    negrita_hasta_punto=True)
parrafo(doc, RECURSOS_GRAFICOS, negrita_hasta_punto=True)
parrafo(doc, NOTA, negrita_hasta_punto=True)

indice(doc)
salto_de_pagina(doc)

total_archivos = 0
total_lineas = 0

for titulo, descripcion, rutas in areas:
    h1(doc, titulo)
    parrafo(doc, descripcion)
    for ruta in rutas:
        relativa = ruta.relative_to(RAIZ).as_posix()
        texto = ruta.read_text(encoding="utf-8", errors="replace")
        n = len(texto.splitlines())
        lenguaje = LENGUAJES.get(ruta.suffix, "texto")
        h2(doc, f"{relativa}   ({n} líneas · {lenguaje})")
        bloque_codigo(doc, texto, recortar=False)
        total_archivos += 1
        total_lineas += n

# La garantia de que el documento esta completo: si algo se descubrio pero no se
# transcribio, no se genera el documento en vez de entregarlo incompleto.
if total_archivos != len(archivos):
    raise SystemExit(
        f"Se descubrieron {len(archivos)} archivos pero se transcribieron "
        f"{total_archivos}. El documento debe contener el codigo completo."
    )

print(f"archivos transcritos: {total_archivos}")
print(f"lineas de codigo    : {total_lineas}")
guardar(doc, str(Path(__file__).parent / "Campus Alertas - 3 Codigo fuente del software (sin imagenes).docx"))
