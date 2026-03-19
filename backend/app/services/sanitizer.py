from __future__ import annotations

import re

CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MULTISPACE_PATTERN = re.compile(r"\s+")


def sanitize_description(raw: str) -> str:
    without_control = CONTROL_CHAR_PATTERN.sub(" ", raw)
    normalized = MULTISPACE_PATTERN.sub(" ", without_control).strip()
    return normalized[:280]

