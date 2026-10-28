"""Diagnóstico de evidencias: solo lectura, nunca elimina ni modifica objetos."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence import IncidentEvidence
from app.models.evidence_deletion import EvidenceDeletion
from app.services.storage import LocalStorageProvider, S3StorageProvider


@dataclass(frozen=True)
class InventoryResult:
    orphan_candidates: tuple[str, ...]
    missing_candidates: tuple[str, ...]


def compare_inventory(referenced: set[str], pending_deletion: set[str],
                      stored: set[str]) -> InventoryResult:
    """Compara instantáneas; son candidatos, no autorización para borrar."""
    return InventoryResult(tuple(sorted(stored - referenced - pending_deletion)),
                           tuple(sorted(referenced - stored)))


def inventory(db: Session, provider: LocalStorageProvider | S3StorageProvider,
              *, grace_hours: int = 24) -> InventoryResult:
    if grace_hours < 1:
        raise ValueError("grace_hours debe ser al menos 1")
    cutoff = datetime.now(timezone.utc) - timedelta(hours=grace_hours)
    # Se incluyen referencias recientes para evitar falsos huérfanos; solo se
    # notifican faltantes de filas anteriores al periodo de gracia.
    rows = db.execute(select(IncidentEvidence.storage_path, IncidentEvidence.created_at)).all()
    all_refs = {path for path, _ in rows}
    old_refs = {path for path, created in rows if created and created <= cutoff}
    pending = set(db.scalars(select(EvidenceDeletion.storage_path)).all())
    all_stored: set[str] = set()
    old_stored: set[str] = set()
    if isinstance(provider, LocalStorageProvider):
        root = provider.base_dir.resolve()
        if not root.is_dir():
            raise RuntimeError("No se encuentra el directorio del almacén")
        for path in root.rglob("*"):
            if path.is_symlink() or not path.is_file():
                continue
            relative = Path(root.name) / path.relative_to(root)
            key = relative.as_posix()
            all_stored.add(key)
            if datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) <= cutoff:
                old_stored.add(key)
    else:
        prefix = provider.prefix.strip("/")
        if not prefix:
            raise ValueError("S3_PREFIX debe identificar un prefijo no vacío")
        pages = provider._client.get_paginator("list_objects_v2").paginate(
            Bucket=provider.bucket, Prefix=prefix + "/")
        for page in pages:
            for item in page.get("Contents", []):
                key = item["Key"]
                all_stored.add(key)
                if item["LastModified"] <= cutoff:
                    old_stored.add(key)
    return InventoryResult(tuple(sorted(old_stored - all_refs - pending)),
                           tuple(sorted(old_refs - all_stored)))
