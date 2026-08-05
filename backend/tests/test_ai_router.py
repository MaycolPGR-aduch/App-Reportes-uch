from types import SimpleNamespace

import pytest

from app.models.enums import IncidentCategory
from app.services import ai


def _settings(*, primary: str | None = "kimi", fallbacks: list[str] | None = None):
    return SimpleNamespace(
        ai_tokenrouter_api_key="test-key",
        ai_tokenrouter_base_url="https://router.test/v1",
        ai_image_primary_model=primary,
        ai_image_fallback_models=fallbacks or [],
        ai_request_timeout_seconds=5,
        ai_max_output_tokens=700,
    )


def _payload(*, category: str = "INFRASTRUCTURE") -> dict:
    return {
        "choices": [
            {
                "message": {
                    "content": (
                        '{"predicted_category":"' + category + '",'
                        '"priority_label":"MEDIUM","priority_score":50,'
                        '"confidence":0.9,"reasoning_summary":"Daño visible en el campus.",'
                        '"is_appropriate":true,"is_incident":true,"reason":"",'
                        '"suggested_title":"Daño reportado","assigned_to":"Mantenimiento"}'
                    )
                }
            }
        ],
        "usage": {"prompt_tokens": 123, "completion_tokens": 45, "total_tokens": 168},
    }


def test_router_uses_primary_model_and_persists_usage(monkeypatch) -> None:
    monkeypatch.setattr(ai, "get_settings", lambda: _settings())
    calls: list[str] = []

    def fake_call(**kwargs):
        calls.append(kwargs["model_name"])
        return _payload(), 12

    monkeypatch.setattr(ai, "_call_tokenrouter", fake_call)
    result = ai.classify_incident(
        description="Hay una fuga de agua",
        user_category=IncidentCategory.INFRASTRUCTURE,
        image_bytes=b"image",
        image_mime_type="image/jpeg",
    )

    assert calls == ["kimi"]
    assert result.provider == "tokenrouter"
    assert result.model_name == "kimi"
    assert result.raw_response["usage"]["total_tokens"] == 168


def test_router_uses_next_model_only_when_prior_response_is_invalid(monkeypatch) -> None:
    monkeypatch.setattr(ai, "get_settings", lambda: _settings(fallbacks=["nemotron"]))
    calls: list[str] = []

    def fake_call(**kwargs):
        calls.append(kwargs["model_name"])
        if kwargs["model_name"] == "kimi":
            return {"choices": [{"message": {"content": "not json"}}]}, 3
        return _payload(category="SECURITY"), 7

    monkeypatch.setattr(ai, "_call_tokenrouter", fake_call)
    result = ai.classify_incident(
        description="Puerta rota",
        user_category=IncidentCategory.INFRASTRUCTURE,
    )

    assert calls == ["kimi", "nemotron"]
    assert result.model_name == "nemotron"
    assert len(result.raw_response["attempts_before_success"]) == 1


def test_missing_configuration_is_not_converted_into_a_permissive_result(monkeypatch) -> None:
    settings = _settings(primary=None)
    settings.ai_tokenrouter_api_key = None
    monkeypatch.setattr(ai, "get_settings", lambda: settings)

    with pytest.raises(ai.AIClassificationError):
        ai.classify_incident(
            description="Fuga de agua",
            user_category=IncidentCategory.INFRASTRUCTURE,
        )
