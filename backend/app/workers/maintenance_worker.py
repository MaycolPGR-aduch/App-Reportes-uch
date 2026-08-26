"""Tareas periódicas: retención de datos, salud del sistema y plazos vencidos.

Antes dormía 24 horas entre ciclos, lo que servía para purgar pero era inútil
para vigilar un plazo de dos horas o para notar que un proceso murió. Ahora
sondea cada minuto y cada tarea se regula por su propio intervalo.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.services.maintenance import backup_evidences, purge_expired_incidents
from app.services.monitoring import revisar_plazos, revisar_salud

logger = logging.getLogger("campus.workers.maintenance")

SONDEO_SEGUNDOS = 60
INTERVALO_RETENCION = timedelta(hours=24)


def _toca(ultima: datetime | None, intervalo: timedelta, ahora: datetime) -> bool:
    """Primera vuelta tras arrancar: se ejecuta todo, que es lo deseado."""
    return ultima is None or ahora - ultima >= intervalo


def run_worker() -> None:
    settings = get_settings()
    intervalo_vigilancia = timedelta(minutes=settings.monitor_interval_minutes)

    # El calendario vive en memoria del proceso. Un reinicio hace que la primera
    # vuelta ejecute todo: preferible a saltarse una revisión por prudencia.
    ultima_retencion: datetime | None = None
    ultima_vigilancia: datetime | None = None

    while True:
        try:
            ahora = datetime.now(timezone.utc)

            if _toca(ultima_retencion, INTERVALO_RETENCION, ahora):
                with SessionLocal() as db:
                    eliminadas = purge_expired_incidents(db)
                respaldadas = backup_evidences()
                ultima_retencion = ahora
                logger.info(
                    "retencion_completa eliminadas=%s respaldadas=%s", eliminadas, respaldadas
                )

            if _toca(ultima_vigilancia, intervalo_vigilancia, ahora):
                with SessionLocal() as db:
                    avisos = revisar_salud(db, ahora=ahora)
                with SessionLocal() as db:
                    plazos = revisar_plazos(db, ahora=ahora)
                ultima_vigilancia = ahora
                if avisos or plazos:
                    logger.info("vigilancia avisos=%s plazos_encolados=%s", avisos, plazos)

        except Exception:
            # Una tarea que falla no debe detener el bucle: el proceso muere en
            # silencio y solo se nota como estado rezagado en el panel.
            logger.exception("mantenimiento_fallido")

        time.sleep(SONDEO_SEGUNDOS)


if __name__ == "__main__":
    run_worker()
