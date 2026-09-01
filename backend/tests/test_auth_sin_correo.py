"""El despliegue no tiene proveedor de correo, y eso rompia dos flujos.

El registro guardaba la cuenta y despues fallaba con 503: la pantalla decia
error sobre algo que si habia ocurrido, y reintentar respondia "ya registrado".
La recuperacion era peor: sin correo, una direccion registrada daba 503 y una
inventada daba 200, asi que bastaba comparar para averiguar que correos tienen
cuenta.

Estas pruebas fijan que ninguna de las dos cosas vuelva a pasar.
"""

from types import SimpleNamespace

import pytest

import app.api.v1.auth as auth
# Registra todos los modelos: instanciar User sin esto deja el mapeador a
# medias y falla al resolver las relaciones.
from app.db import base as _modelos  # noqa: F401
from app.models.enums import UserRole, UserStatus
from app.models.user import User


class _Sesion:
    """Lo justo de Session para estos dos endpoints."""

    def __init__(self, usuario: User | None = None) -> None:
        self.usuario = usuario
        self.agregados: list[object] = []
        self.commits = 0

    def query(self, _modelo):
        return self

    def filter(self, *_a, **_k):
        return self

    def first(self):
        return self.usuario

    def add(self, obj):
        self.agregados.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, _obj):
        pass


@pytest.fixture
def sin_ruido(monkeypatch):
    """Neutraliza lo que rodea al flujo: limite de peticiones, captcha y unicidad."""
    monkeypatch.setattr(auth, "enforce_rate_limit", lambda *a, **k: None)
    monkeypatch.setattr(auth, "verify_turnstile", lambda *a, **k: None)
    monkeypatch.setattr(auth, "_ensure_unique_user", lambda *a, **k: None)
    monkeypatch.setattr(auth, "issue_account_token", lambda *a, **k: "testigo-de-prueba")


def _peticion_de_registro():
    return SimpleNamespace(
        campus_id="uestudiante99",
        full_name="Estudiante Noventa",
        email="estudiante99@uch.edu.pe",
        password="ClaveLarga123!",
    )


def _peticion_http():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})


# ------------------------------------------------------------- registro

def test_sin_correo_la_cuenta_se_crea_y_se_avisa(monkeypatch, sin_ruido) -> None:
    """Regresion: antes levantaba 503 despues de haber guardado la cuenta."""
    monkeypatch.setattr(auth, "email_delivery_configured", lambda: False)
    monkeypatch.setattr(
        auth, "send_account_link", lambda **k: pytest.fail("no debe intentar enviar")
    )
    db = _Sesion()

    respuesta = auth.register(_peticion_de_registro(), _peticion_http(), None, db)

    assert len(db.agregados) == 1, "la cuenta debe quedar guardada igualmente"
    assert "administrator" in respuesta.message.lower()


def test_sin_correo_la_cuenta_queda_inactiva(monkeypatch, sin_ruido) -> None:
    """Que no falle no significa que se active sola: sigue necesitando aprobacion."""
    monkeypatch.setattr(auth, "email_delivery_configured", lambda: False)
    monkeypatch.setattr(auth, "send_account_link", lambda **k: None)
    db = _Sesion()

    auth.register(_peticion_de_registro(), _peticion_http(), None, db)

    creado = db.agregados[0]
    assert creado.status == UserStatus.INACTIVE
    assert creado.role == UserRole.STUDENT


def test_con_correo_se_comporta_como_siempre(monkeypatch, sin_ruido) -> None:
    enviados = []
    monkeypatch.setattr(auth, "email_delivery_configured", lambda: True)
    monkeypatch.setattr(auth, "send_account_link", lambda **k: enviados.append(k))
    db = _Sesion()

    respuesta = auth.register(_peticion_de_registro(), _peticion_http(), None, db)

    assert len(enviados) == 1
    assert enviados[0]["purpose"] == "VERIFY_EMAIL"
    assert "verify" in respuesta.message.lower()


# ------------------------------------------------- recuperacion de clave

def _usuario_registrado() -> User:
    return User(
        campus_id="uestudiante01",
        full_name="Estudiante Uno",
        email="registrado@uch.edu.pe",
        password_hash="x",
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


def _pedir_recuperacion(monkeypatch, *, usuario, correo_configurado):
    monkeypatch.setattr(auth, "email_delivery_configured", lambda: correo_configurado)
    monkeypatch.setattr(auth, "issue_account_token", lambda *a, **k: "testigo")
    monkeypatch.setattr(auth, "send_account_link", lambda **k: None)
    peticion = SimpleNamespace(email="registrado@uch.edu.pe")
    return auth.request_password_reset(peticion, _Sesion(usuario))


@pytest.mark.parametrize(
    "hacer_usuario, correo_configurado",
    [
        (_usuario_registrado, False),  # existe, pero no hay correo
        (lambda: None, False),         # no existe, ni hay correo
        (_usuario_registrado, True),   # existe y hay correo
        (lambda: None, True),          # no existe, pero hay correo
    ],
)
def test_la_respuesta_no_revela_si_el_correo_esta_registrado(
    monkeypatch, hacer_usuario, correo_configurado
) -> None:
    """Los cuatro casos deben ser indistinguibles desde fuera.

    Antes no lo eran: sin proveedor de correo, una direccion registrada
    respondia 503 y una inventada 200.
    """
    respuesta = _pedir_recuperacion(
        monkeypatch, usuario=hacer_usuario(), correo_configurado=correo_configurado
    )

    assert respuesta.message == "If the email exists, a reset link has been sent."


def test_sin_correo_no_se_intenta_enviar(monkeypatch) -> None:
    """Comprobar antes de enviar, y no capturar el 503 despues, es lo que evita
    que el tiempo de respuesta delate al usuario existente."""
    monkeypatch.setattr(auth, "email_delivery_configured", lambda: False)
    monkeypatch.setattr(auth, "issue_account_token", lambda *a, **k: "testigo")
    monkeypatch.setattr(
        auth, "send_account_link", lambda **k: pytest.fail("no debe intentar enviar")
    )

    auth.request_password_reset(
        SimpleNamespace(email="registrado@uch.edu.pe"), _Sesion(_usuario_registrado())
    )
