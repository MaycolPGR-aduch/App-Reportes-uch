from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from google import genai

from app.core.config import get_settings
from app.models.enums import IncidentCategory, PriorityLevel


@dataclass
class AIClassificationResult:
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


CLASSIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "predicted_category": {
            "type": "string",
            "enum": ["INFRASTRUCTURE", "SECURITY", "CLEANING"],
            "description": "Categoria final sugerida para la incidencia.",
        },
        "priority_label": {
            "type": "string",
            "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "description": "Prioridad sugerida de atencion.",
        },
        "priority_score": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "description": "Puntaje de prioridad de 0 a 100.",
        },
        "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Confianza del modelo de 0 a 1.",
        },
        "reasoning_summary": {
            "type": "string",
            "minLength": 8,
            "description": "Justificacion breve de la clasificacion.",
        },
        "is_appropriate": {
            "type": "boolean",
            "description": "True si la imagen y el reporte son apropiados para el contexto universitario.",
        },
        "is_incident": {
            "type": "boolean",
            "description": "True si realmente corresponde a una incidencia reportable.",
        },
        "reason": {
            "type": "string",
            "description": "Motivo cuando no es apropiado o no es una incidencia. Vacio en caso contrario.",
        },
        "suggested_title": {
            "type": "string",
            "minLength": 3,
            "maxLength": 120,
            "description": "Titulo breve sugerido para la incidencia.",
        },
        "assigned_to": {
            "type": "string",
            "minLength": 3,
            "maxLength": 120,
            "description": "Area sugerida para atender la incidencia (ej. Seguridad, Limpieza, Mantenimiento, TI).",
        },
    },
    "required": [
        "predicted_category",
        "priority_label",
        "priority_score",
        "confidence",
        "reasoning_summary",
        "is_appropriate",
        "is_incident",
        "reason",
        "suggested_title",
        "assigned_to",
    ],
}


def _clamp_decimal(value: Any, min_value: Decimal, max_value: Decimal) -> Decimal:
    numeric = Decimal(str(value))
    if numeric < min_value:
        return min_value
    if numeric > max_value:
        return max_value
    return numeric


def _infer_assigned_area(category: IncidentCategory) -> str:
    if category == IncidentCategory.SECURITY:
        return "Seguridad"
    if category == IncidentCategory.CLEANING:
        return "Limpieza"
    return "Mantenimiento"


def _heuristic_classification(
    description: str,
    user_category: IncidentCategory,
    *,
    error_context: str | None = None,
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
    reason = "Clasificacion heuristica local."
    title = "Incidencia reportada"

    if any(keyword in text for keyword in critical_keywords):
        predicted = IncidentCategory.INFRASTRUCTURE
        priority = PriorityLevel.CRITICAL
        score = Decimal("95.00")
        confidence = Decimal("0.850")
        reason = "Contiene palabras clave de riesgo critico."
        title = "Riesgo critico en infraestructura"
    elif any(keyword in text for keyword in security_keywords):
        predicted = IncidentCategory.SECURITY
        priority = PriorityLevel.HIGH
        score = Decimal("86.00")
        confidence = Decimal("0.780")
        reason = "Contiene palabras clave de seguridad."
        title = "Incidencia de seguridad reportada"
    elif any(keyword in text for keyword in cleaning_keywords):
        predicted = IncidentCategory.CLEANING
        priority = PriorityLevel.LOW
        score = Decimal("35.00")
        confidence = Decimal("0.700")
        reason = "Contiene palabras clave de limpieza."
        title = "Incidencia de limpieza reportada"

    latency_ms = int((time.perf_counter() - start) * 1000)
    if error_context:
        reason = "Clasificacion heuristica local por fallback de proveedor IA."

    raw_response: dict[str, Any] = {
        "source": "heuristic",
        "is_appropriate": True,
        "is_incident": True,
        "suggested_title": title,
        "assigned_to": _infer_assigned_area(predicted),
    }
    if error_context:
        raw_response["fallback_reason"] = error_context[:300]

    return AIClassificationResult(
        predicted_category=predicted,
        priority_label=priority,
        priority_score=score,
        confidence=confidence,
        reasoning_summary=reason,
        is_appropriate=True,
        is_incident=True,
        reason=None,
        suggested_title=title,
        assigned_to=_infer_assigned_area(predicted),
        latency_ms=latency_ms,
        raw_response=raw_response,
    )


def classify_incident(
    *,
    description: str,
    user_category: IncidentCategory,
    evidence_metadata: dict[str, Any] | None,
    image_bytes: bytes | None = None,
    image_mime_type: str | None = None,
) -> AIClassificationResult:
    settings = get_settings()
    if not settings.gemini_api_key:
        return _heuristic_classification(
            description,
            user_category,
            error_context="Gemini API key not configured",
        )

    start = time.perf_counter()
    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = (
        "Eres un analista de incidencias de campus universitario. "
        "Evalua el reporte y, si hay imagen, usala para validar moderacion y veracidad de incidencia. "
        "Responde SOLO JSON valido segun el schema, sin texto adicional."
    )
    input_payload = {
        "description": description,
        "reported_category": user_category.value,
        "evidence_metadata": evidence_metadata or {},
        "rules": {
            "category_enum": ["INFRASTRUCTURE", "SECURITY", "CLEANING"],
            "priority_enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "if_not_appropriate_or_not_incident": (
                "Mantener categoria reportada y prioridad MEDIUM salvo riesgo evidente."
            ),
            "suggested_assignees_examples": [
                "Seguridad",
                "Limpieza",
                "Mantenimiento",
                "TI",
                "Servicios Generales",
            ],
        },
    }

    try:
        parts: list[dict[str, Any]] = [
            {
                "text": (
                    f"{prompt}\n\n"
                    "Datos del reporte (JSON):\n"
                    f"{json.dumps(input_payload, ensure_ascii=True)}"
                )
            }
        ]
        if image_bytes and image_mime_type:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image_mime_type,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                {
                    "role": "user",
                    "parts": parts,
                }
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": CLASSIFICATION_SCHEMA,
                "thinking_config": {
                    "thinking_budget": settings.gemini_thinking_budget,
                },
            },
        )

        response_text = (response.text or "").strip()
        if not response_text:
            raise ValueError("Gemini devolvio respuesta vacia")

        parsed = json.loads(response_text)
        latency_ms = int((time.perf_counter() - start) * 1000)
        return AIClassificationResult(
            predicted_category=IncidentCategory(parsed["predicted_category"]),
            priority_label=PriorityLevel(parsed["priority_label"]),
            priority_score=_clamp_decimal(
                parsed["priority_score"], Decimal("0"), Decimal("100")
            ),
            confidence=_clamp_decimal(parsed["confidence"], Decimal("0"), Decimal("1")),
            reasoning_summary=parsed["reasoning_summary"].strip()[:500],
            is_appropriate=bool(parsed["is_appropriate"]),
            is_incident=bool(parsed["is_incident"]),
            reason=(parsed.get("reason") or "").strip()[:500] or None,
            suggested_title=(parsed.get("suggested_title") or "").strip()[:120] or None,
            assigned_to=(parsed.get("assigned_to") or "").strip()[:120] or None,
            latency_ms=latency_ms,
            raw_response={
                "source": "gemini",
                "output_text": response_text,
                "is_appropriate": bool(parsed["is_appropriate"]),
                "is_incident": bool(parsed["is_incident"]),
                "reason": (parsed.get("reason") or "").strip()[:500],
                "suggested_title": (parsed.get("suggested_title") or "").strip()[:120],
                "assigned_to": (parsed.get("assigned_to") or "").strip()[:120],
            },
        )
    except Exception as exc:
        return _heuristic_classification(
            description,
            user_category,
            error_context=f"Gemini failure: {exc}",
        )
