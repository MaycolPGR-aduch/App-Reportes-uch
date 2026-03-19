from __future__ import annotations

import json
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from openai import OpenAI

from app.core.config import get_settings
from app.models.enums import IncidentCategory, PriorityLevel


@dataclass
class AIClassificationResult:
    predicted_category: IncidentCategory
    priority_label: PriorityLevel
    priority_score: Decimal
    confidence: Decimal
    reasoning_summary: str
    latency_ms: int
    raw_response: dict[str, Any]


def _heuristic_classification(
    description: str, user_category: IncidentCategory
) -> AIClassificationResult:
    start = time.perf_counter()
    text = description.lower()

    security_keywords = {
        "robo",
        "asalto",
        "arma",
        "violencia",
        "agresion",
        "amenaza",
        "pelea",
    }
    critical_keywords = {"incendio", "explosion", "fuga de gas", "corto", "electrico"}
    cleaning_keywords = {"basura", "derrame", "sucio", "limpieza", "olor"}

    predicted = user_category
    priority = PriorityLevel.MEDIUM
    score = Decimal("55.00")
    confidence = Decimal("0.550")
    reason = "Clasificacion heuristica local (sin API key de OpenAI)."

    if any(keyword in text for keyword in critical_keywords):
        predicted = IncidentCategory.INFRASTRUCTURE
        priority = PriorityLevel.CRITICAL
        score = Decimal("95.00")
        confidence = Decimal("0.850")
        reason = "Contiene palabras clave de riesgo critico."
    elif any(keyword in text for keyword in security_keywords):
        predicted = IncidentCategory.SECURITY
        priority = PriorityLevel.HIGH
        score = Decimal("86.00")
        confidence = Decimal("0.780")
        reason = "Contiene palabras clave de seguridad."
    elif any(keyword in text for keyword in cleaning_keywords):
        predicted = IncidentCategory.CLEANING
        priority = PriorityLevel.LOW
        score = Decimal("35.00")
        confidence = Decimal("0.700")
        reason = "Contiene palabras clave de limpieza."

    latency_ms = int((time.perf_counter() - start) * 1000)
    return AIClassificationResult(
        predicted_category=predicted,
        priority_label=priority,
        priority_score=score,
        confidence=confidence,
        reasoning_summary=reason,
        latency_ms=latency_ms,
        raw_response={"source": "heuristic"},
    )


def classify_incident(
    *,
    description: str,
    user_category: IncidentCategory,
    evidence_metadata: dict[str, Any] | None,
) -> AIClassificationResult:
    settings = get_settings()
    if not settings.openai_api_key:
        return _heuristic_classification(description, user_category)

    start = time.perf_counter()
    client = OpenAI(api_key=settings.openai_api_key)

    prompt = (
        "Clasifica incidencias universitarias. Responde solo JSON con campos "
        "predicted_category, priority_label, priority_score, confidence, reasoning_summary. "
        "Categorias: INFRASTRUCTURE, SECURITY, CLEANING. "
        "Prioridades: LOW, MEDIUM, HIGH, CRITICAL."
    )
    content = {
        "description": description,
        "reported_category": user_category.value,
        "evidence_metadata": evidence_metadata or {},
    }
    try:
        response = client.responses.create(
            model=settings.openai_model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": prompt}]},
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": json.dumps(content, ensure_ascii=True)}
                    ],
                },
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "incident_classification",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "predicted_category": {
                                "type": "string",
                                "enum": ["INFRASTRUCTURE", "SECURITY", "CLEANING"],
                            },
                            "priority_label": {
                                "type": "string",
                                "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                            },
                            "priority_score": {"type": "number", "minimum": 0, "maximum": 100},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                            "reasoning_summary": {"type": "string", "minLength": 8},
                        },
                        "required": [
                            "predicted_category",
                            "priority_label",
                            "priority_score",
                            "confidence",
                            "reasoning_summary",
                        ],
                    },
                }
            },
        )
        parsed = json.loads(response.output_text)
        latency_ms = int((time.perf_counter() - start) * 1000)
        return AIClassificationResult(
            predicted_category=IncidentCategory(parsed["predicted_category"]),
            priority_label=PriorityLevel(parsed["priority_label"]),
            priority_score=Decimal(str(parsed["priority_score"])),
            confidence=Decimal(str(parsed["confidence"])),
            reasoning_summary=parsed["reasoning_summary"].strip()[:500],
            latency_ms=latency_ms,
            raw_response={"output_text": response.output_text},
        )
    except Exception:
        return _heuristic_classification(description, user_category)

