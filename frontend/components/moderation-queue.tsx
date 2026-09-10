"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ModerationQueueItem,
  getEvidenceObjectUrl,
  listModerationQueue,
  setCommunityVisibility,
} from "@/lib/api-client";
import { useConfirm } from "@/components/confirm-dialog";
import { TriagePanel } from "@/components/triage-panel";
import { categoryLabels, type Tone } from "@/lib/labels";
import { Alert, Badge } from "@/components/ui";

/* El estado de moderación pasa por el mismo sistema de tonos que el resto de
   la aplicación, en vez de llevar su propia tabla de clases de color. */
const ESTADO_ETIQUETA: Record<string, { texto: string; tono: Tone }> = {
  PENDIENTE_IA: { texto: "Sin evaluar por IA", tono: "warning" },
  RECHAZADA_IA: { texto: "Rechazada por IA", tono: "danger" },
  PUBLICADA_IA: { texto: "Publicada por IA", tono: "success" },
  PUBLICADA_MANUAL: { texto: "Publicada por un administrador", tono: "success" },
  OCULTA_MANUAL: { texto: "Retirada por un administrador", tono: "neutral" },
};

function motivoOculta(item: ModerationQueueItem): string {
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

export function ModerationQueue() {
  const { confirm, dialog } = useConfirm();
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [modo, setModo] = useState<string>("AI_ASSISTED");
  const [providerFailing, setProviderFailing] = useState(false);
  const [includePublished, setIncludePublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  // No se puede decidir si una fotografía es publicable sin verla. Se cargan
  // bajo demanda porque la evidencia solo se sirve por ruta autenticada.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const verEvidencia = async (item: ModerationQueueItem) => {
    if (!item.evidence_id || previews[item.incident_id]) return;
    setPreviewLoadingId(item.incident_id);
    try {
      const url = await getEvidenceObjectUrl(item.incident_id, item.evidence_id);
      setPreviews((current) => ({ ...current, [item.incident_id]: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la evidencia");
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModerationQueue({ include_published: includePublished });
      setItems(data.items);
      setTotal(data.total);
      setModo(data.governance_mode);
      setProviderFailing(data.ai_provider_failing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la cola de moderación");
    } finally {
      setLoading(false);
    }
  }, [includePublished]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
    // Solo al desmontar: revocar en cada cambio invalidaría las ya mostradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decidir = async (item: ModerationQueueItem, visible: boolean) => {
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

    setActingId(item.incident_id);
    setError(null);
    setMessage(null);
    try {
      const res = await setCommunityVisibility(item.incident_id, {
        visible,
        reason: revierteALaIA ? "Publicada por decisión administrativa pese al veredicto de la IA" : undefined,
      });
      setMessage(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la decisión");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="admin-panel admin-form-surface grid gap-3 rounded-2xl border border-line bg-card p-4">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Moderación de la vista comunitaria ({total})</h3>
          <p className="text-xs text-muted">
            Incidencias cuyo autor autorizó compartirlas y esperan una decisión.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* El régimen configurado y el estado real del proveedor son cosas
          distintas: anunciar que hay recomendaciones mientras la IA está caída
          induce a error. */}
      <Alert tone={providerFailing ? "warning" : "success"}>
        {modo === "MANUAL" ? (
          <>
            <strong>Régimen manual.</strong> No se consulta a la IA: clasificas y publicas
            sin recomendación previa.
          </>
        ) : providerFailing ? (
          <>
            <strong>Régimen asistido, pero el proveedor de IA no responde.</strong>{" "}
            Las incidencias llegarán aquí sin recomendación. Revisa la pestaña Sistema
            para el detalle del fallo.
          </>
        ) : (
          <>
            <strong>Régimen asistido.</strong> La IA propone; publicar y clasificar
            siguen siendo decisiones tuyas, y quedan registradas a tu nombre.
          </>
        )}
      </Alert>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={includePublished}
          onChange={(e) => setIncludePublished(e.target.checked)}
        />
        Incluir las que ya están publicadas
      </label>

      {error ? (
        <p className="rounded-lg bg-[var(--tone-danger-bg)] px-3 py-2 text-xs text-[var(--tone-danger-fg)]">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-[var(--tone-success-bg)] px-3 py-2 text-xs text-[var(--tone-success-fg)]">{message}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-xs text-muted">
          Nada pendiente de moderar. Solo llegan aquí las incidencias cuyo autor marcó
          «compartir en Comunidad».
        </p>
      ) : null}

      <div className="grid gap-2">
        {items.map((item) => {
          const etiqueta = ESTADO_ETIQUETA[item.moderation_state] ?? {
            texto: item.moderation_state,
            tono: "neutral" as Tone,
          };
          return (
            <div
              key={item.incident_id}
              className="grid gap-1.5 rounded-lg border border-line p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={etiqueta.tono} dot>
                  {etiqueta.texto}
                </Badge>
                <span className="font-mono text-muted">
                  {item.incident_id.slice(0, 8)}
                </span>
                <span className="text-muted">
                  {categoryLabels[item.category]} ·{" "}
                  {item.location_zone_name ?? "Zona no definida"} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <p className="text-ink">{item.description}</p>
              <p className="text-muted">{motivoOculta(item)}</p>

              {item.evidence_id ? (
                previews[item.incident_id] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previews[item.incident_id]}
                    alt="Evidencia de la incidencia"
                    className="max-h-72 w-auto rounded-lg border border-line"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => void verEvidencia(item)}
                    disabled={previewLoadingId === item.incident_id}
                    className="w-fit rounded-lg border border-line px-3 py-1.5 font-semibold text-[var(--tone-success-fg)] hover:bg-brand-soft disabled:opacity-60"
                  >
                    {previewLoadingId === item.incident_id
                      ? "Cargando evidencia..."
                      : "Ver la fotografía antes de decidir"}
                  </button>
                )
              ) : (
                <p className="text-subtle">Esta incidencia no tiene fotografía adjunta.</p>
              )}

              {item.last_decision ? (
                <p className="rounded bg-sunken px-2 py-1 text-body">
                  {item.last_decision.published ? "Publicada" : "Retirada"} por{" "}
                  <strong>{item.last_decision.actor_label}</strong> el{" "}
                  {new Date(item.last_decision.created_at).toLocaleString()}
                  {item.last_decision.ai_verdict
                    ? ` · veredicto IA: ${item.last_decision.ai_verdict}`
                    : ""}
                  {item.last_decision.reason ? ` · ${item.last_decision.reason}` : ""}
                </p>
              ) : null}

              <TriagePanel item={item} onDone={() => void load()} />

              <div className="flex flex-wrap gap-2 pt-1">
                {item.is_community_visible ? (
                  <button
                    type="button"
                    onClick={() => void decidir(item, false)}
                    disabled={actingId === item.incident_id}
                    className="rounded-lg border border-line px-3 py-1.5 font-semibold disabled:opacity-50"
                  >
                    {actingId === item.incident_id ? "Aplicando..." : "Retirar del feed"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void decidir(item, true)}
                    disabled={actingId === item.incident_id}
                    className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-on-brand disabled:opacity-50"
                  >
                    {actingId === item.incident_id ? "Aplicando..." : "Publicar en el feed"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
