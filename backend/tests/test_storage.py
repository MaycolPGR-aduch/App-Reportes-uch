"""Las evidencias pasan de vivir en el disco del servidor a un almacén de
objetos. El riesgo del cambio no es guardar mal: es que `storage_path` deje de
significar lo mismo en cada almacén y las imágenes ya guardadas se vuelvan
irrecuperables. Estas pruebas fijan ese contrato."""

import io
import re

import pytest
from botocore.exceptions import ClientError

from app.services.storage import (
    EvidenceNotStored,
    LocalStorageProvider,
    S3StorageProvider,
    _build_relative_path,
)

CLAVE = re.compile(r"^evidences/\d{4}/\d{2}/\d{2}/[0-9a-f]{32}\.(jpg|png|webp)$")


# ------------------------------------------------------- forma de la clave

def test_la_clave_lleva_la_fecha_y_un_nombre_irrepetible() -> None:
    assert CLAVE.match(_build_relative_path("image/webp", prefix="evidences"))


def test_dos_subidas_seguidas_no_colisionan() -> None:
    primera = _build_relative_path("image/jpeg", prefix="evidences")
    segunda = _build_relative_path("image/jpeg", prefix="evidences")

    assert primera != segunda


def test_rechaza_un_tipo_no_admitido() -> None:
    """El nombre del archivo sale del mime; sin extensión conocida no hay clave."""
    with pytest.raises(ValueError):
        _build_relative_path("application/pdf", prefix="evidences")


# ---------------------------------------------------------- almacén local

def test_guarda_y_recupera_los_mismos_bytes(tmp_path) -> None:
    almacen = LocalStorageProvider(tmp_path / "evidences")
    contenido = b"\x89PNG\r\n\x1a\n contenido de prueba"

    guardado = almacen.save_incident_image(content=contenido, mime_type="image/png")

    assert CLAVE.match(guardado.relative_path)
    assert almacen.read(guardado.relative_path) == contenido


def test_leer_algo_que_no_esta_no_es_un_error_del_servidor(tmp_path) -> None:
    """La fila puede existir sin su archivo: eso es un 404, no un 500."""
    almacen = LocalStorageProvider(tmp_path / "evidences")

    with pytest.raises(EvidenceNotStored):
        almacen.read("evidences/2026/01/01/" + "0" * 32 + ".webp")


@pytest.mark.parametrize(
    "ruta", ["../../../etc/passwd", "evidences/../../secreto.txt"]
)
def test_una_ruta_que_se_sale_del_almacen_no_se_lee(tmp_path, ruta: str) -> None:
    """`storage_path` viene de la base, pero una fila manipulada no debe poder
    sacar archivos de fuera del almacén."""
    almacen = LocalStorageProvider(tmp_path / "evidences")

    with pytest.raises(EvidenceNotStored):
        almacen.read(ruta)


def test_borrar_dos_veces_no_falla(tmp_path) -> None:
    """La purga por retención puede reintentarse tras un fallo a medias."""
    almacen = LocalStorageProvider(tmp_path / "evidences")
    guardado = almacen.save_incident_image(content=b"x", mime_type="image/webp")

    almacen.delete(guardado.relative_path)
    almacen.delete(guardado.relative_path)


# ------------------------------------------------------------ almacén S3

class _ClienteFalso:
    """Imita lo justo de boto3 para comprobar qué se le pide.

    `ausencia` decide cómo dice este proveedor que la clave no existe: R2 y AWS
    levantan NoSuchKey, otros almacenes compatibles devuelven un 404 genérico.
    """

    def __init__(self, ausencia: str = "NoSuchKey") -> None:
        self.objetos: dict[str, bytes] = {}
        self.tipos: dict[str, str] = {}
        self.ausencia = ausencia

    def put_object(self, *, Bucket, Key, Body, ContentType):
        self.objetos[Key] = Body
        self.tipos[Key] = ContentType

    def get_object(self, *, Bucket, Key):
        if Key not in self.objetos:
            raise _error_s3(self.ausencia, 404)
        return {"Body": io.BytesIO(self.objetos[Key])}

    def delete_object(self, *, Bucket, Key):
        self.objetos.pop(Key, None)


def _error_s3(codigo: str, estado: int) -> ClientError:
    return ClientError(
        {"Error": {"Code": codigo}, "ResponseMetadata": {"HTTPStatusCode": estado}},
        "GetObject",
    )


def _montar(monkeypatch, cliente):
    import boto3

    monkeypatch.setattr(boto3, "client", lambda *a, **k: cliente)
    return S3StorageProvider(bucket="campus", endpoint_url="https://s3.example")


@pytest.fixture
def almacen_s3(monkeypatch):
    cliente = _ClienteFalso()
    return _montar(monkeypatch, cliente), cliente


def test_s3_guarda_y_recupera_los_mismos_bytes(almacen_s3) -> None:
    almacen, _ = almacen_s3
    contenido = b"bytes de una evidencia"

    guardado = almacen.save_incident_image(content=contenido, mime_type="image/jpeg")

    assert almacen.read(guardado.relative_path) == contenido


def test_s3_usa_la_misma_forma_de_clave_que_el_local(almacen_s3) -> None:
    """El invariante que hace migrable el almacén: si las claves coincidieran solo
    por casualidad, copiar los archivos a R2 dejaría las filas apuntando a nada."""
    almacen, _ = almacen_s3

    guardado = almacen.save_incident_image(content=b"x", mime_type="image/webp")

    assert CLAVE.match(guardado.relative_path)


def test_s3_declara_el_tipo_al_subir(almacen_s3) -> None:
    """Sin `ContentType` el navegador se descarga la imagen en vez de mostrarla."""
    almacen, cliente = almacen_s3

    guardado = almacen.save_incident_image(content=b"x", mime_type="image/webp")

    assert cliente.tipos[guardado.relative_path] == "image/webp"


def test_s3_traduce_la_ausencia_al_mismo_error_que_el_local(almacen_s3) -> None:
    """Los endpoints capturan `EvidenceNotStored`: si S3 escapara su propia
    excepción, un archivo ausente daría 500 en vez de 404."""
    almacen, _ = almacen_s3

    with pytest.raises(EvidenceNotStored):
        almacen.read("evidences/2026/01/01/" + "0" * 32 + ".webp")


def test_s3_borrar_algo_ausente_no_falla(almacen_s3) -> None:
    almacen, _ = almacen_s3

    almacen.delete("evidences/2026/01/01/" + "0" * 32 + ".webp")


def test_s3_reconoce_la_ausencia_aunque_el_proveedor_no_use_nosuchkey(monkeypatch) -> None:
    """Regresión: solo se capturaba NoSuchKey, el nombre que usan R2 y AWS. Un
    almacén que responda un 404 genérico habría dado 500 en vez de 404."""
    almacen = _montar(monkeypatch, _ClienteFalso(ausencia="NotFound"))

    with pytest.raises(EvidenceNotStored):
        almacen.read("evidences/2026/01/01/" + "0" * 32 + ".webp")


def test_s3_no_disfraza_un_fallo_real_de_foto_ausente(monkeypatch) -> None:
    """Credenciales malas o red caída deben subir como error, no convertirse en
    un 404 que haría pensar que la evidencia se perdió."""
    cliente = _ClienteFalso()
    cliente.get_object = lambda **kw: (_ for _ in ()).throw(
        _error_s3("AccessDenied", 403)
    )
    almacen = _montar(monkeypatch, cliente)

    with pytest.raises(ClientError):
        almacen.read("evidences/2026/01/01/" + "0" * 32 + ".webp")
