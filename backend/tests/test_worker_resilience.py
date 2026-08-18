"""The workers run detached via `&` in the Render start command, so a crashed
worker is silent: the only symptom is a STALE state in the admin panel. These
tests pin the guards that keep their polling loops alive."""

import pytest

from app.workers import ai_worker, notification_worker


class LoopBreaker(BaseException):
    """Escapes the workers' `except Exception` guard to end the endless loop."""


def test_ai_worker_loop_survives_a_failing_iteration(monkeypatch) -> None:
    attempts = []

    def fake_iteration(*, worker_id: str, poll: float) -> None:
        attempts.append(worker_id)
        if len(attempts) == 1:
            raise RuntimeError("transient database failure")
        raise LoopBreaker

    monkeypatch.setattr(ai_worker, "_run_iteration", fake_iteration)
    monkeypatch.setattr(ai_worker.time, "sleep", lambda _seconds: None)

    with pytest.raises(LoopBreaker):
        ai_worker.run_worker()

    assert len(attempts) == 2, "the RuntimeError should not have ended the loop"


def test_notification_worker_loop_survives_a_failing_iteration(monkeypatch) -> None:
    attempts = []

    def fake_session_local():
        attempts.append(True)
        if len(attempts) == 1:
            raise RuntimeError("connection reset by peer")
        raise LoopBreaker

    monkeypatch.setattr(notification_worker, "SessionLocal", fake_session_local)
    monkeypatch.setattr(notification_worker.time, "sleep", lambda _seconds: None)

    with pytest.raises(LoopBreaker):
        notification_worker.run_worker()

    assert len(attempts) == 2, "the RuntimeError should not have ended the loop"
