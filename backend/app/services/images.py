from __future__ import annotations

from io import BytesIO

from PIL import Image, UnidentifiedImageError


ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
PIL_FORMAT_TO_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


class InvalidImageError(ValueError):
    pass


def normalize_image(content: bytes, *, declared_mime: str | None, max_pixels: int) -> tuple[bytes, str]:
    if declared_mime not in ALLOWED_IMAGE_TYPES:
        raise InvalidImageError("Unsupported image type")
    try:
        with Image.open(BytesIO(content)) as source:
            source.verify()
        with Image.open(BytesIO(content)) as source:
            actual_mime = PIL_FORMAT_TO_MIME.get(source.format or "")
            if actual_mime is None or actual_mime != declared_mime:
                raise InvalidImageError("Image content does not match its declared type")
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > max_pixels:
                raise InvalidImageError("Image dimensions exceed the allowed limit")
            # Re-encoding removes EXIF and other metadata, including embedded GPS.
            image = source.convert("RGB")
            output = BytesIO()
            image.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue(), "image/jpeg"
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        if isinstance(exc, InvalidImageError):
            raise
        raise InvalidImageError("Invalid or corrupted image") from exc
