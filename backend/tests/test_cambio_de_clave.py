"""Hasta ahora nadie podia cambiar su contrasena estando dentro.

El unico camino era el de recuperacion por correo, que necesita un proveedor
configurado. En el despliegue no lo hay, asi que la contrasena con la que se
creo una cuenta era la contrasena para siempre.

Estas pruebas fijan las tres decisiones del endpoint nuevo: que exija la actual,
que la nueva sea distinta, y que cambiarla cierre las demas sesiones.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.v1.auth as auth
from app.core.security import hash_password, verify_password
from app.db import base as _modelos  # noqa: F401
from app.models.enums import UserRole, UserStatus
from app.models.user import User

CLAVE_ACTUAL = "ClaveActual123!"
CLAVE_NUEVA = "ClaveNueva456!"


class _Consulta:
    def __init__(self, registro: list) -> None:
        self.registro = registro
        self.filtros = 0

    def filter(self, *condiciones, **_k):
        # Se cuentan condiciones, no llamadas: el codigo agrupa varias en una
        # sola llamada a filter() y anade la ultima aparte.
        self.filtros += len(condiciones)
        return self

    def count(self) -> int:
        return 0

    def update(self, valores, **_k) -> int:
        self.registro.append({"filtros": self.filtros, "valores": valores})
        return 2


class _Sesion:
    def __init__(self) -> None:
        self.revocaciones: list = []
        self.commits = 0

    def query(self, _modelo):
        return _Consulta(self.revocaciones)

    def commit(self):
        self.commits += 1


@pytest.fixture
def usuario() -> User:
    return User(
        campus_id="uestudiante01",
        full_name="Estudiante Uno",
        email="uno@uch.edu.pe",
        password_hash=hash_password(CLAVE_ACTUAL),
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )


@pytest.fixture(autouse=True)
def sin_limite(monkeypatch):
    monkeypatch.setattr(auth, "enforce_rate_limit", lambda *a, **k: None)


def _peticion(cookie: str | None = "testigo-de-sesion"):
    return SimpleNamespace(
        cookies={"campus_session": cookie} if cookie else {},
        client=SimpleNamespace(host="127.0.0.1"),
        headers={},
    )


def _cambiar(usuario, db, actual=CLAVE_ACTUAL, nueva=CLAVE_NUEVA):
    payload = SimpleNamespace(current_password=actual, new_password=nueva)
    return auth.change_password(payload, _peticion(), db, usuario)


# ------------------------------------------------------ exigir la actual

def test_una_contrasena_actual_incorrecta_no_cambia_nada(usuario) -> None:
    """Tener la sesion abierta no basta: quien se siente un momento ante una
    pantalla desatendida no debe poder apropiarse de la cuenta."""
    antes = usuario.password_hash
    db = _Sesion()

    with pytest.raises(HTTPException) as excinfo:
        _cambiar(usuario, db, actual="LaEquivocada999!")

    assert excinfo.value.status_code == 403
    assert usuario.password_hash == antes
    assert db.commits == 0


def test_repetir_la_misma_contrasena_se_rechaza(usuario) -> None:
    db = _Sesion()

    with pytest.raises(HTTPException) as excinfo:
        _cambiar(usuario, db, nueva=CLAVE_ACTUAL)

    assert excinfo.value.status_code == 400
    assert db.commits == 0


# ---------------------------------------------------------- el cambio

def test_con_la_actual_correcta_la_contrasena_cambia(usuario) -> None:
    db = _Sesion()

    _cambiar(usuario, db)

    assert verify_password(CLAVE_NUEVA, usuario.password_hash)
    assert not verify_password(CLAVE_ACTUAL, usuario.password_hash)
    assert db.commits == 1


def test_la_nueva_contrasena_no_se_guarda_en_claro(usuario) -> None:
    db = _Sesion()

    _cambiar(usuario, db)

    assert CLAVE_NUEVA not in usuario.password_hash
    assert usuario.password_hash.startswith("$argon2id$")


# ------------------------------------------------- cierre de sesiones

def test_cambiar_la_contrasena_revoca_las_demas_sesiones(usuario) -> None:
    """Si se cambia por sospecha, dejar abiertas las de otros dispositivos no
    arreglaria nada."""
    db = _Sesion()

    _cambiar(usuario, db)

    assert len(db.revocaciones) == 1, "debe revocarse en una sola operacion"
    # La clave del diccionario es el atributo de SQLAlchemy, no una cadena.
    campos = {getattr(c, "key", c) for c in db.revocaciones[0]["valores"]}
    assert campos == {"revoked_at"}


def test_se_conserva_la_sesion_desde_la_que_se_cambia(usuario) -> None:
    """Cuatro filtros: usuario, no revocada, no expirada, y distinta de esta.

    El cuarto es el que evita expulsar a quien acaba de cambiarla.
    """
    db = _Sesion()

    _cambiar(usuario, db)

    assert db.revocaciones[0]["filtros"] == 4


def test_sin_cookie_de_sesion_no_se_excluye_ninguna(usuario) -> None:
    """Sin poder identificar la sesion actual se revocan todas: preferible
    pedir que vuelva a entrar que dejar viva una sesion desconocida."""
    db = _Sesion()
    payload = SimpleNamespace(current_password=CLAVE_ACTUAL, new_password=CLAVE_NUEVA)

    auth.change_password(payload, _peticion(cookie=None), db, usuario)

    assert db.revocaciones[0]["filtros"] == 3
