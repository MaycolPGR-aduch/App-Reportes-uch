from app.services.notifications import _compose_html

from tests.conftest import build_incident


def test_compose_html_handles_anonymous_report() -> None:
    """Regression: reporter_id is nullable, and dereferencing it killed the worker."""
    html = _compose_html(build_incident(reporter=None))

    assert "Anonimo" in html


def test_compose_html_uses_reporter_campus_id_when_present(active_user) -> None:
    html = _compose_html(build_incident(reporter=active_user))

    assert active_user.campus_id in html


def test_compose_html_escapes_reporter_supplied_description() -> None:
    """sanitize_description keeps markup, so escaping must happen at this edge."""
    html = _compose_html(
        build_incident(description="<script>alert('xss')</script> fuga de agua")
    )

    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_compose_html_escapes_zone_name() -> None:
    html = _compose_html(build_incident(zone_name="<b>Pabellon</b>"))

    assert "<b>Pabellon</b>" not in html
    assert "&lt;b&gt;Pabellon&lt;/b&gt;" in html


def test_compose_html_keeps_its_own_markup() -> None:
    html = _compose_html(build_incident())

    assert html.startswith("<h2>Nueva incidencia en campus</h2>")
    assert "<strong>Prioridad:</strong> MEDIUM" in html
