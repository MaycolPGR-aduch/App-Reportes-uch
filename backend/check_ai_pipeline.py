from __future__ import annotations

import sys
from pathlib import Path

import psycopg2


def load_env(env_path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def normalize_db_url(db_url: str) -> str:
    if db_url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + db_url[len("postgresql+psycopg2://") :]
    return db_url


def print_ok(msg: str) -> None:
    print(f"[OK] {msg}")


def print_warn(msg: str) -> None:
    print(f"[WARN] {msg}")


def print_fail(msg: str) -> None:
    print(f"[FAIL] {msg}")


def main() -> int:
    backend_dir = Path(__file__).resolve().parent
    env_path = backend_dir / ".env"
    if not env_path.exists():
        print_fail(f"No existe .env en: {env_path}")
        return 1

    env = load_env(env_path)
    db_url = env.get("DATABASE_URL", "")
    if not db_url:
        print_fail("DATABASE_URL no está definido en .env")
        return 1

    has_gemini_key = bool(env.get("GEMINI_API_KEY", "").strip())
    gemini_model = env.get("GEMINI_MODEL", "")
    if has_gemini_key:
        print_ok(f"GEMINI_API_KEY configurada. GEMINI_MODEL={gemini_model or '(vacío)'}")
    else:
        print_warn("GEMINI_API_KEY no configurada. Se usará fallback heurístico.")

    try:
        conn = psycopg2.connect(normalize_db_url(db_url))
        conn.autocommit = True
    except Exception as exc:
        print_fail(f"No se pudo conectar a PostgreSQL: {exc}")
        return 1

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM incidents;")
            incidents_total = cur.fetchone()[0]
            print_ok(f"Incidencias totales: {incidents_total}")

            cur.execute("SELECT COUNT(*) FROM ai_metrics;")
            metrics_total = cur.fetchone()[0]
            print_ok(f"ai_metrics totales: {metrics_total}")

            cur.execute(
                """
                SELECT type::text, status::text, COUNT(*)
                FROM jobs
                GROUP BY type, status
                ORDER BY type, status;
                """
            )
            grouped = cur.fetchall()
            print_ok(f"Jobs por tipo/estado: {grouped if grouped else 'sin jobs'}")

            cur.execute(
                """
                SELECT id, status::text, attempts, max_attempts, COALESCE(last_error, '')
                FROM jobs
                WHERE type = 'CLASSIFY_INCIDENT'
                ORDER BY created_at DESC
                LIMIT 8;
                """
            )
            classify_jobs = cur.fetchall()
            if classify_jobs:
                print_ok("Últimos jobs CLASSIFY_INCIDENT:")
                for row in classify_jobs:
                    print(
                        "   ",
                        {
                            "id": str(row[0]),
                            "status": row[1],
                            "attempts": row[2],
                            "max_attempts": row[3],
                            "last_error": row[4][:180],
                        },
                    )
            else:
                print_warn("No hay jobs CLASSIFY_INCIDENT en cola.")

            cur.execute(
                """
                SELECT model_name, prompt_version, priority_label::text, confidence::text, created_at
                FROM ai_metrics
                ORDER BY created_at DESC
                LIMIT 5;
                """
            )
            recent_metrics = cur.fetchall()
            if recent_metrics:
                print_ok("Últimas métricas IA:")
                for row in recent_metrics:
                    print(
                        "   ",
                        {
                            "model_name": row[0],
                            "prompt_version": row[1],
                            "priority_label": row[2],
                            "confidence": row[3],
                            "created_at": str(row[4]),
                        },
                    )
                cur.execute(
                    """
                    SELECT raw_response
                    FROM ai_metrics
                    ORDER BY created_at DESC
                    LIMIT 1;
                    """
                )
                latest_raw = cur.fetchone()[0] or {}
                fallback_reason = latest_raw.get("fallback_reason")
                source = latest_raw.get("source")
                print_ok(f"Último origen IA: {source}")
                if fallback_reason:
                    print_warn(f"Último fallback_reason: {str(fallback_reason)[:220]}")
            else:
                print_warn("No hay registros en ai_metrics todavía.")

            cur.execute("SELECT COUNT(*) FROM responsibles WHERE is_active = TRUE;")
            active_responsibles = cur.fetchone()[0]
            if active_responsibles > 0:
                print_ok(f"Responsables activos: {active_responsibles}")
            else:
                print_warn("No hay responsables activos. La asignación automática no podrá ejecutarse.")

    except Exception as exc:
        print_fail(f"Error consultando la base de datos: {exc}")
        return 1
    finally:
        conn.close()

    print("\nDiagnóstico IA completado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
