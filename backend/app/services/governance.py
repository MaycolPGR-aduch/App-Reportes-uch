"""Con qué régimen se procesa cada incidencia.

El paper compara dos brazos: uno sin IA y otro donde la IA propone y una
persona decide. Para que la comparación se sostenga, cada incidencia tiene que
llevar escrito bajo cuál se procesó — no basta consultar el ajuste global, que
puede cambiar a mitad del estudio y dejaría las incidencias anteriores
atribuidas al brazo equivocado.
"""

from __future__ import annotations

import secrets

from app.models.enums import GovernanceMode

#: Los dos brazos del experimento. `AI_AUTONOMOUS` no está: existe solo para
#: etiquetar lo procesado antes de todo esto, no para operar.
BRAZOS = (GovernanceMode.MANUAL, GovernanceMode.AI_ASSISTED)

#: Valor del ajuste que reparte al azar en vez de fijar un modo.
REPARTO_ALEATORIO = "RANDOM"


def resolver_modo(ajuste: str | None) -> GovernanceMode:
    """Traduce el ajuste global al modo de esta incidencia concreta.

    Con `RANDOM` cada incidencia cae en un brazo al azar. Repartir así en vez de
    por periodos evita que el brazo quede confundido con el momento: una semana
    de exámenes o de lluvias cambia qué se reporta, y comparando periodos no
    habría forma de separar ese efecto del régimen de moderación.

    Se usa `secrets` y no `random` no por criptografía, sino porque su estado no
    lo comparte nadie: un `random` sembrado en otra parte del proceso podría
    volver predecible el reparto sin que se notara.
    """
    valor = (ajuste or "").strip().upper()

    if valor == REPARTO_ALEATORIO:
        return BRAZOS[secrets.randbelow(len(BRAZOS))]

    try:
        modo = GovernanceMode(valor)
    except ValueError:
        # Un ajuste ilegible no debe dejar incidencias sin modo ni provocar un
        # error al reportar. Se cae al brazo asistido, que es el comportamiento
        # histórico, y quien revise los datos vera que el reparto no cuadra.
        return GovernanceMode.AI_ASSISTED

    if modo not in BRAZOS:
        # `AI_AUTONOMOUS` no se puede pedir: describe el pasado, no un modo
        # operativo. Configurarlo seria reintroducir la IA decidiendo sola.
        return GovernanceMode.AI_ASSISTED

    return modo


def se_clasifica(modo: GovernanceMode, *, en_sombra: bool) -> bool:
    """Si a esta incidencia se le pide una predicción a la IA.

    Antes esta pregunta y la de si alguien ve la predicción eran la misma, y
    el brazo manual no se clasificaba nunca. Eso dejaba sin respuesta la
    comparación que exige el marco de evaluación del estudio: cómo lo habría
    hecho la IA sola sobre las incidencias que decidió una persona sin ayuda.

    Con `en_sombra`, el brazo manual también se clasifica, pero la predicción
    no llega nunca a quien decide (ver `recomendacion_visible`). El brazo
    sigue siendo manual para la persona, y el estudio gana la contrafactual.
    """
    if modo is GovernanceMode.AI_ASSISTED:
        return True
    if modo is GovernanceMode.MANUAL:
        return en_sombra
    # AI_AUTONOMOUS describe el pasado; no reactiva nada.
    return False


def recomendacion_visible(modo: GovernanceMode) -> bool:
    """Si quien tría y modera puede ver lo que propuso la IA.

    Es la única diferencia entre los dos brazos, y por eso vive en un solo
    sitio: toda vista, registro o decisión que muestre o use la propuesta pasa
    por aquí. Si un camino se la saltara, el brazo manual dejaría de serlo sin
    que nada lo advirtiera.
    """
    return modo is GovernanceMode.AI_ASSISTED
