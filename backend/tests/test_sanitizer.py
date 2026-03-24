from app.services.sanitizer import sanitize_description, sanitize_title


def test_sanitize_description_removes_control_chars_and_collapses_spaces() -> None:
    raw = "  fuga\x00de   gas\t\t  cerca  del  laboratorio  "
    sanitized = sanitize_description(raw)
    assert sanitized == "fuga de gas cerca del laboratorio"


def test_sanitize_description_truncates_to_280_chars() -> None:
    raw = "a" * 400
    assert len(sanitize_description(raw)) == 280


def test_sanitize_title_truncates_to_120_chars() -> None:
    raw = "  titulo\x00   de prueba   " + ("x" * 200)
    sanitized = sanitize_title(raw)
    assert sanitized.startswith("titulo de prueba")
    assert len(sanitized) == 120
