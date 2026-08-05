from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.enums import IncidentCategory, PriorityLevel


@dataclass
class AIClassificationResult:
    provider: str
    model_name: str
    predicted_category: IncidentCategory
    priority_label: PriorityLevel
    priority_score: Decimal
    confidence: Decimal
    reasoning_summary: str
    is_appropriate: bool
    is_incident: bool
    reason: str | None
    suggested_title: str | None
    assigned_to: str | None
    latency_ms: int
    raw_response: dict[str, Any]


class AIClassificationError(RuntimeError):
    """No configured model returned a valid classification.

    The worker must retry this error and eventually route the incident to manual
    review. It is deliberately not converted into a permissive local result:
    unavailable AI must never publish evidence or auto-assign work.
    """

    def __init__(self, message: str, attempts: list[dict[str, Any]]) -> None:
        super().__init__(message)
        self.attempts = attempts


CLASSIFICATION_SCHEMA: dict[str, Any] = {
    "predicted_category": "INFRASTRUCTURE | SECURITY | CLEANING",
    "priority_label": "LOW | MEDIUM | HIGH | CRITICAL",
    "priority_score": "number from 0 to 100",
    "confidence": "number from 0 to 1",
    "reasoning_summary": "short Spanish justification",
    "is_appropriate": "boolean",
    "is_incident": "boolean",
    "reason": "short reason or empty string",
    "suggested_title": "short title or empty string",
    "assigned_to": "suggested campus area or empty string",
}


def _clamp_decimal(value: Any, min_value: Decimal, max_value: Decimal) -> Decimal:
    numeric = Decimal(str(value))
    if numeric < min_value:
        return min_value
    if numeric > max_value:
        return max_value
    return numeric


def _clean_optional_text(value: Any, max_length: int) -> str | None:
    if not isinstance(value, str):
        return None
    return value.strip()[:max_length] or None


def _extract_json(text: str) -> dict[str, Any]:
    """Accept raw JSON and fenced JSON without trusting provider formatting."""
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.split("\n", 1)[1] if "\n" in candidate else ""
        if candidate.rstrip().endswith("```"):
            candidate = candidate.rstrip()[:-3]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("model did not return a JSON object")
        parsed = json.loads(candidate[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("model response JSON must be an object")
    return parsed


def _parse_result(
    *,
    parsed: dict[str, Any],
    provider: str,
    model_name: str,
    latency_ms: int,
    raw_response: dict[str, Any],
) -> AIClassificationResult:
    required = set(CLASSIFICATION_SCHEMA)
    missing = required.difference(parsed)
    if missing:
        raise ValueError(f"model response missing fields: {', '.join(sorted(missing))}")

    reasoning_summary = _clean_optional_text(parsed["reasoning_summary"], 500)
    if reasoning_summary is None or len(reasoning_summary) < 8:
        raise ValueError("model response has an invalid reasoning_summary")

    # bool('false') is True, so reject non-boolean values instead of coercing.
    if not isinstance(parsed["is_appropriate"], bool) or not isinstance(parsed["is_incident"], bool):
        raise ValueError("model response moderation values must be booleans")

    return AIClassificationResult(
        provider=provider,
        model_name=model_name,
        predicted_category=IncidentCategory(parsed["predicted_category"]),
        priority_label=PriorityLevel(parsed["priority_label"]),
        priority_score=_clamp_decimal(parsed["priority_score"], Decimal("0"), Decimal("100")),
        confidence=_clamp_decimal(parsed["confidence"], Decimal("0"), Decimal("1")),
        reasoning_summary=reasoning_summary,
        is_appropriate=parsed["is_appropriate"],
        is_incident=parsed["is_incident"],
        reason=_clean_optional_text(parsed.get("reason"), 500),
        suggested_title=_clean_optional_text(parsed.get("suggested_title"), 120),
        assigned_to=_clean_optional_text(parsed.get("assigned_to"), 120),
        latency_ms=latency_ms,
        raw_response=raw_response,
    )


def _build_messages(
    *,
    description: str,
    user_category: IncidentCategory,
    image_bytes: bytes | None,
    image_mime_type: str | None,
) -> list[dict[str, Any]]:
    report = {
        "description": description,
        "reported_category": user_category.value,
        "rules": {
            "category_enum": ["INFRASTRUCTURE", "SECURITY", "CLEANING"],
            "priority_enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "language": "Spanish",
            "safety": "If unsure whether content is appropriate or an incident, return false.",
        },
        "response_schema": CLASSIFICATION_SCHEMA,
    }
    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                "Eres un analista de incidencias de un campus universitario. "
                "Analiza la descripción y la imagen. Responde exclusivamente un objeto JSON "
                "válido que cumpla exactamente este esquema, sin markdown ni explicaciones externas.\n\n"
                + json.dumps(report, ensure_ascii=False)
            ),
        }
    ]
    if image_bytes and image_mime_type:
        data_url = f"data:{image_mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
        content.append({"type": "image_url", "image_url": {"url": data_url}})
    return [{"role": "user", "content": content}]


def _call_tokenrouter(
    *,
    base_url: str,
    api_key: str,
    model_name: str,
    messages: list[dict[str, Any]],
    timeout_seconds: float,
    max_output_tokens: int,
) -> tuple[dict[str, Any], int]:
    """OpenAI-compatible request shared by every configured TokenRouter model."""
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model_name,
                    "messages": messages,
                    "temperature": 0,
                    "max_tokens": max_output_tokens,
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        # Provider error bodies commonly identify quota, model-access, or a
        # transient upstream problem. Keep diagnostics short and never include
        # headers (which could contain credentials).
        try:
            error_payload = exc.response.json()
            if isinstance(error_payload, dict):
                detail = error_payload.get("message") or error_payload.get("error") or error_payload
            else:
                detail = error_payload
        except ValueError:
            detail = exc.response.text
        raise RuntimeError(
            f"request failed: HTTP {exc.response.status_code}: {str(detail)[:350]}"
        ) from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise RuntimeError(f"request failed: {type(exc).__name__}: {exc}") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    if not isinstance(payload, dict):
        raise RuntimeError("provider returned a non-object response")
    return payload, latency_ms


def _response_content(payload: dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("provider response has no assistant content") from exc
    if not isinstance(content, str) or not content.strip():
        raise ValueError("provider returned empty assistant content")
    return content


def _safe_usage(payload: dict[str, Any]) -> dict[str, Any] | None:
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    return {
        key: value
        for key, value in usage.items()
        if key in {"prompt_tokens", "completion_tokens", "total_tokens", "cost"}
        and isinstance(value, (int, float))
    }


def classify_incident(
    *,
    description: str,
    user_category: IncidentCategory,
    image_bytes: bytes | None = None,
    image_mime_type: str | None = None,
) -> AIClassificationResult:
    """Run the ordered VLM chain once; callers persist the successful result."""
    settings = get_settings()
    models = [model for model in [settings.ai_image_primary_model, *settings.ai_image_fallback_models] if model]
    if not settings.ai_tokenrouter_api_key:
        raise AIClassificationError("TokenRouter API key is not configured", [])
    if not models:
        raise AIClassificationError("No image-capable AI model is configured", [])

    messages = _build_messages(
        description=description,
        user_category=user_category,
        image_bytes=image_bytes,
        image_mime_type=image_mime_type,
    )
    attempts: list[dict[str, Any]] = []
    for index, model_name in enumerate(models):
        try:
            payload, latency_ms = _call_tokenrouter(
                base_url=settings.ai_tokenrouter_base_url,
                api_key=settings.ai_tokenrouter_api_key,
                model_name=model_name,
                messages=messages,
                timeout_seconds=settings.ai_request_timeout_seconds,
                max_output_tokens=settings.ai_max_output_tokens,
            )
            content = _response_content(payload)
            parsed = _extract_json(content)
            raw_response = {
                "source": "tokenrouter",
                "provider": "tokenrouter",
                "model": model_name,
                "fallback_index": index,
                "usage": _safe_usage(payload),
                "is_appropriate": parsed.get("is_appropriate"),
                "is_incident": parsed.get("is_incident"),
            }
            return _parse_result(
                parsed=parsed,
                provider="tokenrouter",
                model_name=model_name,
                latency_ms=latency_ms,
                raw_response={**raw_response, "attempts_before_success": attempts},
            )
        except Exception as exc:
            attempts.append(
                {
                    "model": model_name,
                    "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                }
            )

    diagnostic = "; ".join(
        f"{attempt['model']}: {attempt['error']}" for attempt in attempts
    )
    raise AIClassificationError(
        f"All configured AI models failed. {diagnostic[:350]}", attempts
    )
