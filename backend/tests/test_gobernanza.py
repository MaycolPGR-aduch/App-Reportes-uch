"""El paper compara dos regimenes de moderacion, y la comparacion solo vale si
cada incidencia lleva escrito bajo cual se proceso.

El interruptor que existia antes no servia: `AI_MODERATION_ENABLED=false` solo
tapaba la publicacion, mientras la IA seguia llamandose y seguia reescribiendo
categoria y prioridad. Un brazo "manual" montado sobre el habria medido
decision de IA con la publicacion oculta.
"""

from collections import Counter

import pytest

from app.models.enums import GovernanceMode
from app.services.governance import BRAZOS, resolver_modo, usa_ia


# ------------------------------------------------- traduccion del ajuste

@pytest.mark.parametrize(
    "ajuste, esperado",
    [
        ("MANUAL", GovernanceMode.MANUAL),
        ("AI_ASSISTED", GovernanceMode.AI_ASSISTED),
        ("manual", GovernanceMode.MANUAL),          # sin distinguir mayusculas
        ("  AI_ASSISTED  ", GovernanceMode.AI_ASSISTED),  # con espacios de sobra
    ],
)
def test_un_modo_fijo_se_respeta(ajuste, esperado) -> None:
    assert resolver_modo(ajuste) is esperado


@pytest.mark.parametrize("ajuste", ["", None, "LO_QUE_SEA", "AI-ASSISTED"])
def test_un_ajuste_ilegible_no_deja_la_incidencia_sin_modo(ajuste) -> None:
    """Reportar no puede fallar por una variable mal escrita, y ninguna
    incidencia debe quedarse sin brazo asignado."""
    assert resolver_modo(ajuste) in BRAZOS


def test_no_se_puede_pedir_el_regimen_antiguo() -> None:
    """`AI_AUTONOMOUS` describe lo ya ocurrido, no es un modo operativo:
    configurarlo seria devolverle a la IA la capacidad de decidir sola."""
    assert resolver_modo("AI_AUTONOMOUS") is not GovernanceMode.AI_AUTONOMOUS
    assert resolver_modo("AI_AUTONOMOUS") in BRAZOS


# ------------------------------------------------------ reparto aleatorio

def test_el_reparto_aleatorio_usa_los_dos_brazos() -> None:
    reparto = Counter(resolver_modo("RANDOM") for _ in range(600))

    assert set(reparto) == set(BRAZOS), f"algun brazo no salio nunca: {reparto}"


def test_el_reparto_aleatorio_esta_equilibrado() -> None:
    """No se exige exactitud --es azar-- pero un sesgo grande delataria un
    reparto roto, y con el se irian al traste las comparaciones."""
    n = 2000
    reparto = Counter(resolver_modo("RANDOM") for _ in range(n))

    for brazo in BRAZOS:
        proporcion = reparto[brazo] / n
        assert 0.42 < proporcion < 0.58, f"{brazo} salio el {proporcion:.0%} de las veces"


def test_el_reparto_no_devuelve_nunca_el_regimen_antiguo() -> None:
    assert GovernanceMode.AI_AUTONOMOUS not in {
        resolver_modo("RANDOM") for _ in range(400)
    }


# --------------------------------------------- a quien se le llama la IA

def test_solo_el_modo_asistido_llama_a_la_ia() -> None:
    """Lo que hace limpio el brazo manual: sin trabajo encolado no hay ningun
    proceso que pueda tocar la incidencia despues."""
    assert usa_ia(GovernanceMode.AI_ASSISTED) is True
    assert usa_ia(GovernanceMode.MANUAL) is False


def test_el_regimen_antiguo_tampoco_llamaria_a_la_ia() -> None:
    """Ninguna incidencia deberia tenerlo, pero si alguna lo tuviera no debe
    reactivar la clasificacion automatica."""
    assert usa_ia(GovernanceMode.AI_AUTONOMOUS) is False
