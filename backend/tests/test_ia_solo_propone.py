"""La IA propone; no decide.

Hasta ahora el worker reescribia categoria, prioridad, estado y visibilidad, y
creaba asignaciones. Eso hacia imposible el estudio que compara moderar con IA
frente a moderar sin ella: el brazo "asistido" no era asistido sino automatico,
y la persona no tenia ningun punto donde aceptar o corregir.

Estas comprobaciones son estructurales a proposito. Lo que hay que garantizar
no es que cierta logica calcule bien, sino que este modulo **no tenga la
capacidad** de escribir en la incidencia. Un caso de prueba solo demostraria que
no lo hace con esas entradas concretas; recorrer el arbol sintactico demuestra
que no hay ninguna linea que pueda hacerlo, con cualquier entrada.
"""

import ast
import io
from pathlib import Path

import pytest

RUTA = Path(__file__).resolve().parents[1] / "app" / "workers" / "ai_worker.py"

#: Lo unico que el worker puede tocar de la incidencia. Marcarla como pendiente
#: de revision no es un veredicto: dice "hay algo que mirar", que es cierto.
CAMPOS_PERMITIDOS = {"status"}

#: Campos cuya escritura convertiria a la IA en decisora otra vez.
CAMPOS_DE_DECISION = {"category", "priority", "is_community_visible"}


@pytest.fixture(scope="module")
def arbol() -> ast.Module:
    return ast.parse(io.open(RUTA, encoding="utf-8").read())


def _atributos_escritos(arbol: ast.Module, sobre: str) -> set[str]:
    """Atributos de `sobre` que aparecen a la izquierda de una asignacion."""
    escritos: set[str] = set()
    for nodo in ast.walk(arbol):
        destinos: list[ast.expr] = []
        if isinstance(nodo, ast.Assign):
            destinos = list(nodo.targets)
        elif isinstance(nodo, (ast.AugAssign, ast.AnnAssign)):
            destinos = [nodo.target]
        for destino in destinos:
            if (
                isinstance(destino, ast.Attribute)
                and isinstance(destino.value, ast.Name)
                and destino.value.id == sobre
            ):
                escritos.add(destino.attr)
    return escritos


def test_el_worker_no_decide_por_la_incidencia(arbol) -> None:
    escritos = _atributos_escritos(arbol, "incident")

    prohibidos = escritos & CAMPOS_DE_DECISION
    assert not prohibidos, (
        f"el worker vuelve a escribir {sorted(prohibidos)} en la incidencia; "
        "eso convierte el brazo asistido en automatico y anula la comparacion"
    )


def test_el_worker_solo_toca_lo_permitido(arbol) -> None:
    escritos = _atributos_escritos(arbol, "incident")

    assert escritos <= CAMPOS_PERMITIDOS, (
        f"campos inesperados: {sorted(escritos - CAMPOS_PERMITIDOS)}"
    )


def test_el_worker_no_crea_asignaciones(arbol) -> None:
    """Asignar personal es una decision humana con su propio endpoint."""
    llamadas = {
        nodo.func.id
        for nodo in ast.walk(arbol)
        if isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name)
    }

    assert "IncidentAssignment" not in llamadas
    assert "_create_or_update_assignment" not in llamadas


def test_el_worker_sigue_guardando_la_propuesta(arbol) -> None:
    """Quitarle la decision no puede llevarse por delante el registro: el
    AIMetric es el dato con el que el paper mide si la IA acertaba."""
    llamadas = {
        nodo.func.id
        for nodo in ast.walk(arbol)
        if isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name)
    }

    assert "AIMetric" in llamadas, "sin AIMetric no queda constancia de la recomendacion"


def test_no_quedan_interruptores_que_reactiven_la_decision(arbol) -> None:
    """`AI_MODERATION_ENABLED` y `AUTO_ASSIGN_ENABLED` se retiraron. Que
    reaparezcan aqui significaria que alguien devolvio la automatizacion."""
    fuente = io.open(RUTA, encoding="utf-8").read()

    assert "ai_moderation_enabled" not in fuente
    assert "auto_assign_enabled" not in fuente
