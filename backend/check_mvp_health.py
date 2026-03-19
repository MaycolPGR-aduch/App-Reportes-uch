# check_mvp_health.py
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
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


def http_get_json(url: str, timeout: int = 5) -> dict:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_options(url: str, origin: str, timeout: int = 5) -> dict[str, str]:
    req = urllib.request.Request(url, method="OPTIONS")
    req.add_header("Origin", origin)
    req.add_header("Access-Control-Request-Method", "POST")
    # Browser preflight for login (JSON body) normally includes only content-type.
    req.add_header("Access-Control-Request-Headers", "content-type")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return dict(resp.headers.items())


def http_post_json(url: str, payload: dict, timeout: int = 5) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def normalize_db_url(db_url: str) -> str:
    # SQLAlchemy URL -> psycopg2 URL
    if db_url.startswith("postgresql+psycopg2://"):
        return "postgresql://" + db_url[len("postgresql+psycopg2://") :]
    return db_url


def print_ok(msg: str) -> None:
    print(f"[OK] {msg}")


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
    cors_origins = env.get("CORS_ORIGINS", "")
    api_base = "http://localhost:8000"
    login_url = f"{api_base}/api/v1/auth/login"

    if not db_url:
        print_fail("DATABASE_URL no está definido en .env")
        return 1

    # 1) Health API
    try:
        health = http_get_json(f"{api_base}/health")
        if health.get("status") == "ok":
            print_ok("Backend responde en /health")
        else:
            print_fail(f"/health respondió inesperado: {health}")
            return 1
    except Exception as e:
        print_fail(f"No se pudo conectar al backend: {e}")
        return 1

    # 2) CORS preflight
    try:
        test_origin = "http://localhost:3000"
        headers = http_options(login_url, test_origin)
        lower_headers = {k.lower(): v for k, v in headers.items()}
        allow_origin = lower_headers.get("access-control-allow-origin")
        if allow_origin in (test_origin, "*"):
            print_ok(f"CORS preflight correcto (Allow-Origin={allow_origin})")
        else:
            print_fail(
                "CORS preflight inválido. "
                f"Access-Control-Allow-Origin={allow_origin}. "
                f"CORS_ORIGINS en .env={cors_origins!r}"
            )
            print("Headers preflight:", lower_headers)
    except urllib.error.HTTPError as e:
        print_fail(f"Preflight CORS devolvió HTTP {e.code}: {e.reason}")
    except Exception as e:
        print_fail(f"Error comprobando CORS: {e}")

    # 3) Conexión DB
    pg_url = normalize_db_url(db_url)
    try:
        conn = psycopg2.connect(pg_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT current_database(), current_user, now();")
            db_name, db_user, db_now = cur.fetchone()
            print_ok(f"Conexión DB OK -> db={db_name}, user={db_user}, now={db_now}")

            cur.execute(
                """
                SELECT
                    has_schema_privilege(current_user, 'public', 'USAGE'),
                    has_table_privilege(current_user, 'public.users', 'SELECT')
                ;
                """
            )
            has_schema_usage, has_users_select = cur.fetchone()
            if not has_schema_usage or not has_users_select:
                print_fail(
                    "Permisos insuficientes en PostgreSQL para leer public.users "
                    f"(schema_usage={has_schema_usage}, users_select={has_users_select})."
                )
                print(
                    "Ejecuta sql/grant_permissions.sql en pgAdmin con un usuario administrador."
                )
                return 1

            cur.execute("SELECT COUNT(*) FROM users;")
            total_users = cur.fetchone()[0]
            print_ok(f"Tabla users accesible. total_users={total_users}")

            cur.execute(
                """
                SELECT campus_id, role, status
                FROM users
                WHERE campus_id IN ('uadmin01', 'ustudent01', 'usec01', 'uclean01')
                ORDER BY campus_id;
                """
            )
            rows = cur.fetchall()
            if rows:
                print_ok(f"Usuarios de prueba encontrados: {rows}")
            else:
                print_fail("No se encontraron usuarios de prueba. Ejecuta seed_test_users.sql")
        conn.close()
    except Exception as e:
        print_fail(f"Fallo conexión/consulta PostgreSQL: {e}")
        return 1

    # 4) Login API (sin navegador, sin bloqueo CORS del browser)
    try:
        login_resp = http_post_json(
            login_url,
            {"campus_id": "uadmin01", "password": "Admin12345!"},
        )
        token = login_resp.get("access_token")
        if token:
            print_ok("Login API OK con uadmin01 (token recibido)")
        else:
            print_fail(f"Login respondió sin token: {login_resp}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        print_fail(f"Login falló HTTP {e.code}. body={detail}")
    except Exception as e:
        print_fail(f"Error en login API: {e}")

    print("\nDiagnóstico final completado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
