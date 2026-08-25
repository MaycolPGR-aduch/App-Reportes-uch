# Guía para capturar zonas del campus

Esta guía explica cómo registrar las zonas de **Campus Alertas** recorriendo el
campus con un teléfono, en lugar de escribir coordenadas a mano.

Está pensada para leerse sobre el terreno: los pasos son cortos y el apartado de
problemas frecuentes está al final.

---

## Por qué existe

Las zonas se definían pegando geometría en un cuadro de texto. Ese método es
propenso a un error que no se detecta mirando los números: una zona del campus
quedó registrada **a 10,6 km del resto**, porque se guardó el polígono de
ejemplo de la plantilla sin sustituirlo por el real. Nadie lo notó durante meses.

Capturar la zona caminando elimina ese riesgo: las coordenadas las toma el
teléfono desde el sitio, no se transcriben.

---

## Antes de salir

- **Conexión segura (HTTPS).** Los navegadores no permiten leer la ubicación en
  sitios inseguros. Funciona en el sistema desplegado; **no** funcionará si
  entras a la dirección local de una computadora por HTTP.
- **Sesión de administrador.** La herramienta vive en el panel de administración.
- **Permiso de ubicación concedido** al navegador del teléfono.
- **Al aire libre y con buena señal.** Pegado a un muro o bajo techo la precisión
  empeora bastante.

---

## Capturar una zona nueva

1. Entra al panel y abre la pestaña **Zonas**.
2. En el formulario «Crear zona», pulsa **Capturar caminando**.
3. Escribe el **nombre** y el **código** de la zona (puedes hacerlo al final).
4. Camina hasta la **primera esquina** del área.
5. Pulsa **«Capturar este vértice»** y **quédate quieto 4 segundos**. La
   herramienta toma varias lecturas y las promedia; moverse durante ese lapso
   arruina el promedio.
6. Repite en cada esquina, **siguiendo el perímetro en orden**, sin saltar de una
   esquina a la opuesta.
7. Con tres vértices o más aparece la vista previa.
8. Revisa la vista previa (siguiente apartado) y pulsa **«Usar este polígono»**.
9. Vuelve al formulario y pulsa **«Crear zona»**.

> El orden importa. Los vértices se unen en la secuencia en que los capturas: si
> vas saltando de un lado a otro, el polígono se cruza consigo mismo.

---

## Corregir una zona ya registrada

1. En la pestaña **Zonas**, selecciona la zona en el listado.
2. En «Editar zona», pulsa **Recapturar caminando**.
3. Verás su polígono actual como punto de partida. Pulsa **«Empezar de nuevo»**
   para descartarlo, o quita solo los vértices que estén mal.
4. Captura los vértices correctos.
5. Pulsa **«Guardar el polígono recapturado»** y luego **«Guardar cambios»**.

---

## Cómo leer la vista previa

| Elemento | Qué significa |
|---|---|
| Polígono **verde** numerado | La zona que estás capturando, con el orden de los vértices |
| Formas **grises** al fondo | Las zonas activas ya registradas, para comparar |
| **Superficie aproximada** | La comprobación más rápida: si esperas un aula y salen 40.000 m², algo va mal |
| **Perímetro** | Útil para contrastar con la distancia que caminaste |
| `± n m` junto a cada vértice | Precisión declarada por el teléfono en ese punto |

### Avisos que pueden aparecer

**«El polígono se cruza consigo mismo»** — *impide guardar*. Significa que los
vértices no siguen el perímetro. Revisa el orden: normalmente sobra o falta un
punto, o se capturaron dos esquinas en secuencia equivocada.

**«n vértice(s) con precisión peor de 20 m»** — solo advierte. Puedes quitar esos
puntos y volver a medirlos con mejor señal.

**«Se solapa con: …»** — solo advierte. No impide guardar: el sistema resuelve
los solapes por prioridad y, en empate, por menor superficie, de modo que un
aula prevalece sobre el pabellón que la contiene.

**«La zona queda a X km del resto del campus»** — *impide guardar*, y aparece al
crear la zona, no en la vista previa. Es la validación que evita repetir el error
que originó esta herramienta.

---

## Consejos para una buena captura

- **Párate en la esquina, no cerca.** El error del GPS ya es de varios metros; no
  hace falta añadirle el tuyo.
- **Espera unos segundos antes de la primera captura.** El receptor mejora su
  precisión conforme fija satélites.
- **Cuatro esquinas bastan para un edificio rectangular.** Más vértices no dan
  más exactitud si el error de cada uno sigue siendo el mismo.
- **Contrasta la superficie con lo que esperabas.** Es el control de calidad más
  barato que existe.
- **Si un vértice sale con precisión mala, quítalo y repítelo.** Es más rápido
  que descubrir después que la zona está torcida.

---

## Limitación importante

La precisión de un teléfono ronda los **5 a 20 metros** al aire libre, y empeora
junto a edificios altos o bajo cubierta. El promediado reduce el error, pero no
lo elimina.

Eso significa que la herramienta sirve bien para delimitar **pabellones, patios,
canchas o estacionamientos**, y no para separar dos aulas contiguas.

Como consecuencia, una incidencia registrada justo en el límite entre dos zonas
puede resolverse a cualquiera de las dos. El sistema lo tiene en cuenta: reduce
la confianza de la ubicación cuando el punto cae en varias zonas a la vez.

---

## Problemas frecuentes

**El botón no hace nada y no aparece ningún vértice.**
Revisa que el navegador tenga permiso de ubicación. Si lo denegaste antes,
hay que volver a concederlo desde los ajustes del sitio.

**«Este navegador no permite leer la ubicación».**
Casi siempre es que estás entrando por HTTP en vez de HTTPS.

**«No llegó ninguna lectura de ubicación».**
Sin señal suficiente. Sal a un espacio abierto y espera unos segundos.

**La vista previa sale deformada o con picos.**
El polígono se está cruzando. Quita los últimos vértices y recórrelos en orden.

**El panel no carga tras iniciar sesión.**
No es la herramienta: comprueba que la API esté en marcha.

---

## Documentos relacionados

| Archivo | Contenido |
|---|---|
| [ESTADO_DEL_PROYECTO.md](ESTADO_DEL_PROYECTO.md) | Qué hace el sistema y en qué estado está |
| [backend/README.md](backend/README.md) | API, procesos y despliegue |
| [GUIA_ACTUALIZACION_GITHUB.md](GUIA_ACTUALIZACION_GITHUB.md) | Flujo de trabajo con el repositorio |
