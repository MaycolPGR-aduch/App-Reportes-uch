from types import SimpleNamespace

from app.services.rate_limit import client_identifier
from app.services.notifications import _send_via_brevo
from app.models.enums import NotificationStatus
import httpx


def test_rate_limit_ignores_untrusted_forwarded_header():
    request = SimpleNamespace(client=SimpleNamespace(host="192.0.2.1"), headers={"x-forwarded-for": "203.0.113.55"})
    assert client_identifier(request) == "192.0.2.1:"


def test_notification_timeout_is_uncertain(monkeypatch):
    import app.services.notifications as notifications
    monkeypatch.setattr(notifications, "get_settings", lambda: SimpleNamespace(
        brevo_api_key="test", brevo_from_email="sender@example.edu", brevo_from_name="test", alerts_enabled=True))
    def timeout(*args, **kwargs):
        raise httpx.ReadTimeout("timeout")
    monkeypatch.setattr(notifications.httpx, "post", timeout)
    result = _send_via_brevo(recipient="test@example.edu", subject="test", html="test")
    assert result.status == NotificationStatus.SENDING
    assert "uncertain" in result.error_message
