"""Formato compartido por los tres documentos del expediente.

Replica la estructura de los documentos de referencia: portada, seccion de
alcance con sus parrafos fijos, indice y cuerpo. Las funciones de este modulo
son las unicas que tocan python-docx, de modo que cada generador solo aporta
contenido.
"""
from __future__ import annotations

from pathlib import Path

import docx
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

SOFTWARE = "Campus Alertas"
SUBTITULO = (
    "Software «Campus Alertas» — Plataforma web para el registro, "
    "clasificación y atención de incidencias en un campus universitario"
)

# Parrafos que los tres documentos comparten palabra por palabra, igual que en
# los documentos de referencia.
STACK = (
    "Stack tecnológico. El sistema se compone de tres piezas. La aplicación web "
    "está desarrollada en lenguaje TypeScript sobre el framework Next.js con React, "
    "con estilos construidos mediante Tailwind CSS, y se comporta como aplicación web "
    "progresiva gracias a un manifiesto y a un service worker de autoría propia. La "
    "interfaz de programación de aplicaciones está desarrollada en lenguaje Python "
    "sobre el framework FastAPI, con acceso a datos mediante SQLAlchemy, persistencia en "
    "PostgreSQL y migraciones gestionadas con Alembic. Los procesos de servicio, escritos "
    "también en Python, consumen una cola de trabajos implementada sobre la propia base "
    "de datos y se encargan de la clasificación asistida, del envío de correos "
    "y del mantenimiento periódico. La clasificación se apoya en modelos de visión "
    "accedidos mediante el servicio TokenRouter, el correo transaccional en el servicio "
    "Brevo, la protección antiabuso de los formularios públicos en Cloudflare Turnstile "
    "y el almacenamiento de las evidencias en Cloudflare R2."
)

RECURSOS_GRAFICOS = (
    "Recursos gráficos. Este documento excluye deliberadamente todas las imágenes y "
    "capturas de pantalla, así como las referencias a figuras. Se conserva íntegro el "
    "contenido textual de autoría propia, que es el objeto de la protección. Las "
    "descripciones fueron redactadas de forma autónoma respecto de las figuras, por lo "
    "que su supresión no altera el sentido del texto."
)

NOTA = (
    "Nota. Los únicos recursos gráficos que acompañan al software son dos "
    "íconos vectoriales de autoría propia, definidos íntegramente como texto en "
    "formato SVG y transcritos en el documento «Código fuente del software». El "
    "proyecto no incorpora imágenes, fotografías ni recursos gráficos de "
    "terceros. Este documento es un apoyo técnico y no constituye asesoría legal."
)


def _set_style(style, *, font="Calibri", size=11, bold=False, italic=False,
               color=None, space_before=0, space_after=6, line=1.15,
               keep_with_next=False, left_indent=None):
    f = style.font
    f.name = font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    if color:
        f.color.rgb = RGBColor.from_string(color)
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        rfonts.set(qn(attr), font)
    p = style.paragraph_format
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    p.line_spacing = line
    p.keep_with_next = keep_with_next
    if left_indent is not None:
        p.left_indent = Cm(left_indent)


def nuevo_documento() -> docx.Document:
    doc = docx.Document()

    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    st = doc.styles
    _set_style(st["Normal"], size=11, space_after=8)
    _set_style(st["Heading 1"], size=16, bold=True, color="1F3864",
               space_before=18, space_after=8, keep_with_next=True)
    _set_style(st["Heading 2"], size=13, bold=True, color="2E5496",
               space_before=14, space_after=6, keep_with_next=True)
    _set_style(st["Heading 3"], size=11, bold=True, color="2E5496",
               space_before=10, space_after=4, keep_with_next=True)
    _set_style(st["List Bullet"], size=11, space_after=2, left_indent=0.8)

    codigo = st.add_style("CodigoFuente", docx.enum.style.WD_STYLE_TYPE.PARAGRAPH)
    _set_style(codigo, font="Consolas", size=8, space_before=0, space_after=0,
               line=1.0, left_indent=0.5)

    leyenda = st.add_style("LeyendaExtracto", docx.enum.style.WD_STYLE_TYPE.PARAGRAPH)
    _set_style(leyenda, size=9, italic=True, color="404040",
               space_before=8, space_after=3, keep_with_next=True)
    return doc


def portada(doc, titulo: str, segunda_linea: str | None = None) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(titulo)
    r.bold = True
    r.font.size = Pt(22)
    r.font.color.rgb = RGBColor.from_string("1F3864")

    if segunda_linea:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(segunda_linea)
        r.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor.from_string("2E5496")

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(SUBTITULO)
    r.font.size = Pt(11)
    r.italic = True
    p.paragraph_format.space_after = Pt(18)


def h1(doc, texto):
    return doc.add_heading(texto, level=1)


def h2(doc, texto):
    return doc.add_heading(texto, level=2)


def h3(doc, texto):
    return doc.add_heading(texto, level=3)


def parrafo(doc, texto, *, negrita_hasta_punto=False):
    """Parrafo normal. Con negrita_hasta_punto emula el estilo de los documentos
    de referencia, donde el rotulo inicial ("Stack tecnologico.") va en negrita."""
    p = doc.add_paragraph()
    if negrita_hasta_punto and "." in texto:
        corte = texto.index(".") + 1
        r = p.add_run(texto[:corte])
        r.bold = True
        p.add_run(texto[corte:])
    else:
        p.add_run(texto)
    return p


def vinetas(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        if isinstance(item, tuple):
            r = p.add_run(item[0])
            r.bold = True
            p.add_run(item[1])
        else:
            p.add_run(item)


def leyenda_extracto(doc, archivo: str, descripcion: str):
    p = doc.add_paragraph(style="LeyendaExtracto")
    p.add_run(f"▪ Extracto representativo — {archivo} — {descripcion}")
    return p


def bloque_codigo(doc, codigo: str, *, recortar: bool = True):
    """Transcribe codigo en monoespaciada dentro de un recuadro sombreado.

    `recortar` quita las lineas en blanco de los extremos, que es lo deseable
    al mostrar un fragmento suelto. El documento de codigo fuente lo desactiva:
    alli la cabecera anuncia cuantas lineas tiene el archivo, y recortar dejaba
    el recuadro con una menos --una discrepancia inconveniente en un documento
    que afirma contener el codigo completo.
    """
    lineas = codigo.replace("\t", "    ").split("\n")
    # Un archivo terminado en salto de linea produce un ultimo elemento vacio
    # que no corresponde a ninguna linea del archivo.
    if lineas and lineas[-1] == "":
        lineas.pop()
    if recortar:
        while lineas and not lineas[0].strip():
            lineas.pop(0)
        while lineas and not lineas[-1].strip():
            lineas.pop()

    for i, linea in enumerate(lineas):
        p = doc.add_paragraph(linea or " ", style="CodigoFuente")
        pPr = p._p.get_or_add_pPr()

        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), "F5F5F5")
        pPr.append(shd)

        bordes = OxmlElement("w:pBdr")
        for lado in ("left", "right"):
            b = OxmlElement(f"w:{lado}")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "6")
            b.set(qn("w:color"), "C0C0C0")
            bordes.append(b)
        if i == 0:
            b = OxmlElement("w:top")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "6")
            b.set(qn("w:color"), "C0C0C0")
            bordes.insert(0, b)
        if i == len(lineas) - 1:
            b = OxmlElement("w:bottom")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "6")
            b.set(qn("w:color"), "C0C0C0")
            bordes.append(b)
        pPr.append(bordes)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def indice(doc, niveles="1-3"):
    """Inserta un campo TOC. Word y LibreOffice lo rellenan al abrir el archivo."""
    h1(doc, "Índice")
    p = doc.add_paragraph()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), f' TOC \\o "{niveles}" \\h \\z \\u ')
    inner = OxmlElement("w:p")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "Actualice este campo para generar el índice (F9 en Word)."
    r.append(t)
    inner.append(r)
    fld.append(inner)
    p._p.addnext(fld)


def salto_de_pagina(doc):
    doc.add_page_break()


def guardar(doc, ruta):
    doc.save(ruta)
    print(f"escrito: {ruta}")


# --------------------------------------------------------- extractos vivos

RAIZ_REPO = Path(__file__).resolve().parents[2]


def extracto_funcion(ruta_relativa: str, nombre: str) -> str:
    """Devuelve una funcion completa leida del archivo real.

    Los fragmentos de codigo de estos documentos estaban escritos a mano, y con
    el tiempo seis de once dejaron de coincidir con el repositorio: uno citaba
    una funcion retirada y nombraba a un proveedor ya sustituido. Leerlos del
    archivo evita que un documento registrado describa codigo que no existe.
    """
    archivo = RAIZ_REPO / ruta_relativa
    lineas = archivo.read_text(encoding="utf-8").splitlines()

    inicio = None
    for i, linea in enumerate(lineas):
        if linea.lstrip().startswith((f"def {nombre}(", f"async def {nombre}(")):
            inicio = i
            break
    if inicio is None:
        raise SystemExit(f"No se encontro «{nombre}» en {ruta_relativa}")

    sangria = len(lineas[inicio]) - len(lineas[inicio].lstrip())
    fin = len(lineas)
    for j in range(inicio + 1, len(lineas)):
        actual = lineas[j]
        if not actual.strip():
            continue
        if len(actual) - len(actual.lstrip()) <= sangria:
            fin = j
            break
    return "\n".join(lineas[inicio:fin]).rstrip()


def extracto_lineas(ruta_relativa: str, ancla: str, cuantas: int, *, antes: int = 0) -> str:
    """Devuelve `cuantas` lineas del archivo real a partir de `ancla`."""
    archivo = RAIZ_REPO / ruta_relativa
    lineas = archivo.read_text(encoding="utf-8").splitlines()
    for i, linea in enumerate(lineas):
        if ancla in linea:
            desde = max(0, i - antes)
            return "\n".join(lineas[desde:desde + cuantas + antes]).rstrip()
    raise SystemExit(f"No se encontro «{ancla}» en {ruta_relativa}")
