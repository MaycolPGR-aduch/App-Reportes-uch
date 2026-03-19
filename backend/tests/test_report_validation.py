import pytest
from pydantic import ValidationError

from app.models.enums import IncidentCategory
from app.schemas.report import ReportValidation


def test_report_validation_valid_payload() -> None:
    payload = ReportValidation(
        description="Hay una fuga de agua en el pabellon A",
        category=IncidentCategory.INFRASTRUCTURE,
        latitude=-12.0464,
        longitude=-77.0428,
        accuracy_m=15.5,
    )
    assert payload.category == IncidentCategory.INFRASTRUCTURE


def test_report_validation_rejects_short_description() -> None:
    with pytest.raises(ValidationError):
        ReportValidation(
            description="abc",
            category=IncidentCategory.CLEANING,
            latitude=-12.1,
            longitude=-77.1,
            accuracy_m=10.0,
        )

