from io import BytesIO

import pytest
from PIL import Image

from app.services.images import InvalidImageError, normalize_image


def test_normalize_image_reencodes_and_removes_declared_png() -> None:
    image = Image.new("RGB", (10, 10), color="red")
    source = BytesIO()
    image.save(source, format="PNG")

    content, mime_type = normalize_image(
        source.getvalue(), declared_mime="image/png", max_pixels=100
    )

    assert mime_type == "image/jpeg"
    with Image.open(BytesIO(content)) as output:
        assert output.format == "JPEG"


def test_normalize_image_rejects_mismatched_mime() -> None:
    image = Image.new("RGB", (10, 10))
    source = BytesIO()
    image.save(source, format="PNG")

    with pytest.raises(InvalidImageError):
        normalize_image(source.getvalue(), declared_mime="image/jpeg", max_pixels=100)
