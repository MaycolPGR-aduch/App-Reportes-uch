"""Genera «MANUAL DE USUARIO» para el software Campus Alertas."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import (  # noqa: E402
    NOTA, RECURSOS_GRAFICOS, STACK, guardar, h1, h2, h3, indice, nuevo_documento,
    parrafo, portada, salto_de_pagina, vinetas,
)

doc = nuevo_documento()
portada(doc, "MANUAL DE USUARIO")

# ---------------------------------------------------------------- Alcance
h1(doc, "Alcance de este documento")
parrafo(doc,
    "Este documento constituye el Manual de Usuario del software «Campus Alertas». Describe "
    "el objetivo de la aplicación, sus módulos y el modo de uso de cada uno de ellos. Campus "
    "Alertas es una aplicación web progresiva de uso institucional, orientada al registro, la "
    "clasificación automática y la atención de incidencias ocurridas dentro de un campus "
    "universitario, accesible desde el navegador de cualquier teléfono o computadora sin "
    "necesidad de instalar una aplicación.")
parrafo(doc, STACK, negrita_hasta_punto=True)
parrafo(doc,
    "Perfiles de usuario. A diferencia de un manual de audiencia única, este documento se "
    "organiza en tres recorridos independientes, porque el sistema presenta interfaces "
    "distintas según quién lo utilice: quien reporta una incidencia, el personal que la "
    "atiende y el administrador que gestiona la operación. Cada recorrido puede leerse por "
    "separado.",
    negrita_hasta_punto=True)
parrafo(doc, RECURSOS_GRAFICOS, negrita_hasta_punto=True)
parrafo(doc, NOTA, negrita_hasta_punto=True)

indice(doc)
salto_de_pagina(doc)

# --------------------------------------------------------------- Objetivo
h1(doc, "Objetivo")
parrafo(doc,
    "El objetivo principal del sistema Campus Alertas es reducir el tiempo que transcurre "
    "entre que ocurre una incidencia dentro del campus y que el personal responsable se "
    "entera de ella. Para lograrlo, el sistema permite que cualquier miembro de la comunidad "
    "universitaria registre un reporte en menos de treinta segundos desde su teléfono, "
    "adjuntando una fotografía y su ubicación; clasifica y prioriza el reporte "
    "automáticamente; avisa por correo al área que corresponde, y ofrece a la administración "
    "un panel para asignar, dar seguimiento y cerrar cada caso.")
parrafo(doc,
    "De forma complementaria, el sistema busca que reportar sea sencillo y de bajo riesgo "
    "para quien lo hace: admite reportes anónimos, elimina de cada fotografía los datos "
    "ocultos que la cámara incrusta y borra automáticamente las incidencias cerradas y sus "
    "imágenes una vez cumplido el período de conservación.")

h1(doc, "Requisitos previos")
parrafo(doc,
    "Antes de utilizar el sistema conviene verificar lo siguiente:")
vinetas(doc, [
    ("Navegador web actualizado. ", "El sistema funciona en los navegadores de uso común, "
     "tanto en teléfono como en computadora. No se requiere instalar ninguna aplicación."),
    ("Permiso de cámara o acceso a la galería. ", "Es necesario para adjuntar la fotografía "
     "de la evidencia, obligatoria en todo reporte."),
    ("Permiso de ubicación. ", "El navegador solicitará autorización para leer la ubicación "
     "satelital. Sin ella no es posible enviar el reporte, porque el sistema necesita saber "
     "en qué zona del campus ocurrió la incidencia."),
    ("Correo institucional. ", "Solo para quienes deseen crear una cuenta. El registro está "
     "restringido a los dominios de correo autorizados por la institución. Para reportar de "
     "forma anónima no se requiere cuenta alguna."),
])

# ------------------------------------------------------------- Ejecutable
h1(doc, "Descripción del ejecutable")
parrafo(doc,
    "Campus Alertas no se distribuye como un archivo instalable, sino que se accede mediante "
    "una dirección web. El sistema está compuesto por tres piezas que funcionan de forma "
    "coordinada y que el usuario percibe como una sola aplicación:")
vinetas(doc, [
    ("La aplicación web. ", "Es lo que el usuario ve y utiliza. Se abre en el navegador y "
     "puede además instalarse en la pantalla de inicio del teléfono para abrirse como una "
     "aplicación más."),
    ("El servicio central. ", "Recibe los reportes, guarda las fotografías en un "
     "almacenamiento privado y aplica las reglas sobre quién puede ver qué."),
    ("Los procesos automáticos. ", "Trabajan en segundo plano sin intervención del usuario: "
     "clasifican cada incidencia, envían los correos y depuran periódicamente la información "
     "vencida."),
])
parrafo(doc,
    "A continuación se describen los módulos más importantes del sistema, agrupados según el "
    "perfil de usuario que los utiliza:")
vinetas(doc, [
    ("Módulo de Reporte de Incidencias: ", "permite registrar una incidencia con fotografía "
     "y ubicación, con cuenta o de forma anónima."),
    ("Módulo de Registro y Acceso: ", "permite crear una cuenta institucional, verificarla e "
     "iniciar sesión."),
    ("Módulo de Seguimiento de Reportes: ", "permite al estudiante consultar el estado de "
     "las incidencias que reportó."),
    ("Módulo de Atención de Asignaciones: ", "permite al personal ver y cerrar las "
     "incidencias que le fueron asignadas."),
    ("Módulo de Gestión de Incidencias: ", "permite al administrador asignar responsables y "
     "cambiar el estado de cada caso."),
    ("Módulo de Gestión de Usuarios y Personal: ", "permite administrar cuentas y perfiles "
     "del personal asignable."),
    ("Módulo de Gestión de Zonas: ", "permite definir las zonas del campus sobre las que se "
     "ubican los reportes."),
    ("Módulo de Estado del Sistema: ", "permite verificar que los procesos automáticos estén "
     "funcionando."),
])

salto_de_pagina(doc)

# ================================================================ MODULOS
h1(doc, "Módulos")

# ---------------------------------------------- Perfil: quien reporta
h2(doc, "Recorrido 1: quien reporta una incidencia")
parrafo(doc,
    "Este recorrido está dirigido a cualquier miembro de la comunidad universitaria. No "
    "requiere conocimientos técnicos ni, si así se prefiere, tener una cuenta.")

h3(doc, "Módulo de Reporte de Incidencias")
parrafo(doc,
    "Es la pantalla principal del sistema y la primera que aparece al abrir la dirección "
    "web. Permite registrar una incidencia adjuntando una fotografía y la ubicación donde "
    "ocurrió. Sus funciones son las siguientes:")
vinetas(doc, [
    "Elección entre reportar de forma anónima o con la cuenta institucional.",
    "Captura de fotografía desde la cámara o selección desde la galería.",
    "Captura automática de la ubicación mediante el sensor satelital del dispositivo.",
    "Revisión previa de la fotografía, que sugiere un título y propone la categoría adecuada.",
    "Selección de la categoría: infraestructura, seguridad o limpieza.",
    "Descripción breve de lo ocurrido.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Elegir el modo de reporte: «Anónimo (sin login)» o «Con cuenta campus».",
    "Pulsar el botón de fotografía y tomar o seleccionar la imagen de la evidencia.",
    "Esperar a que finalice la revisión previa de la imagen. El sistema completará "
    "automáticamente un título sugerido y podrá ajustar la categoría.",
    "Escribir la descripción de lo ocurrido, entre cinco y doscientos ochenta caracteres.",
    "Pulsar el botón de ubicación y autorizar el permiso que solicite el navegador.",
    "Si se reporta de forma anónima, completar la verificación antiabuso que aparece en pantalla.",
    "Pulsar «Enviar reporte». El sistema mostrará el código de la incidencia registrada.",
])
parrafo(doc,
    "Consideraciones. Si la revisión previa indica que la imagen no corresponde a una "
    "incidencia y el usuario considera que sí lo es, puede confirmarlo mediante el botón "
    "destinado a ese fin y continuar con el envío. En cambio, si la imagen fue marcada como "
    "no permitida, el envío queda bloqueado. Para evitar el uso abusivo, los reportes "
    "anónimos están limitados en número por período desde una misma conexión.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Registro y Acceso")
parrafo(doc,
    "Permite crear una cuenta institucional y acceder con ella. Tener cuenta no es "
    "obligatorio para reportar, pero sí para consultar después el estado de los reportes "
    "propios. Sus funciones son las siguientes:")
vinetas(doc, [
    "Registro con nombre completo, código de campus, correo institucional y contraseña.",
    "Verificación de la cuenta mediante un enlace enviado al correo.",
    "Inicio de sesión con código de campus y contraseña.",
    "Restablecimiento de la contraseña olvidada.",
    "Cierre de sesión.",
])
parrafo(doc, "Cómo usar para registrarse:", negrita_hasta_punto=True)
vinetas(doc, [
    "Pulsar «Iniciar sesión» en la barra superior y, en esa pantalla, «Crear cuenta»; o "
    "abrir directamente la dirección «/register».",
    "Completar código de campus, nombre completo, correo institucional y contraseña. La "
    "contraseña debe tener al menos ocho caracteres, y el campo dispone de un botón para "
    "mostrarla u ocultarla mientras se escribe.",
    "Pulsar «Crear cuenta».",
    "Abrir el correo recibido y pulsar el enlace de verificación. Hasta ese momento la "
    "cuenta permanece inactiva y no permite iniciar sesión. Si la institución todavía no "
    "tiene configurado el envío de correo, la pantalla lo indica: la cuenta queda creada y "
    "es un administrador quien debe activarla.",
])
parrafo(doc, "Cómo usar para iniciar sesión:", negrita_hasta_punto=True)
vinetas(doc, [
    "Pulsar «Iniciar sesión» en la barra superior, o abrir la dirección «/login».",
    "Introducir el código de campus y la contraseña.",
    "Pulsar «Entrar». El sistema dirigirá a cada usuario a la pantalla que corresponde a su perfil.",
])
parrafo(doc,
    "Consideraciones. Solo se admiten correos de los dominios autorizados por la "
    "institución. Si se olvidó la contraseña, debe solicitarse el restablecimiento y seguir "
    "el enlace que llega al buzón; ese enlace es de un solo uso y caduca.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Seguimiento de Reportes")
parrafo(doc,
    "Permite al estudiante autenticado consultar el estado de las incidencias que él mismo "
    "reportó. Sus funciones son las siguientes:")
vinetas(doc, [
    "Listado de los reportes propios, del más reciente al más antiguo.",
    "Consulta del estado de cada incidencia: reportada, en revisión, en proceso, resuelta o rechazada.",
    "Consulta de la prioridad asignada y de la zona del campus detectada.",
    "Vista de detalle con la descripción y la evidencia adjunta.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Iniciar sesión con la cuenta institucional.",
    "Acceder a la sección «Dashboard» desde el menú superior.",
    "Seleccionar cualquier reporte del listado para ver su detalle.",
])
parrafo(doc,
    "Consideraciones. El listado muestra exclusivamente los reportes del usuario que ha "
    "iniciado sesión. Los reportes enviados de forma anónima no aparecen aquí, porque no "
    "quedan asociados a ninguna cuenta.",
    negrita_hasta_punto=True)

h3(doc, "Instalación en la pantalla de inicio")
parrafo(doc,
    "El sistema puede añadirse a la pantalla de inicio del teléfono y abrirse después como "
    "una aplicación independiente, sin la barra del navegador. Sus funciones son las siguientes:")
vinetas(doc, [
    "Acceso directo desde la pantalla de inicio, con ícono propio.",
    "Conservación de los recursos de la aplicación para una apertura más rápida.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la dirección del sistema en el navegador del teléfono.",
    "Abrir el menú del navegador y elegir «Añadir a pantalla de inicio» o «Instalar aplicación», "
    "según el navegador utilizado.",
    "Confirmar. El ícono quedará disponible junto al resto de aplicaciones.",
])

salto_de_pagina(doc)

# ---------------------------------------------- Perfil: personal
h2(doc, "Recorrido 2: personal asignado")
parrafo(doc,
    "Este recorrido está dirigido al personal de las áreas de mantenimiento, seguridad y "
    "limpieza que atiende las incidencias. El acceso lo habilita el administrador.")

h3(doc, "Módulo de Atención de Asignaciones")
parrafo(doc,
    "Presenta exclusivamente las incidencias que fueron asignadas al usuario que ha "
    "iniciado sesión. Sus funciones son las siguientes:")
vinetas(doc, [
    "Listado de las asignaciones propias con categoría, prioridad, zona y plazo de atención.",
    "Filtro por estado de la asignación: asignada, reconocida o completada.",
    "Consulta de la descripción de cada incidencia.",
    "Cierre de una asignación una vez atendida.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Iniciar sesión con las credenciales entregadas por el administrador. El sistema dirige "
    "automáticamente al panel de asignaciones.",
    "Revisar el listado, ordenado por fecha de asignación.",
    "Utilizar el filtro superior para ver únicamente las pendientes.",
    "Tras atender una incidencia en campo, pulsar «Completar» en la fila correspondiente.",
    "Verificar el mensaje de confirmación, que indica el estado en que quedó la incidencia.",
])
parrafo(doc,
    "Consideraciones. Al completar una asignación, la incidencia no se marca como resuelta "
    "de inmediato si otras personas también fueron asignadas al mismo caso: pasará a «en "
    "proceso» y solo quedará resuelta cuando todos los asignados hayan completado su parte. "
    "El personal no puede cerrar asignaciones de otras personas ni consultar incidencias que "
    "no le fueron encomendadas.",
    negrita_hasta_punto=True)

salto_de_pagina(doc)

# ---------------------------------------------- Perfil: administrador
h2(doc, "Recorrido 3: administrador")
parrafo(doc,
    "Este recorrido está dirigido al responsable de la operación del sistema. El panel de "
    "administración se organiza en pestañas separadas por responsabilidad —incidencias, "
    "vista social, sistema, personal, asignaciones, zonas y usuarios—, que se describen a "
    "continuación. Las operaciones que guardan cambios piden confirmación antes de "
    "aplicarlos.")

h3(doc, "Módulo de Gestión de Incidencias")
parrafo(doc,
    "Corresponde a la pestaña «Incidencias» y concentra la operación diaria. Sus funciones "
    "son las siguientes:")
vinetas(doc, [
    "Listado completo de incidencias con filtros por estado, categoría, prioridad y rango de fechas.",
    "Vista de detalle con la descripción, la ubicación, la evidencia y la traza de la clasificación automática.",
    "Asignación de una incidencia a un miembro del personal, con nota y aviso por correo.",
    "Cambio manual del estado de una incidencia.",
    "Recálculo de la zona del campus a partir de las coordenadas registradas.",
])
parrafo(doc, "Cómo usar para asignar una incidencia:", negrita_hasta_punto=True)
vinetas(doc, [
    "Iniciar sesión como administrador y abrir la pestaña «Incidencias».",
    "Seleccionar la incidencia que se desea asignar.",
    "Elegir en la lista al miembro del personal que la atenderá.",
    "Escribir opcionalmente una nota con instrucciones para el asignado.",
    "Dejar marcada la casilla de aviso por correo si se desea notificarle.",
    "Pulsar «Asignar». El sistema calcula el plazo de atención según la prioridad de la incidencia.",
])
parrafo(doc,
    "Consideraciones. El plazo de atención se calcula automáticamente a partir de la "
    "prioridad: dos horas para las críticas, seis para las altas, veinticuatro para las "
    "medias y setenta y dos para las bajas. El correo no se envía de inmediato en la misma "
    "operación, sino que se encola y lo despacha un proceso automático, de modo que la "
    "asignación se registre aunque el servicio de correo esté momentáneamente lento.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Estado del Sistema")
parrafo(doc,
    "Corresponde a la pestaña «Sistema» y permite verificar que la automatización esté "
    "funcionando, sin necesidad de acceder al servidor. Sus funciones son las siguientes:")
vinetas(doc, [
    "Estado de cada proceso automático: activo, inactivo o rezagado.",
    "Resumen de la cola de trabajos por tipo y situación.",
    "Diagnóstico del servicio de clasificación, incluida la detección de cuota agotada.",
    "Avisos en lenguaje claro sobre cualquier anomalía detectada.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la pestaña «Sistema».",
    "Revisar que los procesos figuren como activos o inactivos, pero nunca como rezagados.",
    "Comprobar que la cola no acumule trabajos pendientes de forma creciente.",
    "Leer los avisos listados al pie, si los hubiera.",
])
parrafo(doc,
    "Consideraciones. El estado «rezagado» indica que un proceso automático dejó de "
    "responder y requiere ser reiniciado. Si el diagnóstico del clasificador señala que está "
    "operando en modo de repliegue, el sistema sigue funcionando con una clasificación local "
    "más simple: las incidencias se siguen registrando y atendiendo con normalidad.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Gestión de Usuarios")
parrafo(doc,
    "Corresponde a la pestaña «Usuarios». Sus funciones son las siguientes:")
vinetas(doc, [
    "Listado de todas las cuentas con búsqueda por nombre, correo o código de campus.",
    "Filtros por perfil y por estado de la cuenta.",
    "Creación de cuentas de cualquier perfil.",
    "Edición de los datos de una cuenta y restablecimiento de su contraseña.",
    "Suspensión y reactivación de cuentas.",
])
parrafo(doc, "Cómo usar para crear una cuenta:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la pestaña «Usuarios».",
    "Completar el formulario de alta con código de campus, nombre, correo, contraseña y perfil.",
    "Si el perfil elegido es personal asignado, indicar además su área, categoría y prioridad mínima.",
    "Pulsar «Crear usuario».",
])
parrafo(doc,
    "Consideraciones. Al crear una cuenta de personal asignado, el sistema genera "
    "automáticamente su perfil de asignación correspondiente, de modo que quede disponible "
    "de inmediato para recibir incidencias. Suspender una cuenta desactiva también sus "
    "perfiles, con lo que deja de recibir nuevas asignaciones.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Gestión de Personal")
parrafo(doc,
    "Corresponde a la pestaña «Personal» y administra los perfiles que pueden recibir "
    "asignaciones. Sus funciones son las siguientes:")
vinetas(doc, [
    "Listado del personal con su área, categoría, prioridad mínima y estado.",
    "Recuento de asignaciones pendientes y completadas por persona.",
    "Alta y edición de perfiles, incluidos sus datos de contacto.",
    "Consulta del historial de asignaciones de una persona.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la pestaña «Personal».",
    "Utilizar la búsqueda y los filtros para localizar a la persona.",
    "Seleccionarla para editar su área, categoría, prioridad mínima o teléfono.",
    "Pulsar «Guardar cambios».",
])
parrafo(doc,
    "Consideraciones. La prioridad mínima determina qué avisos recibe cada persona: si se "
    "establece en «alta», no será notificada de incidencias de prioridad baja o media, "
    "aunque pertenezcan a su categoría. Es el mecanismo para evitar saturar de avisos al "
    "personal.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Gestión de Zonas")
parrafo(doc,
    "Corresponde a la pestaña «Zonas» y define las áreas del campus sobre las cuales se "
    "ubican los reportes. Sus funciones son las siguientes:")
vinetas(doc, [
    "Listado de zonas con su código, prioridad y estado.",
    "Alta de una zona mediante su polígono geográfico.",
    "Edición del polígono, la prioridad o el estado de una zona.",
    "Activación y desactivación de zonas sin eliminarlas.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la pestaña «Zonas».",
    "Completar el nombre, el código y la prioridad de la nueva zona.",
    "Pegar el polígono geográfico que delimita la zona, en el formato indicado por el formulario.",
    "Pulsar «Crear zona». El sistema valida la geometría antes de guardarla y rechaza los polígonos mal formados.",
])
parrafo(doc,
    "Consideraciones. La prioridad resuelve los casos de zonas superpuestas: cuando un punto "
    "cae dentro de varias, prevalece la de mayor prioridad y, en caso de empate, la de menor "
    "superficie. Esto permite, por ejemplo, que un laboratorio concreto prevalezca sobre el "
    "pabellón que lo contiene. Si no hay ninguna zona definida, los reportes se registran "
    "igualmente, pero su ubicación queda como indeterminada.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Captura de Zonas sobre el Terreno")
parrafo(doc,
    "Permite definir una zona recorriéndola físicamente con el teléfono, sin necesidad de "
    "conocer sus coordenadas ni de escribirlas a mano. Sus funciones son las siguientes:")
vinetas(doc, [
    "Registrar cada esquina de la zona tomando la posición del dispositivo.",
    "Promediar varias lecturas por esquina para reducir el error del receptor satelital.",
    "Mostrar una vista previa con la superficie y el perímetro estimados.",
    "Advertir de las esquinas medidas con poca precisión, de los polígonos que se cruzan "
    "consigo mismos y de los que se solapan con zonas ya registradas.",
])
parrafo(doc, "Cómo usar:", negrita_hasta_punto=True)
vinetas(doc, [
    "Abrir la pestaña «Zonas» y elegir «Capturar caminando».",
    "Situarse en una esquina de la zona y pulsar «Capturar este vértice», permaneciendo "
    "quieto durante los segundos que dura la lectura.",
    "Repetir en cada esquina, recorriendo el perímetro en orden y sin saltar de una esquina "
    "a la opuesta.",
    "Revisar la vista previa y quitar las esquinas que se hayan medido con poca precisión.",
    "Pulsar «Usar este polígono» y después «Crear zona».",
])
parrafo(doc,
    "Consideraciones. El navegador solo entrega la ubicación del dispositivo si la página se "
    "sirve mediante conexión segura. La precisión depende de la señal disponible: a cielo "
    "abierto suele ser suficiente, mientras que junto a fachadas altas o bajo cubierta "
    "conviene repetir la medición.",
    negrita_hasta_punto=True)

h3(doc, "Módulo de Triaje y Moderación")
parrafo(doc,
    "Reúne las decisiones que corresponden a una persona: confirmar o corregir la "
    "clasificación de cada incidencia, y resolver si aparece en la vista comunitaria. "
    "Cuando el régimen configurado lo prevé, el sistema muestra junto a cada campo la "
    "recomendación del modelo y su grado de confianza; la recomendación nunca se aplica "
    "por sí sola. Sus funciones son las siguientes:")
vinetas(doc, [
    "Aceptar de una vez la clasificación propuesta, o corregir la categoría y la prioridad.",
    "Asignar el área responsable de la atención.",
    "Registrar el motivo de la corrección, que queda asociado a la decisión.",
    "Publicar u ocultar una incidencia en la vista comunitaria, con su justificación.",
])
parrafo(doc,
    "Consideraciones. Ninguna incidencia se clasifica, asigna ni publica sin intervención "
    "humana. Toda decisión queda registrada junto con la propuesta del modelo, el "
    "administrador que la tomó y la fecha, de modo que puede auditarse posteriormente. Una "
    "decisión humana prevalece siempre sobre cualquier reevaluación posterior del modelo.",
    negrita_hasta_punto=True)

h2(doc, "Recorrido 4: cualquier usuario")

h3(doc, "Módulo de Cuenta Personal")
parrafo(doc,
    "Disponible para estudiantes, personal y administradores por igual, en la opción «Mi "
    "cuenta» de la barra superior. Sus funciones son las siguientes:")
vinetas(doc, [
    "Consultar el código de campus, el correo, el perfil, el estado de la cuenta y su fecha "
    "de creación.",
    "Cambiar la contraseña propia.",
    "Consultar cuántas sesiones hay abiertas en otros dispositivos y cerrarlas.",
])
parrafo(doc, "Cómo usar para cambiar la contraseña:", negrita_hasta_punto=True)
vinetas(doc, [
    "Pulsar «Mi cuenta» en la barra superior.",
    "Introducir la contraseña actual y, dos veces, la nueva.",
    "Pulsar «Cambiar contraseña».",
])
parrafo(doc,
    "Consideraciones. Se exige la contraseña actual aunque la sesión esté abierta, para "
    "impedir que alguien se apropie de una cuenta ante una pantalla desatendida. Al "
    "cambiarla se cierran las sesiones abiertas en los demás dispositivos, y se conserva "
    "únicamente aquella desde la que se realizó el cambio. El código de campus y el correo "
    "identifican la cuenta y solo puede modificarlos un administrador.",
    negrita_hasta_punto=True)

guardar(doc, str(Path(__file__).parent / "Campus Alertas - 2 Manual de Usuario (sin imagenes).docx"))
