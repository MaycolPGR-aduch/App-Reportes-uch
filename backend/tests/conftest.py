from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from starlette.requests import Request

from app.models.enums import IncidentCategory, IncidentStatus, PriorityLevel, UserRole, UserStatus
from app.models.incident import Incident
from app.models.location import IncidentLocation
from app.models.user import User


def make_request(cookies: dict[str, str] | None = None) -> Request:
    """Build a bare Starlette request carrying the given cookies."""
    headers = []
    if cookies:
        raw = "; ".join(f"{name}={value}" for name, value in cookies.items())
        headers.append((b"cookie", raw.encode("latin-1")))
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": headers,
            "query_string": b"",
        }
    )


class FakeQuery:
    """Records filters without evaluating them and returns a canned row."""

    def __init__(self, result: object | None) -> None:
        self._result = result

    def filter(self, *args: object, **kwargs: object) -> "FakeQuery":
        return self

    def first(self) -> object | None:
        return self._result


class FakeSession:
    """Minimal stand-in for the pieces of Session that the deps touch."""

    def __init__(self, *, auth_session: object | None = None, user: object | None = None) -> None:
        self._auth_session = auth_session
        self._user = user

    def query(self, _model: object) -> FakeQuery:
        return FakeQuery(self._auth_session)

    def get(self, _model: object, _pk: object) -> object | None:
        return self._user


@pytest.fixture
def active_user() -> User:
    return User(
        id=uuid4(),
        campus_id="ustudent01",
        full_name="Estudiante Uno",
        email="estudiante@example.edu",
        password_hash="x",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


def build_incident(
    *,
    reporter: User | None = None,
    description: str = "Fuga de agua en el pabellon A",
    zone_name: str | None = "Pabellon A",
) -> Incident:
    """A detached incident, as the notification worker loads it."""
    incident = Incident(
        id=uuid4(),
        description=description,
        category=IncidentCategory.INFRASTRUCTURE,
        status=IncidentStatus.REPORTED,
        priority=PriorityLevel.MEDIUM,
        created_by=reporter.campus_id if reporter else "anonymous",
    )
    incident.reporter = reporter
    incident.location = IncidentLocation(
        incident_id=incident.id,
        latitude=-12.0464,
        longitude=-77.0428,
        accuracy_m=12.0,
        resolved_zone_name=zone_name,
        location_status="MATCHED",
        captured_at=datetime.now(timezone.utc) - timedelta(minutes=1),
    )
    return incident
