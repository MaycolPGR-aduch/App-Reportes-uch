"""Verify every configured TokenRouter VLM with Campus Alertas' real contract.

This intentionally sends one small, non-sensitive PNG and a short test report to
each configured model. It never prints the API key or the provider response body.
Run it before enabling a new primary or fallback model.
"""

from __future__ import annotations

import argparse
import base64
import sys
from typing import Sequence

from app.core.config import get_settings
from app.models.enums import IncidentCategory
from app.services.ai import (
    _build_messages,
    _call_tokenrouter,
    _extract_json,
    _parse_result,
    _response_content,
)

# A valid 1×1 PNG. It checks that the route accepts image input without sending
# a real campus image or any personal information.
TEST_IMAGE_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/"
    "hK5xWQAAAABJRU5ErkJggg=="
)


def configured_models(extra_models: Sequence[str]) -> list[str]:
    settings = get_settings()
    from_environment = [
        model
        for model in [settings.ai_image_primary_model, *settings.ai_image_fallback_models]
        if model
    ]
    models = [*from_environment, *extra_models]
    return list(dict.fromkeys(models))


def test_model(model_name: str) -> tuple[bool, str]:
    settings = get_settings()
    if not settings.ai_tokenrouter_api_key:
        return False, "AI_TOKENROUTER_API_KEY is not configured"

    messages = _build_messages(
        description="Prueba técnica: luminaria dañada en un pasillo del campus.",
        user_category=IncidentCategory.INFRASTRUCTURE,
        image_bytes=TEST_IMAGE_BYTES,
        image_mime_type="image/png",
    )
    try:
        payload, latency_ms = _call_tokenrouter(
            base_url=settings.ai_tokenrouter_base_url,
            api_key=settings.ai_tokenrouter_api_key,
            model_name=model_name,
            messages=messages,
            timeout_seconds=settings.ai_request_timeout_seconds,
            max_output_tokens=settings.ai_max_output_tokens,
        )
        parsed = _extract_json(_response_content(payload))
        result = _parse_result(
            parsed=parsed,
            provider="tokenrouter",
            model_name=model_name,
            latency_ms=latency_ms,
            raw_response={},
        )
        usage = payload.get("usage") if isinstance(payload, dict) else None
        total_tokens = usage.get("total_tokens") if isinstance(usage, dict) else "N/D"
        return (
            True,
            f"OK | {latency_ms} ms | {total_tokens} tokens | "
            f"{result.predicted_category.value} / {result.priority_label.value}",
        )
    except Exception as exc:
        return False, f"{type(exc).__name__}: {str(exc)[:500]}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Checks TokenRouter model availability and Campus Alertas JSON/image compatibility."
    )
    parser.add_argument(
        "--model",
        action="append",
        default=[],
        help="Extra model ID to test; can be repeated. Defaults to configured models.",
    )
    args = parser.parse_args()

    models = configured_models(args.model)
    if not models:
        print("[FAIL] No image models configured. Set AI_IMAGE_PRIMARY_MODEL first.")
        return 2

    print(f"TokenRouter base URL: {get_settings().ai_tokenrouter_base_url}")
    print("Testing one image + structured JSON request per model (no API key is shown).")
    failures = 0
    for model_name in models:
        ok, message = test_model(model_name)
        print(f"[{'OK' if ok else 'FAIL'}] {model_name}: {message}")
        failures += int(not ok)

    if failures:
        print(f"\n{failures}/{len(models)} configured model(s) failed.")
        return 1
    print(f"\nAll {len(models)} configured model(s) passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
