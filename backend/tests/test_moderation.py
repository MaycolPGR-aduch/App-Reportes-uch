"""La visibilidad comunitaria la decide la IA cuando está disponible, pero la
palabra final es del administrador. Estas pruebas fijan cómo se deriva el estado
de moderación y cómo se traduce el veredicto de la IA al registro de auditoría."""

from types import SimpleNamespace

from app.api.v1.admin import _ai_verdict, _moderation_state


def _metric(**raw):
    return SimpleNamespace(raw_response=raw)


def _incident(visible: bool):
    return SimpleNamespace(is_community_visible=visible)


def _decision(published: bool):
    return SimpleNamespace(published=published)


def test_verdict_reports_not_evaluated_without_metric() -> None:
    """Un fallo total de la IA no escribe métrica, así que no hay veredicto."""
    evaluated, appropriate, is_incident, reason = _ai_verdict(None)

    assert evaluated is False
    assert appropriate is None and is_incident is None and reason is None


def test_verdict_reads_the_metric_payload() -> None:
    evaluated, appropriate, is_incident, reason = _ai_verdict(
        _metric(is_appropriate=False, is_incident=True, reason="Contenido no permitido")
    )

    assert evaluated is True
    assert appropriate is False
    assert is_incident is True
    assert reason == "Contenido no permitido"


def test_state_is_pending_when_ai_never_ran() -> None:
    """El caso de hoy: proveedor caído, la incidencia espera decisión humana."""
    state = _moderation_state(incident=_incident(False), metric=None, decision=None)

    assert state == "PENDIENTE_IA"


def test_state_is_rejected_when_ai_said_inappropriate() -> None:
    state = _moderation_state(
        incident=_incident(False),
        metric=_metric(is_appropriate=False, is_incident=True),
        decision=None,
    )

    assert state == "RECHAZADA_IA"


def test_state_is_rejected_when_ai_said_not_an_incident() -> None:
    state = _moderation_state(
        incident=_incident(False),
        metric=_metric(is_appropriate=True, is_incident=False),
        decision=None,
    )

    assert state == "RECHAZADA_IA"


def test_state_is_published_by_ai_when_visible_and_approved() -> None:
    state = _moderation_state(
        incident=_incident(True),
        metric=_metric(is_appropriate=True, is_incident=True),
        decision=None,
    )

    assert state == "PUBLICADA_IA"


def test_a_manual_decision_overrides_the_ai_verdict() -> None:
    """El administrador puede publicar lo que la IA rechazó; el estado debe
    dejar claro que fue una persona, no la máquina."""
    state = _moderation_state(
        incident=_incident(True),
        metric=_metric(is_appropriate=False, is_incident=False),
        decision=_decision(True),
    )

    assert state == "PUBLICADA_MANUAL"


def test_a_manual_hide_overrides_an_ai_approval() -> None:
    state = _moderation_state(
        incident=_incident(False),
        metric=_metric(is_appropriate=True, is_incident=True),
        decision=_decision(False),
    )

    assert state == "OCULTA_MANUAL"


def test_label_falls_back_when_the_decision_no_longer_matches_reality() -> None:
    """La etiqueta no debe anclarse al histórico.

    Si la visibilidad cambió sin dejar decisión, decir "publicada por un
    administrador" sobre una incidencia oculta contradice al propio botón.
    """
    state = _moderation_state(
        incident=_incident(False),          # realmente oculta
        metric=None,
        decision=_decision(True),           # la última decisión decía publicar
    )

    assert state != "PUBLICADA_MANUAL"
    assert state == "PENDIENTE_IA"


def test_label_falls_back_the_other_way_too() -> None:
    state = _moderation_state(
        incident=_incident(True),           # realmente visible
        metric=None,
        decision=_decision(False),          # la última decisión decía ocultar
    )

    assert state != "OCULTA_MANUAL"
    assert state == "PUBLICADA_IA"
