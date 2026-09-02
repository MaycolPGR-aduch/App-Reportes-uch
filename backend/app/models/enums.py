from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    STAFF = "STAFF"
    ADMIN = "ADMIN"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class IncidentCategory(str, enum.Enum):
    INFRASTRUCTURE = "INFRASTRUCTURE"
    SECURITY = "SECURITY"
    CLEANING = "CLEANING"


class IncidentStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    IN_REVIEW = "IN_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class PriorityLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AssignmentStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    COMPLETED = "COMPLETED"


class NotificationChannel(str, enum.Enum):
    EMAIL = "EMAIL"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class JobType(str, enum.Enum):
    CLASSIFY_INCIDENT = "CLASSIFY_INCIDENT"
    SEND_NOTIFICATION = "SEND_NOTIFICATION"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class GovernanceMode(str, enum.Enum):
    """Regimen bajo el que se proceso una incidencia.

    Se estampa en cada una al crearla y no se toca despues: el paper compara
    los dos primeros brazos, y cambiar el modo de una incidencia ya procesada
    falsearia el registro.
    """

    #: Sin IA. Todo lo decide una persona.
    MANUAL = "MANUAL"
    #: La IA propone; una persona acepta o corrige.
    AI_ASSISTED = "AI_ASSISTED"
    #: Regimen anterior al experimento, en que la IA clasificaba, asignaba y
    #: publicaba sola. Existe para etiquetar lo ya ocurrido, no para operar.
    AI_AUTONOMOUS = "AI_AUTONOMOUS"
