"""El listado global de asignaciones marca cuales estan vencidas.

Se calcula en el servidor para que no dependa del reloj del navegador, y
tiene tres casos que conviene dejar fijados: con plazo pasado y sin
completar (vencida), completada aunque el plazo pasara (no: ya se atendio),
y sin plazo (no hay nada que vencer).
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.api.v1.admin import esta_vencida

AHORA = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
HACE_UN_DIA = AHORA - timedelta(days=1)
EN_UN_DIA = AHORA + timedelta(days=1)


def _asignacion(due_at, completed_at=None):
    return SimpleNamespace(due_at=due_at, completed_at=completed_at)


def test_plazo_pasado_sin_completar_esta_vencida() -> None:
    assert esta_vencida(_asignacion(HACE_UN_DIA), AHORA) is True


def test_plazo_futuro_no_esta_vencida() -> None:
    assert esta_vencida(_asignacion(EN_UN_DIA), AHORA) is False


def test_completada_no_esta_vencida_aunque_el_plazo_pasara() -> None:
    """Ya se atendio: marcarla vencida seria un falso positivo permanente."""
    assert esta_vencida(_asignacion(HACE_UN_DIA, completed_at=HACE_UN_DIA), AHORA) is False


def test_sin_plazo_no_esta_vencida() -> None:
    assert esta_vencida(_asignacion(None), AHORA) is False


def test_el_instante_exacto_del_plazo_no_cuenta_como_vencida() -> None:
    """El limite es inclusivo: en el segundo del vencimiento aun se esta a tiempo."""
    assert esta_vencida(_asignacion(AHORA), AHORA) is False
