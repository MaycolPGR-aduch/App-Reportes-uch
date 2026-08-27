"""Comprueba un almacén compatible con S3 (Cloudflare R2, Backblaze, AWS).

Ejercita el ciclo completo con el mismo `S3StorageProvider` que usa la
aplicación: sube un objeto minúsculo, lo lee, compara la huella, comprueba que
un objeto ausente se reconoce como tal, y lo borra. Si esto pasa, las
credenciales sirven y el despliegue no fallará por el almacenamiento.

Nunca imprime la clave secreta. Ejecútalo antes de pegar las credenciales en el
panel de Render.

    $env:STORAGE_BACKEND    = "s3"
    $env:S3_BUCKET          = "campus-evidences"
    $env:S3_ENDPOINT_URL    = "https://<id-de-cuenta>.r2.cloudflarestorage.com"
    $env:S3_ACCESS_KEY_ID   = "..."
    $env:S3_SECRET_ACCESS_KEY = "..."
    python check_r2.py
"""

from __future__ import annotations

import hashlib
import sys

from app.core.config import get_settings
from app.services.storage import (
    EvidenceNotStored,
    S3StorageProvider,
    _build_relative_path,
)

# Un PNG de 1x1 real: el proveedor guarda bytes opacos, pero subir algo válido
# deja el bucket en un estado que se puede inspeccionar desde el panel.
PNG_MINIMO = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da63f8cf00000301010018dd8db00000000049454e44ae426082"
)

AUSENTE = "evidences/1970/01/01/" + "0" * 32 + ".webp"


def _oculto(valor: str | None) -> str:
    if not valor:
        return "(sin definir)"
    return f"{valor[:4]}…{valor[-2:]} ({len(valor)} caracteres)"


def main() -> int:
    ajustes = get_settings()

    print("Configuración")
    print(f"  STORAGE_BACKEND      : {ajustes.storage_backend}")
    print(f"  S3_BUCKET            : {ajustes.s3_bucket or '(sin definir)'}")
    print(f"  S3_ENDPOINT_URL      : {ajustes.s3_endpoint_url or '(sin definir)'}")
    print(f"  S3_REGION            : {ajustes.s3_region}")
    print(f"  S3_ACCESS_KEY_ID     : {_oculto(ajustes.s3_access_key_id)}")
    print(f"  S3_SECRET_ACCESS_KEY : {_oculto(ajustes.s3_secret_access_key)}")
    print()

    faltan = [
        nombre
        for nombre, valor in (
            ("S3_BUCKET", ajustes.s3_bucket),
            ("S3_ACCESS_KEY_ID", ajustes.s3_access_key_id),
            ("S3_SECRET_ACCESS_KEY", ajustes.s3_secret_access_key),
        )
        if not valor
    ]
    if faltan:
        print(f"Faltan variables: {', '.join(faltan)}")
        return 2

    almacen = S3StorageProvider(
        bucket=ajustes.s3_bucket,
        prefix=ajustes.s3_prefix,
        endpoint_url=ajustes.s3_endpoint_url,
        access_key_id=ajustes.s3_access_key_id,
        secret_access_key=ajustes.s3_secret_access_key,
        region=ajustes.s3_region,
    )

    print("Comprobaciones")

    # 1. Escritura
    try:
        guardado = almacen.save_incident_image(content=PNG_MINIMO, mime_type="image/png")
    except Exception as exc:
        print(f"  [FALLO] subir: {type(exc).__name__}: {exc}")
        return 1
    print(f"  [ok] subida            {guardado.relative_path}")

    # 2. Lectura, comparando la huella: no basta con que devuelva algo.
    try:
        recuperado = almacen.read(guardado.relative_path)
    except Exception as exc:
        print(f"  [FALLO] leer: {type(exc).__name__}: {exc}")
        return 1

    if hashlib.sha256(recuperado).hexdigest() != guardado.sha256_hash:
        print("  [FALLO] los bytes leídos no coinciden con los subidos")
        return 1
    print(f"  [ok] lectura           {len(recuperado)} bytes, sha256 coincide")

    # 3. Un objeto ausente debe dar 404, no un error del servidor.
    try:
        almacen.read(AUSENTE)
    except EvidenceNotStored:
        print("  [ok] objeto ausente    reconocido como tal")
    except Exception as exc:
        print(f"  [FALLO] un objeto ausente levanta {type(exc).__name__}: {exc}")
        print("         (el endpoint daría 500 en vez de 404)")
        return 1
    else:
        print("  [FALLO] leer un objeto inexistente devolvió contenido")
        return 1

    # 4. Borrado, para no dejar basura en el bucket.
    try:
        almacen.delete(guardado.relative_path)
    except Exception as exc:
        print(f"  [FALLO] borrar: {type(exc).__name__}: {exc}")
        return 1

    try:
        almacen.read(guardado.relative_path)
    except EvidenceNotStored:
        print("  [ok] borrado           el objeto ya no está")
    else:
        print("  [FALLO] el objeto sigue ahí tras borrarlo")
        return 1

    print(f"\nTambién se comprobó la forma de la clave: {_build_relative_path('image/webp', prefix=ajustes.s3_prefix)}")
    print("El almacén responde correctamente. Puedes usar estas credenciales en Render.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
