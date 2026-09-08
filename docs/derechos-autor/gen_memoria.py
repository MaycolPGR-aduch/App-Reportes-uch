"""Genera «MEMORIA DESCRIPTIVA» para el software Campus Alertas."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comun import (  # noqa: E402
    extracto_funcion, extracto_lineas,
    NOTA, RECURSOS_GRAFICOS, STACK, bloque_codigo, guardar, h1, h2, h3, indice,
    leyenda_extracto, nuevo_documento, parrafo, portada, salto_de_pagina, vinetas,
)

doc = nuevo_documento()
portada(doc, "MEMORIA DESCRIPTIVA")

# ---------------------------------------------------------------- Alcance
h1(doc, "Alcance de este documento")
parrafo(doc,
    "Este documento constituye la Memoria Descriptiva del software «Campus Alertas», y "
    "describe su fundamento técnico, la composición de su interfaz y la responsabilidad "
    "funcional de cada uno de sus módulos. Campus Alertas es una aplicación web progresiva "
    "de uso institucional, orientada al registro, la clasificación automática y la atención "
    "de incidencias ocurridas dentro de un campus universitario. El sistema permite que "
    "cualquier miembro de la comunidad reporte una incidencia desde el navegador de su "
    "teléfono adjuntando evidencia fotográfica y su ubicación satelital; clasifica y prioriza "
    "el reporte de forma automática; notifica por correo al personal responsable del área "
    "correspondiente, y ofrece a la administración un panel de seguimiento y asignación.")
parrafo(doc, STACK, negrita_hasta_punto=True)
parrafo(doc,
    "Extractos de código. Al final de la descripción de cada módulo se incluye un extracto "
    "representativo del código fuente de autoría propia que implementa su lógica principal, "
    "transcrito en tipografía monoespaciada para distinguirlo del texto descriptivo. El "
    "código fuente completo se presenta en el documento «Código fuente del software».",
    negrita_hasta_punto=True)
parrafo(doc, RECURSOS_GRAFICOS, negrita_hasta_punto=True)
parrafo(doc, NOTA, negrita_hasta_punto=True)

indice(doc)
salto_de_pagina(doc)

# ------------------------------------------------- Fundamento tecnologico
h1(doc, "Fundamento teórico de las tecnologías empleadas")
parrafo(doc,
    "A diferencia de una aplicación móvil nativa, que se compila en un solo lenguaje y se "
    "ejecuta íntegramente en el dispositivo, Campus Alertas es un sistema distribuido: la "
    "interfaz se ejecuta en el navegador del usuario, la lógica de negocio en un servidor y "
    "el procesamiento diferido en procesos independientes. Cada una de esas capas exige "
    "tecnologías distintas, cuya elección se fundamenta a continuación.")

h2(doc, "Lenguaje de programación Python y el framework FastAPI")
parrafo(doc,
    "Python es un lenguaje interpretado, de tipado dinámico y sintaxis legible, ampliamente "
    "adoptado en el desarrollo de servicios web y en el tratamiento de datos. Sobre él se "
    "emplea FastAPI, un framework que construye la interfaz de programación a partir de las "
    "anotaciones de tipo del propio código: valida automáticamente los datos que ingresan, "
    "serializa los que salen y publica la especificación del servicio sin trabajo adicional.")
parrafo(doc,
    "Frente a alternativas como PHP o Java, la combinación de Python con FastAPI resulta "
    "especialmente adecuada para este proyecto por cuatro razones:")
vinetas(doc, [
    ("Validación declarativa. ", "Los esquemas de entrada y salida se declaran una sola vez "
     "y el framework rechaza automáticamente cualquier petición malformada, lo que reduce la "
     "superficie de error en un sistema que recibe archivos y coordenadas desde el exterior."),
    ("Inyección de dependencias. ", "El control de acceso por roles se expresa como una "
     "dependencia reutilizable que se declara en cada endpoint, evitando repetir la "
     "verificación de permisos en cada función."),
    ("Ecosistema de tratamiento de imágenes e inteligencia artificial. ", "Las bibliotecas "
     "necesarias para normalizar fotografías y para consumir modelos de lenguaje están "
     "disponibles de forma nativa en este lenguaje."),
    ("Un solo lenguaje para servicio y procesos diferidos. ", "La interfaz de programación y "
     "los tres procesos de servicio comparten modelos de datos y utilidades, sin duplicar lógica."),
])

h2(doc, "Lenguaje TypeScript y el framework Next.js con React")
parrafo(doc,
    "TypeScript es un superconjunto de JavaScript que añade un sistema de tipos verificado "
    "en tiempo de compilación. React organiza la interfaz en componentes cuyo aspecto se "
    "deriva de su estado, y Next.js aporta el enrutamiento por sistema de archivos, la "
    "compilación optimizada y el control de las cabeceras de seguridad del servidor web.")
parrafo(doc, "Sus ventajas para este sistema son:")
vinetas(doc, [
    ("Contrato verificado con el servicio. ", "Los tipos que describen las respuestas de la "
     "interfaz de programación se declaran en el cliente, de modo que cualquier discrepancia "
     "entre lo que el servicio entrega y lo que la interfaz espera se detecta al compilar y "
     "no en producción."),
    ("Acceso a sensores desde el navegador. ", "La captura de fotografía y de coordenadas "
     "satelitales se resuelve con las interfaces estándar del navegador, sin necesidad de "
     "instalar una aplicación."),
    ("Aplicación web progresiva. ", "La aplicación se instala en la pantalla de inicio del "
     "teléfono y conserva sus recursos en caché mediante un service worker propio."),
    ("Control de la política de seguridad de contenido. ", "El framework permite declarar "
     "las cabeceras de seguridad que restringen el origen de los recursos que la página "
     "puede cargar."),
])

h2(doc, "Sistema de gestión de base de datos PostgreSQL")
parrafo(doc,
    "PostgreSQL es un gestor de base de datos relacional de código abierto. Su elección "
    "responde a tres capacidades que el sistema aprovecha de forma directa: los tipos "
    "enumerados nativos, que impiden a nivel de motor que una incidencia adopte un estado "
    "inexistente; el tipo de dato JSONB, que almacena los polígonos que delimitan las zonas "
    "del campus y las respuestas del clasificador conservando su estructura; y el bloqueo "
    "selectivo de filas, que permite que varios procesos de servicio consuman la misma cola "
    "de trabajos sin procesar dos veces la misma tarea ni bloquearse entre sí.")

# --------------------------------------------------------- Arquitectura
h1(doc, "Arquitectura general del sistema")
parrafo(doc,
    "El sistema se organiza en tres piezas ejecutables que comparten una única base de datos:")
vinetas(doc, [
    ("Aplicación web. ", "Interfaz que se ejecuta en el navegador. Contiene el formulario "
     "público de reporte y los paneles diferenciados de administración y de personal asignado."),
    ("Interfaz de programación de aplicaciones. ", "Servicio que expone las operaciones del "
     "sistema mediante rutas organizadas en cuatro grupos: autenticación, reportes, "
     "administración y personal asignado. Concentra todas las reglas de negocio y de "
     "control de acceso."),
    ("Procesos de servicio. ", "Tres programas independientes que consumen la cola de "
     "trabajos: el de clasificación, el de notificaciones y el de mantenimiento."),
])
parrafo(doc,
    "La comunicación entre la aplicación web y la interfaz de programación se realiza "
    "mediante peticiones que transportan una cookie de sesión inaccesible al código de la "
    "página. El desacople entre la atención de la petición y el trabajo diferido se resuelve "
    "mediante una tabla de trabajos: cuando se registra una incidencia, el servicio responde "
    "de inmediato al usuario y encola la clasificación, que un proceso independiente "
    "recogerá. Esta decisión evita que la lentitud o la caída de un servicio externo afecte "
    "al tiempo de respuesta percibido por quien reporta.")

# ------------------------------------------------------- Modelo de datos
h1(doc, "Modelo de datos")
parrafo(doc,
    "La información persiste en trece tablas relacionales y diez tipos enumerados nativos. "
    "Las tablas se agrupan en cinco conjuntos según su responsabilidad:")
vinetas(doc, [
    ("Identidad y sesión. ", "«users» almacena las cuentas con su rol y estado; "
     "«auth_sessions» las sesiones activas, guardando únicamente el resumen criptográfico "
     "del identificador de sesión y nunca su valor original; «account_tokens» los códigos de "
     "un solo uso para verificar el correo y restablecer la contraseña."),
    ("Incidencia y evidencia. ", "«incidents» es la tabla central; «incident_locations» "
     "guarda las coordenadas y la zona resuelta; «incident_evidences» registra la referencia "
     "a la fotografía almacenada, su tipo, su tamaño y su resumen criptográfico."),
    ("Organización del campus. ", "«campus_zones» define cada zona mediante un polígono "
     "geográfico y una prioridad de desempate; «responsibles» describe los perfiles del "
     "personal asignable por área y categoría."),
    ("Atención y comunicación. ", "«incident_assignments» vincula una incidencia con un "
     "responsable y su plazo de atención; «notifications» registra cada correo emitido con "
     "su estado de entrega."),
    ("Automatización. ", "«jobs» es la cola de trabajos; «ai_metrics» conserva la traza "
     "completa de cada clasificación automática; «rate_limit_buckets» sostiene el control "
     "de frecuencia de las operaciones públicas."),
])
parrafo(doc,
    "El esquema declara integridad referencial explícita y diferenciada según el caso: la "
    "eliminación de una incidencia arrastra en cascada su ubicación, sus evidencias, sus "
    "asignaciones y sus trabajos, mientras que la eliminación de una cuenta de usuario "
    "conserva las incidencias que reportó, desvinculándolas. Esta última decisión permite "
    "que el sistema admita reportes anónimos y que la baja de una cuenta no destruya el "
    "histórico operativo del campus.")

# -------------------------------------------------------------- Roles
h1(doc, "Modelo de roles y control de acceso")
parrafo(doc,
    "El sistema reconoce tres roles y un modo sin identificar. Cada uno accede a un "
    "subconjunto distinto de la información:")
vinetas(doc, [
    ("Anónimo. ", "Puede registrar una incidencia sin cuenta. A cambio, queda sujeto al "
     "control de frecuencia por dirección de red y a la verificación antiabuso."),
    ("Estudiante. ", "Registra incidencias asociadas a su cuenta y consulta únicamente "
     "aquellas que él mismo reportó."),
    ("Personal asignado. ", "Consulta y atiende exclusivamente las incidencias que le han "
     "sido asignadas, sin visibilidad sobre el resto de la operación."),
    ("Administrador. ", "Accede a la operación completa: listado y detalle de todas las "
     "incidencias, gestión de cuentas, del personal y de las zonas, asignación manual y "
     "estado de los procesos de servicio."),
])
parrafo(doc,
    "El control no se limita a ocultar opciones en la interfaz: se aplica en el servicio, "
    "de modo que una petición construida manualmente tampoco obtiene información ajena al "
    "rol. Además, el serializador de incidencias suprime los campos sensibles —identidad de "
    "quien reporta, traza del clasificador y destinatarios de las notificaciones— para todo "
    "rol distinto del administrador.")
leyenda_extracto(doc, "app/api/deps.py",
                 "verificación de rol reutilizable como dependencia del servicio")
bloque_codigo(doc, extracto_funcion("backend/app/api/deps.py", "get_current_admin"))

salto_de_pagina(doc)

# ------------------------------------------------------------ Modulos
h1(doc, "Contenido en la interfaz del software")
parrafo(doc,
    "El sistema titulado «Campus Alertas» está compuesto por los módulos que se describen a "
    "continuación. A diferencia de una aplicación compuesta únicamente por pantallas, aquí "
    "algunos módulos carecen de interfaz visible y operan como procesos de servicio; en esos "
    "casos se describe su responsabilidad funcional en lugar de sus elementos de interfaz.")
vinetas(doc, [
    "Módulo de Registro y Autenticación",
    "Módulo de Reporte de Incidencias",
    "Módulo de Clasificación Automática",
    "Módulo de Georreferenciación y Zonas del Campus",
    "Módulo de Procesamiento Asíncrono de Trabajos",
    "Módulo de Notificaciones por Correo",
    "Módulo de Consulta y Seguimiento de Incidencias",
    "Módulo de Gestión Administrativa",
    "Módulo de Atención de Asignaciones",
    "Módulo de Mantenimiento y Retención de Datos",
])

# --- 1
h2(doc, "Módulo de Registro y Autenticación")
parrafo(doc,
    "Gobierna el ingreso al sistema y el ciclo de vida de las credenciales. El registro es "
    "público pero restringido a los dominios de correo institucionales configurados: una "
    "cuenta recién creada nace inactiva y solo se habilita cuando su titular confirma su "
    "correo mediante un enlace de un solo uso. La sesión no se representa con un token "
    "almacenado en el navegador, sino con una cookie inaccesible al código de la página, "
    "acompañada de una segunda cookie que el cliente debe reflejar en cada operación de "
    "escritura para acreditar que la petición proviene de la propia aplicación.")
parrafo(doc, "Elementos principales de la interfaz:")
vinetas(doc, [
    "Formulario de inicio de sesión con código de campus y contraseña.",
    "Formulario de registro con nombre completo, código de campus, correo institucional y contraseña.",
    "Alternador entre las pestañas «Iniciar sesión» y «Registrarse».",
    "Pantalla de verificación de correo, alcanzada desde el enlace enviado al buzón.",
    "Pantalla de restablecimiento de contraseña.",
    "Botón de cierre de sesión, que revoca la sesión en el servidor y no solo en el navegador.",
])
parrafo(doc,
    "Las contraseñas nunca se almacenan: se guarda su derivación mediante la función Argon2id, "
    "resistente a ataques con hardware especializado. El sistema conserva compatibilidad con "
    "un esquema anterior basado en PBKDF2 y migra de forma transparente el registro de cada "
    "usuario la primera vez que inicia sesión correctamente, sin pedirle que cambie su clave.")
leyenda_extracto(doc, "app/core/security.py",
                 "derivación de contraseña con Argon2id y migración transparente del esquema anterior")
bloque_codigo(doc, extracto_funcion("backend/app/core/security.py", "hash_password"))

# --- 2
h2(doc, "Módulo de Reporte de Incidencias")
parrafo(doc,
    "Es el punto de entrada del sistema y su pantalla principal. Permite registrar una "
    "incidencia en dos modos: con cuenta institucional o de forma anónima. El formulario "
    "exige tres insumos —fotografía, ubicación satelital y descripción— y somete la "
    "fotografía a un análisis previo antes de habilitar el envío.")
parrafo(doc, "Elementos principales de la interfaz:")
vinetas(doc, [
    "Selector de modo de reporte: «Anónimo (sin login)» o «Con cuenta campus».",
    "Campo de descripción, limitado a un rango de entre cinco y doscientos ochenta caracteres.",
    "Selector de categoría: infraestructura, seguridad o limpieza.",
    "Botón de captura de fotografía, con vista previa de la imagen seleccionada.",
    "Botón de captura de ubicación satelital, que solicita el permiso correspondiente al navegador.",
    "Resultado del análisis previo, con el título sugerido y la categoría propuesta.",
    "Botón de confirmación para los casos en que el análisis no reconoce una incidencia.",
    "Verificación antiabuso, presente únicamente en el modo anónimo.",
    "Botón de envío, habilitado solo cuando se satisfacen todas las condiciones anteriores.",
])
parrafo(doc,
    "Toda fotografía recibida se somete a un proceso de normalización antes de almacenarse: "
    "se verifica que su contenido real corresponda al tipo declarado —y no únicamente su "
    "extensión—, se comprueba que no exceda el límite de resolución admitido y se vuelve a "
    "codificar. Este último paso elimina los metadatos incrustados por la cámara, que suelen "
    "incluir la ubicación exacta, el modelo del dispositivo y la fecha de captura. La imagen "
    "resultante se guarda en un almacenamiento privado que nunca se expone públicamente, y "
    "se registra su resumen criptográfico para poder acreditar posteriormente que no fue "
    "alterada.")
leyenda_extracto(doc, "app/api/v1/reports.py",
                 "normalización de la evidencia y registro de la incidencia")
bloque_codigo(doc, extracto_lineas(
    "backend/app/api/v1/reports.py", "storage = get_storage_provider()", 16))

# --- 3
h2(doc, "Módulo de Clasificación Automática")
parrafo(doc,
    "Determina la categoría y la prioridad de cada incidencia sin intervención humana, y "
    "ejerce además una función de moderación sobre el contenido recibido. Opera en dos "
    "momentos: de forma anticipada, cuando quien reporta adjunta la fotografía y aún no ha "
    "enviado el formulario, y de forma diferida, cuando el proceso de servicio recoge la "
    "incidencia ya registrada.")
parrafo(doc, "Responsabilidad funcional:")
vinetas(doc, [
    "Evaluar conjuntamente la descripción y la fotografía para decidir si el contenido es apropiado.",
    "Determinar si lo reportado constituye realmente una incidencia atendible.",
    "Proponer una categoría, una prioridad y un puntaje numérico entre cero y cien.",
    "Sugerir un título breve y el área responsable de la atención.",
    "Registrar la traza completa de cada evaluación para su auditoría posterior.",
])
parrafo(doc,
    "La respuesta del modelo se somete a un esquema estricto que enumera los valores "
    "admisibles, de modo que el sistema nunca acepta una categoría o una prioridad fuera "
    "del conjunto previsto. La instrucción incluye además una regla de prudencia explícita: "
    "ante la duda sobre si el contenido es apropiado o sobre si constituye una incidencia, "
    "el modelo debe responder negativamente.")
parrafo(doc,
    "La recomendación no se aplica. El resultado se conserva íntegro para su auditoría "
    "—modelo empleado, versión de la instrucción, categoría y prioridad propuestas, grado "
    "de confianza, latencia y respuesta original— pero el módulo no modifica la categoría, "
    "la prioridad ni la visibilidad de la incidencia, ni genera asignaciones. La incidencia "
    "queda a la espera de una persona, que confirma o corrige la propuesta. Ni siquiera el "
    "contenido señalado como inapropiado se rechaza de forma automática: hacerlo "
    "introduciría una decisión sin intervención humana, y la publicación en la vista "
    "comunitaria requiere aprobación expresa en todos los casos.",
    negrita_hasta_punto=True)
parrafo(doc,
    "El módulo incorpora un mecanismo de continuidad: los modelos se consultan en cadena, "
    "de manera que si el primero no responde se intenta el siguiente, y cada intento queda "
    "registrado con su motivo de fallo. Si se agotan todos, la incidencia permanece tal "
    "como estaba —reservada y pendiente de revisión— y el proceso de vigilancia emite un "
    "aviso automático. De este modo, la indisponibilidad de un servicio de terceros nunca "
    "impide registrar ni atender una incidencia.")
leyenda_extracto(doc, "app/services/governance.py",
                 "determinación del régimen con el que se procesa cada incidencia")
bloque_codigo(doc, extracto_funcion("backend/app/services/governance.py", "resolver_modo"))
leyenda_extracto(doc, "app/workers/ai_worker.py",
                 "la recomendación se registra sin aplicarse sobre la incidencia")
bloque_codigo(doc, extracto_lineas(
    "backend/app/workers/ai_worker.py", "La IA propone; no decide", 20))

# --- 4
h2(doc, "Módulo de Georreferenciación y Zonas del Campus")
parrafo(doc,
    "Traduce las coordenadas satelitales que acompañan a cada reporte en el nombre de una "
    "zona concreta del campus. Las zonas se definen como polígonos geográficos almacenados "
    "en la base de datos, de modo que la institución puede describir su recinto real —con "
    "pabellones, patios y accesos— sin modificar el programa.")
parrafo(doc, "Responsabilidad funcional:")
vinetas(doc, [
    "Determinar si un punto se encuentra dentro de alguna zona activa del campus.",
    "Resolver el caso en que un punto pertenece a varias zonas superpuestas.",
    "Calificar el resultado como coincidente, exterior o indeterminado.",
    "Estimar un grado de confianza a partir de la precisión declarada por el dispositivo.",
])
parrafo(doc,
    "El algoritmo de pertenencia se implementó de forma autónoma mediante el método de "
    "proyección de rayos, sin recurrir a extensiones geoespaciales del gestor de base de "
    "datos. Admite polígonos con huecos interiores y agrupaciones de polígonos, y reconoce "
    "explícitamente el caso en que el punto cae exactamente sobre el borde. Cuando un punto "
    "pertenece a más de una zona, el desempate se resuelve en tres niveles sucesivos: primero "
    "la prioridad declarada de la zona, luego la menor superficie —de modo que un aula "
    "prevalezca sobre el pabellón que la contiene— y finalmente la antigüedad del registro. "
    "La confianza asignada disminuye cuando la precisión satelital es baja o cuando el punto "
    "resultó pertenecer a varias zonas.")
leyenda_extracto(doc, "app/services/location_resolver.py",
                 "resolución de zona con desempate por prioridad, superficie y antigüedad")
bloque_codigo(doc, extracto_lineas("backend/app/services/location_resolver.py", "if matches:", 12))

# --- 5
h2(doc, "Módulo de Procesamiento Asíncrono de Trabajos")
parrafo(doc,
    "Sostiene todo el trabajo que no debe realizarse mientras el usuario espera. Está "
    "implementado como una cola sobre la propia base de datos, sin recurrir a un servicio "
    "intermediario adicional, lo que reduce las piezas que la institución debe operar y "
    "mantener.")
parrafo(doc, "Responsabilidad funcional:")
vinetas(doc, [
    "Encolar una tarea cuando se registra una incidencia o cuando se asigna a un responsable.",
    "Entregar cada tarea a un solo proceso de servicio, aun cuando varios consulten a la vez.",
    "Reintentar las tareas fallidas con una espera creciente, hasta un número máximo de intentos.",
    "Recuperar las tareas que quedaron en curso porque el proceso que las tomó dejó de responder.",
])
parrafo(doc,
    "La entrega exclusiva se consigue mediante una instrucción que selecciona la siguiente "
    "tarea pendiente, omite las que otro proceso ya tiene reservadas y la marca como en "
    "curso, todo en una sola operación atómica. Cada proceso confirma la reserva antes de "
    "iniciar cualquier llamada a un servicio externo, de modo que la transacción no "
    "permanezca abierta mientras se espera una respuesta de la red. Si un proceso muere "
    "después de reservar una tarea, un mecanismo de vencimiento la devuelve a la cola pasado "
    "un plazo configurable.")
leyenda_extracto(doc, "app/services/jobs.py",
                 "reserva exclusiva de la siguiente tarea pendiente en una sola operación")
bloque_codigo(doc, extracto_lineas("backend/app/services/jobs.py", "WITH candidate AS (", 22))

# --- 6
h2(doc, "Módulo de Notificaciones por Correo")
parrafo(doc,
    "Comunica cada incidencia al personal que debe atenderla. Los destinatarios se resuelven "
    "en función de la categoría de la incidencia y de la prioridad mínima que cada "
    "responsable ha declarado atender, de modo que un incidente de baja prioridad no "
    "interrumpe a quien solo debe recibir los críticos. Cuando la asignación es manual, el "
    "destinatario se determina directamente.")
parrafo(doc, "Responsabilidad funcional:")
vinetas(doc, [
    "Determinar los destinatarios aplicables y descartar duplicados.",
    "Componer el mensaje con el identificador, la categoría, la prioridad, la zona y la descripción.",
    "Registrar cada envío con su estado de entrega y el identificador devuelto por el proveedor.",
    "Garantizar que un mismo aviso no se remita dos veces al mismo destinatario.",
])
parrafo(doc,
    "La garantía de no duplicación se resuelve mediante una clave de evento única por tarea "
    "y destinatario, junto con un estado intermedio de envío en curso. Si un proceso muere "
    "después de entregar el mensaje al proveedor pero antes de registrar el resultado, el "
    "sistema detecta ese estado ambiguo al reintentarlo y prefiere reportar la incidencia "
    "antes que arriesgar un envío repetido. Todo texto proveniente del usuario se escapa "
    "antes de incorporarse al cuerpo del mensaje, de modo que una descripción no pueda "
    "alterar la estructura del correo que recibe el personal.")
leyenda_extracto(doc, "app/workers/notification_worker.py",
                 "control de duplicados mediante clave de evento y estado intermedio")
bloque_codigo(doc, extracto_lineas("backend/app/workers/notification_worker.py", "event_key = f\"{kind}", 10))

# --- 7
h2(doc, "Módulo de Consulta y Seguimiento de Incidencias")
parrafo(doc,
    "Presenta las incidencias registradas con el alcance que corresponde a cada rol. El "
    "administrador dispone de filtros por estado, categoría, prioridad y rango de fechas "
    "sobre la totalidad de los reportes; el estudiante accede únicamente al listado de los "
    "suyos.")
parrafo(doc, "Elementos principales de la interfaz:")
vinetas(doc, [
    "Listado paginado con categoría, estado, prioridad, zona resuelta y fecha.",
    "Panel de filtros combinables.",
    "Vista de detalle con la descripción completa, la ubicación y su grado de confianza.",
    "Galería de evidencias, descargadas bajo demanda y solo para quien tiene permiso.",
    "Historial de asignaciones con su responsable, plazo y estado.",
    "Traza de la clasificación automática, visible únicamente para el administrador.",
])
parrafo(doc,
    "Las fotografías no se sirven como archivos estáticos. Cada descarga atraviesa una ruta "
    "autenticada que verifica el permiso sobre la incidencia y valida que la ruta solicitada "
    "esté contenida dentro del directorio privado de evidencias, impidiendo que una "
    "referencia manipulada alcance otros archivos del servidor.")
leyenda_extracto(doc, "app/services/storage.py",
                 "la ruta guardada en la base no se considera de fiar: se comprueba que no salga del almacén")
bloque_codigo(doc, extracto_funcion("backend/app/services/storage.py", "_resolve"))

# --- 8
h2(doc, "Módulo de Gestión Administrativa")
parrafo(doc,
    "Reúne las operaciones reservadas al administrador en un panel organizado por pestañas: incidencias, vista social, estado del sistema, personal, asignaciones, zonas y usuarios.")
parrafo(doc, "Elementos principales de la interfaz:")
vinetas(doc, [
    ("Incidencias. ", "Asignación manual de una incidencia a un responsable, con nota y "
     "aviso opcional por correo, y cambio directo del estado."),
    ("Sistema. ", "Estado de los procesos de servicio, resumen de la cola de trabajos y "
     "diagnóstico del clasificador, incluida la detección de cuota agotada."),
    ("Usuarios. ", "Alta, edición, suspensión y reactivación de cuentas, con búsqueda y "
     "filtros por rol y estado."),
    ("Personal. ", "Gestión de los perfiles asignables, su área, categoría, prioridad "
     "mínima y datos de contacto, con el recuento de asignaciones pendientes y completadas."),
    ("Zonas. ", "Alta y edición de las zonas del campus mediante su polígono geográfico, "
     "con validación de la geometría antes de guardarla."),
])
parrafo(doc,
    "La pestaña de sistema merece mención aparte: clasifica cada proceso de servicio como "
    "activo, inactivo o rezagado a partir de la antigüedad de la última tarea procesada, lo "
    "que permite advertir que un proceso dejó de responder sin necesidad de inspeccionar el "
    "servidor. El módulo mantiene además la coherencia entre las cuentas de usuario y los "
    "perfiles de personal asignable, que son entidades distintas: al registrar personal se "
    "crea la cuenta correspondiente si no existe, y la suspensión de una cuenta desactiva "
    "sus perfiles.")

# --- 9
h2(doc, "Módulo de Atención de Asignaciones")
parrafo(doc,
    "Es el panel del personal asignado, deliberadamente reducido a lo que necesita para "
    "trabajar. Presenta únicamente las incidencias que le fueron encomendadas, sin acceso "
    "al resto de la operación del campus.")
parrafo(doc, "Elementos principales de la interfaz:")
vinetas(doc, [
    "Listado de asignaciones propias con categoría, prioridad, zona y plazo de atención.",
    "Filtro por estado de la asignación: asignada, reconocida o completada.",
    "Botón de completar, disponible en cada asignación pendiente.",
    "Mensaje de confirmación con el estado resultante de la incidencia.",
])
parrafo(doc,
    "Al completar una asignación, el sistema no marca la incidencia como resuelta de forma "
    "automática: verifica primero si quedan otras asignaciones pendientes sobre la misma "
    "incidencia. Solo cuando todas están completadas la incidencia pasa a resuelta; en caso "
    "contrario avanza a en proceso. Una incidencia previamente rechazada no se reabre por "
    "esta vía.")
leyenda_extracto(doc, "app/api/v1/staff.py",
                 "cierre de asignación y transición condicional del estado de la incidencia")
bloque_codigo(doc, extracto_lineas("backend/app/api/v1/staff.py", "remaining_pending = (", 14))

# --- 10
h2(doc, "Módulo de Mantenimiento y Retención de Datos")
parrafo(doc,
    "Ejecuta de forma periódica y desatendida las tareas de conservación del sistema. Su "
    "función principal es hacer cumplir la política de retención: transcurrido el período "
    "configurado —ciento ochenta días por omisión— las incidencias que se encuentran en un "
    "estado terminal se eliminan junto con sus fotografías del almacenamiento privado.")
parrafo(doc, "Responsabilidad funcional:")
vinetas(doc, [
    "Eliminar las incidencias resueltas o rechazadas que superaron el período de retención.",
    "Borrar del almacenamiento las evidencias asociadas a esas incidencias.",
    "Replicar opcionalmente el almacenamiento privado a un servicio externo con cifrado en reposo.",
])
parrafo(doc,
    "Esta eliminación automática no es un detalle accesorio: las evidencias son fotografías "
    "tomadas dentro del campus que pueden contener personas, de modo que su conservación "
    "indefinida sería tanto un riesgo como una carga innecesaria. El módulo asegura que el "
    "sistema no acumule información personal más allá del tiempo en que resulta útil para "
    "la operación.")
leyenda_extracto(doc, "app/services/maintenance.py",
                 "purga de incidencias terminales y de sus evidencias tras el período de retención")
bloque_codigo(doc, extracto_funcion("backend/app/services/maintenance.py", "purge_expired_incidents"))

guardar(doc, str(Path(__file__).parent / "Campus Alertas - 1 Memoria Descriptiva (sin imagenes).docx"))
