from __future__ import annotations

import logging
import time

from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.services.maintenance import backup_evidences, purge_expired_incidents

logger = logging.getLogger(__name__)


def run_worker() -> None:
    while True:
        try:
            with SessionLocal() as db:
                removed = purge_expired_incidents(db)
            backed_up = backup_evidences()
            logger.info("maintenance_complete removed=%s backed_up=%s", removed, backed_up)
        except Exception:
            logger.exception("maintenance_failed")
        time.sleep(24 * 60 * 60)


if __name__ == "__main__":
    run_worker()
