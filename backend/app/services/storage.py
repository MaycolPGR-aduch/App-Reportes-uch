from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from uuid import uuid4


@dataclass(frozen=True)
class StoredFile:
    relative_path: str
    absolute_path: str
    sha256_hash: str
    size_bytes: int
    mime_type: str


class StorageProvider:
    def save_incident_image(self, *, content: bytes, mime_type: str) -> StoredFile:
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    EXT_BY_MIME = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_incident_image(self, *, content: bytes, mime_type: str) -> StoredFile:
        extension = self.EXT_BY_MIME.get(mime_type)
        if extension is None:
            raise ValueError(f"Unsupported mime type: {mime_type}")

        now = datetime.utcnow()
        folder = self.base_dir / f"{now:%Y}" / f"{now:%m}" / f"{now:%d}"
        folder.mkdir(parents=True, exist_ok=True)

        file_name = f"{uuid4().hex}{extension}"
        absolute_path = folder / file_name
        absolute_path.write_bytes(content)

        sha256_hash = hashlib.sha256(content).hexdigest()
        return StoredFile(
            relative_path=str(absolute_path.relative_to(self.base_dir.parent)).replace(
                "\\", "/"
            ),
            absolute_path=str(absolute_path),
            sha256_hash=sha256_hash,
            size_bytes=len(content),
            mime_type=mime_type,
        )

