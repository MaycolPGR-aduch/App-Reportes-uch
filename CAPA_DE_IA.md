# La capa de IA de Campus Alertas

Cómo funciona la clasificación automática de incidencias, qué decide y qué no,
y qué queda registrado de cada decisión.

> **Estado a 22 de septiembre de 2026.** Este documento describe el sistema
> después del cambio que convirtió a la IA de decisora en asesora. Si el
> comportamiento que observas no coincide, comprueba primero que el despliegue
> está al día.

---

## La idea de fondo

**La IA propone; una persona decide.** Ninguna incidencia se clasifica, asigna
ni publica sin que alguien lo confirme.

No siempre fue así. Hasta hace poco el trabajo de clasificación reescribía la
categoría, la prioridad, el estado y la visibilidad de la incidencia, y creaba
asignaciones por su cuenta. Eso hacía imposible el estudio que compara moderar
con IA frente a moderar sin ella: el brazo «asistido» no era asistido sino
automático, y quien moderaba no tenía ningún punto donde aceptar o corregir.

---

## Paso 0 — Dos preguntas distintas: ¿se clasifica? ¿se ve?

Al crear un reporte, `app/api/v1/reports.py` resuelve con qué **régimen de
gobernanza** se procesa esa incidencia:

| Régimen | ¿Se clasifica? | ¿Lo ve quien decide? |
|---|---|---|
| `MANUAL` | Sí, **en sombra** (si `SHADOW_CLASSIFICATION=true`) | **Nunca** |
| `AI_ASSISTED` | Sí | Sí |
| `AI_AUTONOMOUS` | No. Régimen anterior al estudio; solo etiqueta lo ya ocurrido | — |

El ajuste global `GOVERNANCE_MODE` admite `MANUAL`, `AI_ASSISTED` o `RANDOM`.
Con `RANDOM`, cada incidencia cae en uno de los dos brazos al azar.

**El modo se estampa en la fila** (`incidents.governance_mode`) y no se vuelve a
mirar. Cambiar el ajuste global mañana no reetiqueta lo de hoy: sin eso, una
incidencia procesada en enero aparecería en el brazo que estuviera activo en
marzo, y el experimento no significaría nada.

### La clasificación en sombra

El brazo manual también se clasifica, pero la predicción **no llega nunca a
quien decide**. Existe para una comparación que sin ella sería imposible: cómo
lo habría hecho la IA sola sobre las incidencias que decidió una persona sin
ayuda. Es la «calidad contrafactual» que exige el marco de evaluación del
estudio.

Para que el brazo siga siendo manual, la sombra no deja rastro visible:

- La predicción se guarda en `ai_metrics` igual que en el brazo asistido
- **No cambia el estado** de la incidencia: verla pasar sola a `IN_REVIEW` ya
  le diría a quien decide que la IA la evaluó
- **No aparece** en la ficha, ni en «Análisis de la IA», ni en el veredicto de
  moderación
- **No se copia** al registro de triaje: `ai_suggested_*` queda vacío, porque
  quien decidió no la vio

Todo camino que muestre o use la propuesta pasa por una sola función,
`metrica_visible` (`app/services/governance_view.py`). Leer `ai_metrics`
directamente desde una vista sería exactamente la forma de filtrarla.

El coste: duplica las llamadas al proveedor. `SHADOW_CLASSIFICATION=false` las
ahorra, a costa de perder la contrafactual.

La lógica vive en `app/services/governance.py` (`resolver_modo`,
`se_clasifica`, `recomendacion_visible`).

---

## Paso 1 — Una cola, no una llamada directa

El reporte se guarda y **responde al instante**. La clasificación va a una cola
en Postgres que `app/workers/ai_worker.py` consume con `FOR UPDATE SKIP LOCKED`,
de modo que varios trabajadores pueden repartirse el trabajo sin pisarse.

Quien reporta nunca espera al modelo. Si el proveedor tarda veinte segundos, o
está caído, la persona ya se ha ido con su confirmación en la mano.

| Parámetro | Valor por omisión | Variable |
|---|---|---|
| Intentos por trabajo | 5 | — |
| Espera entre reintentos | 120 s | `CLASSIFICATION_RETRY_DELAY_SECONDS` |
| Arrendamiento | 300 s | `JOB_LEASE_SECONDS` |
| Sondeo del trabajador | 2 s | `WORKER_POLL_SECONDS` |

El arrendamiento es lo que recupera un trabajo si el proceso muere a media
ejecución: pasados esos segundos sin terminar, otro trabajador puede tomarlo.

---

## Paso 2 — Qué se le pide al modelo

Se envían tres cosas: la **descripción**, la **imagen** y la **categoría que
eligió quien reporta**. Esa tercera pieza importa: la IA no clasifica a ciegas,
sino sabiendo qué creyó la persona.

Se exige un objeto JSON con diez campos (`CLASSIFICATION_SCHEMA` en
`app/services/ai.py`):

| Campo | Para qué |
|---|---|
| `predicted_category` | `INFRASTRUCTURE` · `SECURITY` · `CLEANING` |
| `priority_label`, `priority_score` | Prioridad sugerida y su puntuación de 0 a 100 |
| `confidence` | De 0 a 1 |
| `is_appropriate` | Si el contenido es publicable |
| `is_incident` | Si es una incidencia real y no ruido |
| `reasoning_summary`, `reason` | Justificación breve, en español |
| `suggested_title` | Título propuesto |
| `assigned_to` | Área del campus sugerida |

La instrucción incluye una regla de prudencia explícita: *ante la duda sobre si
algo es apropiado o es una incidencia, responder `false`*.

**Cadena de modelos.** `AI_IMAGE_PRIMARY_MODEL` más `AI_IMAGE_FALLBACK_MODELS`
se prueban en orden. Si uno falla, se pasa al siguiente, y cada intento queda
registrado con su error.

---

## Paso 3 — Dónde acaba la recomendación

El resultado se guarda en la tabla `ai_metrics` y **ahí se queda**:

```
provider · model_name · prompt_version
predicted_category · priority_score · priority_label
confidence · latency_ms · reasoning_summary · raw_response
```

Lo único que la IA cambia en la incidencia es el estado, y solo en el brazo
asistido: si estaba en `REPORTED`, pasa a `IN_REVIEW`, que significa *hay algo
que mirar*. En el brazo manual no cambia nada (ver «La clasificación en sombra»).

**No toca** la categoría, la prioridad, la visibilidad, ni crea asignaciones.

### Ni siquiera rechaza el contenido inapropiado

Aunque la IA marque algo como no publicable, la incidencia **no se rechaza
sola**. Es deliberado por dos motivos:

- Rechazar automáticamente sería una automatización que el brazo manual no
  tiene, y arruinaría la comparación entre ambos
- Es seguro: **nada se publica sin aprobación humana en ningún modo**, así que
  el contenido inapropiado no llega a verse mientras espera revisión

---

## Paso 4 — La decisión humana

Dos endpoints, dos registros distintos:

**`PATCH /admin/incidents/{id}/triage`** — confirmar o corregir la
clasificación. Escribe en `triage_decisions`:

```
actor_user_id · actor_label · governance_mode
ai_suggested_category · ai_suggested_priority · ai_confidence
final_category · final_priority · assigned_responsible_id
reason · created_at
```

**`PATCH /admin/incidents/{id}/community-visibility`** — publicar u ocultar en
el muro comunitario. Escribe en `moderation_decisions`.

Ambas tablas **copian la etiqueta del actor** en vez de depender solo de la
clave foránea, de modo que el rastro sobrevive al borrado de la cuenta.

Y una decisión humana registrada **prevalece** sobre cualquier reevaluación
posterior de la IA (`_has_manual_decision` en `ai_worker.py`).

---

## Cuando la IA no responde

Si se agotan los cinco intentos, el trabajo se marca como fallido y **la
incidencia se queda como estaba**: privada, esperando a una persona.

El trabajador ya no fuerza `is_community_visible = False` en ese punto. Su único
efecto posible era **deshacer una decisión humana**: si alguien publicaba la
incidencia mientras el trabajo reintentaba, agotar los reintentos la
despublicaba en silencio.

La pestaña **Sistema** del panel muestra el estado de la capa de IA, y
`app/services/monitoring.py` envía un aviso automático cuando detecta
clasificaciones agotadas o cuota agotada.

---

## Las tres versiones de cada incidencia

Esto es lo que hace medible el estudio. Para cualquier incidencia se puede
reconstruir:

| Versión | Dónde vive |
|---|---|
| Lo que dijo **quien reportó** | `incidents.reported_category` |
| Lo que propuso la **IA** | `ai_metrics` y las columnas `ai_*` de `triage_decisions` |
| Lo que decidió **quien modera** | `incidents.category` y las columnas `final_*` |

`reported_category` es una columna aparte precisamente porque `category` puede
cambiar. Sin ella no se podría medir cuántas veces se corrige a la persona que
reporta, ni si esas correcciones aciertan.

**En modo `MANUAL` las columnas de IA de `triage_decisions` quedan vacías, y
esa ausencia es el dato.** La predicción en sombra no está ahí sino en
`ai_metrics`, que es de donde hay que leerla para la comparación contrafactual.
No haber visto propuesta es distinto de haberla corregido: el campo
`agreed_with_ai` vale `None` en el primer caso y `False` en el segundo.
Mezclarlos falsearía las medias.

Las incidencias anteriores al estudio llevan `governance_mode = 'AI_AUTONOMOUS'`
y `reported_category` en `NULL`. Ese hueco es intencionado: en varias la IA ya
había sobrescrito la categoría, y copiar el valor actual habría inventado un
dato que no existe.

---

## Configuración

| Variable | Para qué |
|---|---|
| `GOVERNANCE_MODE` | `MANUAL` · `AI_ASSISTED` · `RANDOM` |
| `SHADOW_CLASSIFICATION` | Clasificar en sombra el brazo manual. Por omisión `true` |
| `AI_TOKENROUTER_API_KEY` | Credencial del proveedor |
| `AI_TOKENROUTER_BASE_URL` | Extremo del proveedor |
| `AI_IMAGE_PRIMARY_MODEL` | Modelo principal |
| `AI_IMAGE_FALLBACK_MODELS` | Respaldos, separados por comas |
| `AI_PROMPT_VERSION` | Se guarda en cada `ai_metrics` |
| `AI_REQUEST_TIMEOUT_SECONDS` | Tiempo máximo por llamada |
| `AI_MAX_OUTPUT_TOKENS` | Límite de la respuesta |

`AI_MODERATION_ENABLED` y `AUTO_ASSIGN_ENABLED` **ya no existen**. Se retiraron
al dejar la IA de publicar y asignar: mantenerlos habría sugerido que pueden
activarse.

---

## Antes de recoger datos

**Comprueba que el proveedor responde.** Con la cuenta sin saldo, el brazo
asistido produce exactamente el mismo resultado que el manual —incidencia en
revisión, sin propuesta— y **nada lo advierte**. Los dos brazos serían
indistinguibles y no se notaría hasta analizar los resultados.

```bash
python check_ai_models.py
```

Debe responder correctamente al menos el modelo principal.

---

## En una línea

De **decidir** a **opinar**. La IA aporta una recomendación con su confianza y
su rastro; quien modera la acepta o la corrige, y esa decisión queda registrada
junto a lo que la IA propuso.
