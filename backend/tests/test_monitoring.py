"""El panel de administración solo informa si alguien entra a mirarlo, y por eso
la caída de la IA pasó dos semanas inadvertida. Estas pruebas fijan cuándo el
sistema avisa por su cuenta y —igual de importante— cuándo se calla."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.incident_events import _acaba_de_resolverse
from app.services.monitoring import looks_quota_exhausted
from app.workers.maintenance_worker import _toca

AHORA = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


# --------------------------------------------------- planificador periódico

def test_la_primera_vuelta_ejecuta_todo() -> None:
    """Tras reiniciar no hay calendario: preferible repetir que saltarse una revisión."""
    assert _toca(None, timedelta(hours=24), AHORA) is True


def test_no_repite_antes_de_cumplirse_el_intervalo() -> None:
    hace_diez_minutos = AHORA - timedelta(minutes=10)

    assert _toca(hace_diez_minutos, timedelta(minutes=15), AHORA) is False


def test_ejecuta_al_cumplirse_el_intervalo_exacto() -> None:
    justo = AHORA - timedelta(minutes=15)

    assert _toca(justo, timedelta(minutes=15), AHORA) is True


# ------------------------------------------------------ detección de cuota

def test_detecta_cuota_por_mensaje_del_proveedor() -> None:
    """Regresión: TokenRouter responde 403 con texto de saldo, no 429."""
    error = "HTTP 403: Your account quota is running low ($0.00), Please recharge"

    assert looks_quota_exhausted(error)


def test_un_modelo_inexistente_no_es_cuota_agotada() -> None:
    assert not looks_quota_exhausted("HTTP 503: {'code': 'model_not_found'}")


# ----------------------------------------- transición a incidencia resuelta

class _Historial:
    def __init__(self, cambios: bool, anterior=None):
        self._cambios = cambios
        self.deleted = [anterior] if anterior is not None else []

    def has_changes(self):
        return self._cambios


def _incidencia(estado, *, cambios=True, anterior=None):
    """Imita lo que `inspect(obj).attrs.status.history` devuelve."""
    historial = _Historial(cambios, anterior)
    objeto = SimpleNamespace(status=estado)
    objeto._sa_instance_state = SimpleNamespace(
        attrs=SimpleNamespace(status=SimpleNamespace(history=historial))
    )
    return objeto


@pytest.fixture(autouse=True)
def _sin_inspect(monkeypatch):
    """`inspect` sobre un objeto simulado: se sustituye por su estado fingido."""
    import app.services.incident_events as modulo

    monkeypatch.setattr(modulo, "inspect", lambda obj: obj._sa_instance_state)


def test_detecta_la_transicion_a_resuelta() -> None:
    from app.models.enums import IncidentStatus

    incidencia = _incidencia(
        IncidentStatus.RESOLVED, cambios=True, anterior=IncidentStatus.IN_PROGRESS
    )

    assert _acaba_de_resolverse(incidencia) is True


def test_no_avisa_si_ya_estaba_resuelta() -> None:
    """Guardar de nuevo una incidencia ya cerrada no debe generar otro correo."""
    from app.models.enums import IncidentStatus

    incidencia = _incidencia(
        IncidentStatus.RESOLVED, cambios=True, anterior=IncidentStatus.RESOLVED
    )

    assert _acaba_de_resolverse(incidencia) is False


def test_no_avisa_sin_cambio_de_estado() -> None:
    from app.models.enums import IncidentStatus

    incidencia = _incidencia(IncidentStatus.RESOLVED, cambios=False)

    assert _acaba_de_resolverse(incidencia) is False


def test_no_avisa_al_pasar_a_otro_estado() -> None:
    from app.models.enums import IncidentStatus

    incidencia = _incidencia(
        IncidentStatus.IN_PROGRESS, cambios=True, anterior=IncidentStatus.REPORTED
    )

    assert _acaba_de_resolverse(incidencia) is False

