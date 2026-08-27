from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


@dataclass(frozen=True)
class StoredFile:
    relative_path: str
    absolute_path: str
    sha256_hash: str
    size_bytes: int
    mime_type: str


class EvidenceNotStored(Exception):
    """El archivo consta en la base pero no está en el almacén.

    Se distingue de un fallo del almacén: aquí la respuesta correcta es 404, no
    500, porque la incidencia existe y lo que falta es solo su imagen.
    """


class StorageProvider:
    def save_incident_image(self, *, content: bytes, mime_type: str) -> StoredFile:
        raise NotImplementedError

    def read(self, relative_path: str) -> bytes:
        """Devuelve el contenido, o levanta `EvidenceNotStored` si no está."""
        raise NotImplementedError

    def delete(self, relative_path: str) -> None:
        raise NotImplementedError


def _build_relative_path(mime_type: str, *, prefix: str) -> str:
    """Ruta con la fecha en el camino, común a todos los almacenes.

    Que local y S3 generen exactamente la misma clave no es casualidad: hace que
    `evidences.storage_path` signifique lo mismo con cualquiera de los dos, y que
    migrar de uno a otro sea copiar archivos sin tocar la base.
    """
    extension = EXT_BY_MIME.get(mime_type)
    if extension is None:
        raise ValueError(f"Unsupported mime type: {mime_type}")
    now = datetime.now(timezone.utc)
    return f"{prefix}/{now:%Y}/{now:%m}/{now:%d}/{uuid4().hex}{extension}"


class LocalStorageProvider(StorageProvider):
    EXT_BY_MIME = EXT_BY_MIME

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve(self, relative_path: str) -> Path | None:
        """Ruta absoluta dentro del almacén, o `None` si intenta salirse.

        `storage_path` viene de la base de datos, pero eso no lo vuelve de fiar:
        basta una fila manipulada para que `../../` apunte fuera del almacén.
        """
        candidate = (self.base_dir.parent / relative_path).resolve()
        if self.base_dir.parent.resolve() not in candidate.parents:
            return None
        return candidate

    def save_incident_image(self, *, content: bytes, mime_type: str) -> StoredFile:
        relative_path = _build_relative_path(mime_type, prefix=self.base_dir.name)
        absolute_path = self.base_dir.parent / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_bytes(content)

        return StoredFile(
            relative_path=relative_path,
            absolute_path=str(absolute_path),
            sha256_hash=hashlib.sha256(content).hexdigest(),
            size_bytes=len(content),
            mime_type=mime_type,
        )

    def read(self, relative_path: str) -> bytes:
        candidate = self._resolve(relative_path)
        if candidate is None or not candidate.exists():
            raise EvidenceNotStored(relative_path)
        return candidate.read_bytes()

    def delete(self, relative_path: str) -> None:
        candidate = self._resolve(relative_path)
        if candidate is None:
            return
        candidate.unlink(missing_ok=True)


class S3StorageProvider(StorageProvider):
    """Almacén de objetos compatible con S3 (Cloudflare R2, Backblaze B2, AWS).

    El servidor descarga el objeto y lo reenvía en vez de redirigir a una URL
    firmada. Es un salto de red extra, pero conserva intacto el control de acceso
    que ya hacen los endpoints: sin esto, cualquiera con el enlace vería la
    evidencia aunque no tuviera permiso sobre la incidencia.
    """

    def __init__(
        self,
        *,
        bucket: str,
        prefix: str = "evidences",
        endpoint_url: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
        region: str = "auto",
    ) -> None:
        try:
            import boto3
        except ImportError as exc:  # pragma: no cover - dependencia declarada
            raise RuntimeError(
                "boto3 is required when STORAGE_BACKEND=s3"
            ) from exc

        self.bucket = bucket
        self.prefix = prefix.strip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )

    def save_incident_image(self, *, content: bytes, mime_type: str) -> StoredFile:
        key = _build_relative_path(mime_type, prefix=self.prefix)
        self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=mime_type,
        )
        return StoredFile(
            relative_path=key,
            absolute_path=f"s3://{self.bucket}/{key}",
            sha256_hash=hashlib.sha256(content).hexdigest(),
            size_bytes=len(content),
            mime_type=mime_type,
        )

    def read(self, relative_path: str) -> bytes:
        try:
            response = self._client.get_object(
                Bucket=self.bucket, Key=relative_path.lstrip("/")
            )
        except self._client.exceptions.NoSuchKey as exc:
            raise EvidenceNotStored(relative_path) from exc
        return response["Body"].read()

    def delete(self, relative_path: str) -> None:
        # `delete_object` no falla si la clave no existe, así que purgar dos
        # veces la misma incidencia es inofensivo.
        self._client.delete_object(Bucket=self.bucket, Key=relative_path.lstrip("/"))


@lru_cache(maxsize=1)
def get_storage_provider() -> StorageProvider:
    """Proveedor según la configuración. Cacheado: crear el cliente de boto3 en
    cada subida añadiría latencia sin motivo."""
    from app.core.config import get_settings

    settings = get_settings()
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise RuntimeError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        return S3StorageProvider(
            bucket=settings.s3_bucket,
            prefix=settings.s3_prefix,
            endpoint_url=settings.s3_endpoint_url,
            access_key_id=settings.s3_access_key_id,
            secret_access_key=settings.s3_secret_access_key,
            region=settings.s3_region,
        )
    return LocalStorageProvider(settings.local_storage_path)
