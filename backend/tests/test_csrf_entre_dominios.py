"""Con el frontend en Vercel y la API en Render, el CSRF de doble envio dejo de
funcionar y todo el panel quedo de solo lectura.

El cliente leia el testigo de `document.cookie`, pero una pagina solo ve las
cookies de su propio dominio: nunca podia leer la que ponia la API. La cabecera
no se enviaba y cada POST se rechazaba con 403.

Peor aun, ese 403 salia sin cabeceras CORS --el middleware de seguridad estaba
por fuera del de CORS-- asi que el navegador lo denunciaba como fallo de
configuracion de origenes y ocultaba el error real.

En local no se notaba: frontend y API compartian `localhost`, y las cookies
ignoran el puerto.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.db import base as _modelos  # noqa: F401
from app.services.sessions import set_session_cookies

ORIGEN = "https://app-reportes-uch.vercel.app"


# ---------------------------------------- el testigo llega hasta el cliente

def test_set_session_cookies_devuelve_el_testigo_que_puso() -> None:
    """El cliente no puede leer la cookie entre dominios: hay que darselo."""
    from starlette.responses import Response

    respuesta = Response()
    devuelto = set_session_cookies(respuesta, "sesion-de-prueba")

    en_cookie = None
    for cabecera in respuesta.raw_headers:
        if cabecera[0].lower() == b"set-cookie" and b"campus_csrf=" in cabecera[1]:
            en_cookie = cabecera[1].decode().split("campus_csrf=")[1].split(";")[0]

    assert devuelto, "sin testigo no hay forma de firmar las peticiones"
    assert devuelto == en_cookie, "el devuelto debe ser el mismo que el de la cookie"


def test_el_testigo_de_la_cookie_no_es_adivinable() -> None:
    from starlette.responses import Response

    primero = set_session_cookies(Response(), "sesion-a")
    segundo = set_session_cookies(Response(), "sesion-b")

    assert primero != segundo
    assert len(primero) >= 32


# ------------------------------- el 403 debe llegar al navegador como 403

def _app_con_orden(cors_por_fuera: bool) -> FastAPI:
    """Reproduce el montaje de middlewares de `app.main`.

    `add_middleware` inserta cada uno por delante del anterior, asi que el
    ultimo registrado es el mas externo.
    """
    app = FastAPI()

    @app.post("/protegido")
    def protegido():  # pragma: no cover - no deberia llegar
        return {"ok": True}

    def montar_cors():
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[ORIGEN],
            allow_credentials=True,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type", "X-CSRF-Token"],
        )

    if not cors_por_fuera:
        montar_cors()

    @app.middleware("http")
    async def rechazar(request, call_next):
        if request.method == "POST":
            return JSONResponse(status_code=403, content={"detail": "Invalid CSRF token"})
        return await call_next(request)

    if cors_por_fuera:
        montar_cors()

    return app


def test_el_rechazo_de_csrf_conserva_la_cabecera_de_origen() -> None:
    """Regresion: sin esto el navegador ve un fallo de CORS en vez del 403, y
    manda a depurar la configuracion de origenes en lugar del problema real."""
    cliente = TestClient(_app_con_orden(cors_por_fuera=True))

    respuesta = cliente.post("/protegido", headers={"Origin": ORIGEN})

    assert respuesta.status_code == 403
    assert respuesta.headers.get("access-control-allow-origin") == ORIGEN


def test_con_el_orden_antiguo_la_cabecera_se_perdia() -> None:
    """Fija por que el orden importa, para que nadie lo revierta sin querer."""
    cliente = TestClient(_app_con_orden(cors_por_fuera=False))

    respuesta = cliente.post("/protegido", headers={"Origin": ORIGEN})

    assert respuesta.status_code == 403
    assert respuesta.headers.get("access-control-allow-origin") is None


# --------------------------------------------- el orden real de app.main

def test_app_main_monta_cors_por_fuera_del_middleware_de_seguridad() -> None:
    """Comprueba el montaje real, no una reproduccion."""
    from app.core.config import get_settings
    from app.main import app

    if not get_settings().cors_origins:
        pytest.skip("sin CORS_ORIGINS configurado no hay nada que comprobar")

    nombres = [m.cls.__name__ for m in app.user_middleware]
    assert "CORSMiddleware" in nombres, "CORS no esta montado"
    # El primero de la lista es el mas externo.
    assert nombres[0] == "CORSMiddleware", (
        f"CORS debe envolver al resto para que sus cabeceras lleguen a las "
        f"respuestas de error; orden actual: {nombres}"
    )
