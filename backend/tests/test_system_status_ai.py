"""El panel de sistema es la única forma de enterarse de que la clasificación IA
cayó. Un fallo total no escribe ninguna fila en ai_metrics -- classify_incident
lanza antes de crearla -- así que el diagnóstico debe leer la cola de trabajos."""

from app.api.v1.admin import _looks_quota_exhausted


def test_detects_quota_exhaustion_from_http_429() -> None:
    assert _looks_quota_exhausted("HTTP 429: Too Many Requests")


def test_detects_quota_exhaustion_from_provider_403_message() -> None:
    """Regresión: TokenRouter responde 403 con texto de saldo, no 429.

    Buscar sólo "429" daba cuota agotada = NO con la cuenta a cero."""
    error = (
        "RuntimeError: request failed: HTTP 403: Your account quota is running low "
        "($0.00), Please recharge to continue using the service."
    )

    assert _looks_quota_exhausted(error)


def test_detects_rate_limit_wording() -> None:
    assert _looks_quota_exhausted("Provider returned: rate limit exceeded for this key")


def test_ignores_unrelated_failures() -> None:
    """Un modelo inexistente no es cuota agotada y no debe confundirse con ella."""
    error = (
        "RuntimeError: request failed: HTTP 503: {'code': 'model_not_found', "
        "'message': 'No available channel for model moonshotai/kimi-k3-free'}"
    )

    assert not _looks_quota_exhausted(error)


def test_ignores_empty_input() -> None:
    assert not _looks_quota_exhausted(None)
    assert not _looks_quota_exhausted("")
