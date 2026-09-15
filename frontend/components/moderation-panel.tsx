"use client";

import { useState } from "react";
import { ModerationDecisionInfo, setCommunityVisibility } from "@/lib/api-client";
import { useConfirm } from "@/components/confirm-dialog";
import { type Tone } from "@/lib/labels";
import { Alert, Badge } from "@/components/ui";

/**
 * Lo mínimo que el panel necesita saber de una incidencia.
 *
 * Subconjunto a propósito: lo alimenta el detalle de la pestaña de incidencias
 * sin que el panel dependa de la forma completa de esa vista.
 */
export type ModerationSubject = {
  incident_id: string;
  community_consent: boolean;
  is_community_visible: boolean;
  moderation_state: string;
  ai_evaluated: boolean;
  ai_is_appropriate: boolean | null;
  ai_is_incident: boolean | null;
  ai_reason: string | null;
  last_decision: ModerationDecisionInfo | null;
};

type Props = {
  item: ModerationSubject;
  onDone: () => void;
};

/* El estado de moderación pasa por el mismo sistema de tonos que el resto de
   la aplicación, en vez de llevar su propia tabla de clases de color. */
const ESTADO_ETIQUETA: Record<string, { texto: string; tono: Tone }> = {
  PENDIENTE_IA: { texto: "Sin evaluar por IA", tono: "warning" },
  RECHAZADA_IA: { texto: "Rechazada por IA", tono: "danger" },
  PUBLICADA_IA: { texto: "Publicada por IA", tono: "success" },
  PUBLICADA_MANUAL: { texto: "Publicada por un administrador", tono: "success" },
  OCULTA_MANUAL: { texto: "Retirada por un administrador", tono: "neutral" },
};

function motivoOculta(item: ModerationSubject): string {
  if (!item.ai_evaluated) {
    return "La clasificación automática no pudo evaluarla. Requiere revisión humana.";
  }
  if (item.ai_is_appropriate === false) {
    return `La IA la marcó como contenido no permitido${item.ai_reason ? `: ${item.ai_reason}` : "."}`;
  }
  if (item.ai_is_incident === false) {
    return `La IA consideró que no es una incidencia${item.ai_reason ? `: ${item.ai_reason}` : "."}`;
  }
  return "Aprobada por la IA.";
}

/**
 * Publicar u ocultar una incidencia en la vista comunitaria.
 *
 * Vivía dentro de la cola de moderación, junto al triaje, y ambos quedaban
 * atados al filtro de consentimiento de esa cola. Ahora cada decisión tiene su
 * panel: el triaje aplica a toda incidencia; éste sólo tiene sentido cuando
 * quien reportó consintió aparecer en comunidad, y lo dice en vez de ocultarse.
 */
export function ModerationPanel({ item, onDone }: Props) {
  const { confirm, dialog } = useConfirm();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!item.community_consent) {
    return (
      <section className="grid gap-2 rounded-lg border border-line p-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          Vista comunitaria
        </h3>
        <p className="text-xs text-muted">
          Quien reportó no autorizó publicarla en comunidad. No hay decisión de
          visibilidad que tomar: el reporte es privado por voluntad de su autor.
        </p>
      </section>
    );
  }

  const decidir = async (visible: boolean) => {
    const revierteALaIA =
      visible && (item.ai_is_appropriate === false || item.ai_is_incident === false);

    const aceptado = await confirm({
      title: visible ? "Publicar en la vista comunitaria" : "Retirar de la vista comunitaria",
      message: visible
        ? "La incidencia será visible para toda la comunidad, sin identificar a su autor."
        : "La incidencia dejará de aparecer en el feed comunitario.",
      warning: revierteALaIA
        ? "La IA marcó esta incidencia como no publicable. Publicarla revierte ese veredicto y quedará registrado a tu nombre."
        : "La decisión queda registrada con tu nombre y la fecha.",
      confirmLabel: visible ? "Publicar" : "Retirar",
      danger: revierteALaIA,
    });
    if (!aceptado) return;

    setActing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await setCommunityVisibility(item.incident_id, {
        visible,
        reason: revierteALaIA
          ? "Publicada por decisión administrativa pese al veredicto de la IA"
          : undefined,
      });
      setMessage(res.message);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la decisión");
    } finally {
      setActing(false);
    }
  };

  const etiqueta = ESTADO_ETIQUETA[item.moderation_state] ?? {
    texto: item.moderation_state,
    tono: "neutral" as Tone,
  };

  return (
    <section className="grid gap-2 rounded-lg border border-line p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          Vista comunitaria
        </h3>
        <Badge tone={etiqueta.tono} dot>
          {etiqueta.texto}
        </Badge>
      </div>

      <p className="text-muted">{motivoOculta(item)}</p>

      {item.last_decision ? (
        <p className="rounded bg-sunken px-2 py-1 text-body">
          {item.last_decision.published ? "Publicada" : "Retirada"} por{" "}
          <strong>{item.last_decision.actor_label}</strong> el{" "}
          {new Date(item.last_decision.created_at).toLocaleString()}
          {item.last_decision.ai_verdict ? ` · veredicto IA: ${item.last_decision.ai_verdict}` : ""}
          {item.last_decision.reason ? ` · ${item.last_decision.reason}` : ""}
        </p>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {item.is_community_visible ? (
          <button
            type="button"
            onClick={() => void decidir(false)}
            disabled={acting}
            className="rounded-lg border border-line px-3 py-1.5 font-semibold disabled:opacity-50"
          >
            {acting ? "Aplicando..." : "Retirar del feed"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void decidir(true)}
            disabled={acting}
            className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-on-brand disabled:opacity-50"
          >
            {acting ? "Aplicando..." : "Publicar en el feed"}
          </button>
        )}
      </div>
      {dialog}
    </section>
  );
}
