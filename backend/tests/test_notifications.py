from app.services.notifications import _normalize_recipients


def test_normalize_recipients_deduplicates_and_trims() -> None:
    normalized = _normalize_recipients(
        ["  SEGURIDAD@campus.edu ", "seguridad@campus.edu", "limpieza@campus.edu  "]
    )
    assert normalized == ["limpieza@campus.edu", "seguridad@campus.edu"]


def test_normalize_recipients_ignores_empty_values() -> None:
    normalized = _normalize_recipients([" ", "", "  mantenimiento@campus.edu "])
    assert normalized == ["mantenimiento@campus.edu"]

