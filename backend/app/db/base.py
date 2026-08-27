from app.models.base import Base
from app.models.ai_metric import AIMetric
from app.models.assignment import IncidentAssignment
from app.models.account_token import AccountToken
from app.models.auth_session import AuthSession
from app.models.campus_zone import CampusZone
from app.models.community_reaction import CommunityReaction
from app.models.moderation_decision import ModerationDecision
from app.models.system_alert import SystemAlert
from app.models.evidence import IncidentEvidence
from app.models.incident import Incident
from app.models.job import Job
from app.models.location import IncidentLocation
from app.models.notification import Notification
from app.models.responsible import Responsible
from app.models.rate_limit import RateLimitBucket
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "AccountToken",
    "AuthSession",
    "RateLimitBucket",
    "CampusZone",
    "CommunityReaction",
    "Incident",
    "IncidentLocation",
    "IncidentEvidence",
    "Responsible",
    "IncidentAssignment",
    "Notification",
    "AIMetric",
    "Job",
]

# Registra el escucha que avisa al reportante al resolverse su incidencia.
from app.services import incident_events  # noqa: E402,F401
