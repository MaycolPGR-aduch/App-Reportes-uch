from __future__ import annotations

import logging
import socket
import time
from pathlib import Path

from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.models.ai_metric import AIMetric
from app.models.enums import IncidentStatus, JobType, PriorityLevel
from app.models.incident import Incident
from app.services.ai import AIClassificationError, classify_incident
from app.services.jobs import claim_next_job, complete_job, fail_job, recover_expired_leases

logger = logging.getLogger("campus.workers.ai")

def _safe_load_evidence_bytes(
    *,
    storage_root: Path,
    relative_path: str | None,
    max_bytes: int = 4 * 1024 * 1024,
) -> bytes | None:
    if not relative_path:
        return None
    try:
        candidate = (storage_root.parent / relative_path).resolve()
        storage_parent = storage_root.parent.resolve()
        if storage_parent not in candidate.parents and candidate != storage_parent:
            return None
        if not candidate.exists() or not candidate.is_file():
            return None
        file_size = candidate.stat().st_size
        if file_size <= 0 or file_size > max_bytes:
            return None
        return candidate.read_bytes()
    except Exception:
        return None


def _run_iteration(*, worker_id: str, poll: float) -> None:
    settings = get_settings()

    with SessionLocal() as db:
        recover_expired_leases(db, lease_seconds=settings.job_lease_seconds)
        job = claim_next_job(db, job_type=JobType.CLASSIFY_INCIDENT, worker_id=worker_id)
        if job is None:
            db.commit()
            time.sleep(poll)
            return
        # Persist the lease before any external provider request.
        db.commit()

        incident = (
            db.query(Incident)
            .options(joinedload(Incident.evidences))
            .filter(Incident.id == job.incident_id)
            .first()
        )
        if incident is None:
            fail_job(
                db,
                job,
                error_message="Incident not found for classification",
                retry_delay_seconds=settings.classification_retry_delay_seconds,
            )
            db.commit()
            return

        # A duplicate outbox job must not trigger another paid/free provider call.
        # The successful result is immutable per incident and is the source read by
        # every dashboard, so completing this job is sufficient.
        existing_metric = (
            db.query(AIMetric).filter(AIMetric.incident_id == incident.id).first()
        )
        if existing_metric is not None:
            complete_job(db, job)
            db.commit()
            logger.info("ai_job_skipped_existing_metric incident_id=%s", incident.id)
            return

        image_bytes = None
        image_mime_type = None
        if incident.evidences:
            first_evidence = incident.evidences[0]
            image_mime_type = first_evidence.mime_type
            image_bytes = _safe_load_evidence_bytes(
                storage_root=settings.local_storage_path,
                relative_path=first_evidence.storage_path,
            )

        try:
            result = classify_incident(
                description=incident.description,
                user_category=incident.category,
                image_bytes=image_bytes,
                image_mime_type=image_mime_type,
            )
            ai_metric = AIMetric(
                incident_id=incident.id,
                provider=result.provider,
                model_name=result.model_name,
                prompt_version=settings.ai_prompt_version,
                predicted_category=result.predicted_category,
                priority_score=result.priority_score,
                priority_label=result.priority_label,
                confidence=result.confidence,
                latency_ms=result.latency_ms,
                reasoning_summary=result.reasoning_summary,
                raw_response={
                    **(result.raw_response or {}),
                    "is_appropriate": result.is_appropriate,
                    "is_incident": result.is_incident,
                    "reason": result.reason,
                    "suggested_title": result.suggested_title,
                    "assigned_to": result.assigned_to,
                },
            )
            db.add(ai_metric)

            # La IA propone; no decide.
            #
            # Hasta aqui este bloque reescribia categoria, prioridad, estado y
            # visibilidad, y creaba asignaciones. Eso hacia imposible el estudio
            # que compara moderar con IA frente a moderar sin ella: el brazo
            # "asistido" no era asistido sino automatico, y el humano no tenia
            # ningun punto donde aceptar o corregir.
            #
            # Ahora la recomendacion vive solo en el AIMetric que se acaba de
            # guardar, y la incidencia queda esperando a una persona. Publicar,
            # clasificar y asignar son decisiones humanas, registradas en
            # `moderation_decisions` y `triage_decisions`.
            #
            # La incidencia pasa a IN_REVIEW: hay algo que mirar. No se rechaza
            # sola aunque la IA la marque como inapropiada, porque eso volveria
            # a introducir una automatizacion que el brazo manual no tiene.
            # Es seguro: nada se publica sin aprobacion humana en ningun modo.
            if incident.status == IncidentStatus.REPORTED:
                incident.status = IncidentStatus.IN_REVIEW

            logger.info(
                "ai_suggestion_recorded incident_id=%s categoria=%s prioridad=%s "
                "confianza=%.3f apropiada=%s es_incidencia=%s",
                incident.id,
                result.predicted_category.value,
                result.priority_label.value,
                float(result.confidence),
                result.is_appropriate,
                result.is_incident,
            )
            complete_job(db, job)
            db.commit()
            logger.info(
                "ai_job_completed incident_id=%s provider=%s model=%s fallback_index=%s",
                incident.id,
                result.provider,
                result.model_name,
                (result.raw_response or {}).get("fallback_index", 0),
            )
        except AIClassificationError as exc:
            # Una respuesta inservible de la IA no puede convertirse en una
            # aprobacion. Ya no hace falta forzar la privacidad: este worker no
            # publica nada, asi que la incidencia sigue privada por si sola.
            #
            # Se retiro `is_community_visible = False` de aqui porque su unico
            # efecto posible era deshacer una decision humana: si alguien habia
            # publicado la incidencia mientras el trabajo reintentaba, agotar
            # los reintentos la despublicaba en silencio.
            fail_job(
                db,
                job,
                error_message=str(exc),
                retry_delay_seconds=settings.classification_retry_delay_seconds,
            )
            if job.status.value == "FAILED":
                incident.status = IncidentStatus.IN_REVIEW
            db.commit()
            logger.warning(
                "ai_job_provider_failed incident_id=%s attempts=%s error=%s",
                incident.id,
                exc.attempts,
                str(exc),
            )
        except Exception as exc:
            fail_job(
                db,
                job,
                error_message=str(exc),
                retry_delay_seconds=settings.classification_retry_delay_seconds,
            )
            db.commit()
            logger.exception("ai_job_unexpected_failure incident_id=%s", incident.id)


def run_worker() -> None:
    settings = get_settings()
    worker_id = f"ai-worker@{socket.gethostname()}"
    poll = settings.worker_poll_seconds

    while True:
        # Render starts the workers with `&` from the service start command, so a
        # dead worker is silent: only the admin system panel would show it STALE.
        # Keep the loop alive across any unexpected failure.
        try:
            _run_iteration(worker_id=worker_id, poll=poll)
        except Exception:
            logger.exception("ai_worker_iteration_failed")
            time.sleep(poll)


if __name__ == "__main__":
    run_worker()
