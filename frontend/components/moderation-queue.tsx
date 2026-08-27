"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ModerationQueueItem,
  getEvidenceObjectUrl,
  listModerationQueue,
  setCommunityVisibility,
} from "@/lib/api-client";
import { useConfirm } from "@/components/confirm-dialog";

const ESTADO_ETIQUETA: Record<string, { texto: string; clase: string }> = {
  PENDIENTE_IA: {
    texto: "Sin evaluar por IA",
    clase: "bg-amber-50 text-amber-800 border-amber-200",
  },
  RECHAZADA_IA: {
    texto: "Rechazada por IA",
    clase: "bg-red-50 text-red-800 border-red-200",
  },
  PUBLICADA_IA: {
    texto: "Publicada por IA",
    clase: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  PUBLICADA_MANUAL: {
    texto: "Publicada por un administrador",
    clase: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  OCULTA_MANUAL: {
    texto: "Retirada por un administrador",
    clase: "bg-slate-100 text-slate-700 border-slate-300",
  },
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
  const [aiEnabled, setAiEnabled] = useState(true);
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
      setAiEnabled(data.ai_moderation_enabled);
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
    <div className="admin-panel admin-form-surface grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Moderación de la vista comunitaria ({total})</h3>
          <p className="text-xs text-slate-500">
            Incidencias cuyo autor autorizó compartirlas y esperan una decisión.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      {/* La política configurada y el estado real del proveedor son cosas
          distintas: decir "la IA decide" mientras está caída induce a error. */}
      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          !aiEnabled || providerFailing
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {!aiEnabled ? (
          "Moderación automática desactivada por configuración: toda incidencia con consentimiento espera decisión humana."
        ) : providerFailing ? (
          <>
            <strong>La moderación automática está configurada, pero el proveedor de IA no responde.</strong>{" "}
            Nada se publicará solo mientras siga caído: todo lo que llegue quedará aquí esperando
            decisión humana. Revisa la pestaña Sistema para el detalle del fallo.
          </>
        ) : (
          "Moderación automática activa: la IA decide y aquí quedan las que rechazó o no pudo evaluar."
        )}
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={includePublished}
          onChange={(e) => setIncludePublished(e.target.checked)}
        />
        Incluir las que ya están publicadas
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nada pendiente de moderar. Solo llegan aquí las incidencias cuyo autor marcó
          «compartir en Comunidad».
        </p>
      ) : null}

      <div className="grid gap-2">
        {items.map((item) => {
          const etiqueta = ESTADO_ETIQUETA[item.moderation_state] ?? {
            texto: item.moderation_state,
            clase: "bg-slate-100 text-slate-700 border-slate-300",
          };
          return (
            <div
              key={item.incident_id}
              className="grid gap-1.5 rounded-lg border border-[var(--line)] p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 font-semibold ${etiqueta.clase}`}>
                  {etiqueta.texto}
                </span>
                <span className="font-mono text-slate-500">
                  {item.incident_id.slice(0, 8)}
                </span>
                <span className="text-slate-500">
                  {item.category} · {item.location_zone_name ?? "Zona no definida"} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <p className="text-slate-800">{item.description}</p>
              <p className="text-slate-500">{motivoOculta(item)}</p>

              {item.evidence_id ? (
                previews[item.incident_id] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previews[item.incident_id]}
                    alt="Evidencia de la incidencia"
                    className="max-h-72 w-auto rounded-lg border border-[var(--line)]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => void verEvidencia(item)}
                    disabled={previewLoadingId === item.incident_id}
                    className="w-fit rounded-lg border border-[var(--line)] px-3 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {previewLoadingId === item.incident_id
                      ? "Cargando evidencia..."
                      : "Ver la fotografía antes de decidir"}
                  </button>
                )
              ) : (
                <p className="text-slate-400">Esta incidencia no tiene fotografía adjunta.</p>
              )}

              {item.last_decision ? (
                <p className="rounded bg-slate-50 px-2 py-1 text-slate-600">
                  {item.last_decision.published ? "Publicada" : "Retirada"} por{" "}
                  <strong>{item.last_decision.actor_label}</strong> el{" "}
                  {new Date(item.last_decision.created_at).toLocaleString()}
                  {item.last_decision.ai_verdict
                    ? ` · veredicto IA: ${item.last_decision.ai_verdict}`
                    : ""}
                  {item.last_decision.reason ? ` · ${item.last_decision.reason}` : ""}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                {item.is_community_visible ? (
                  <button
                    type="button"
                    onClick={() => void decidir(item, false)}
                    disabled={actingId === item.incident_id}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 font-semibold disabled:opacity-50"
                  >
                    {actingId === item.incident_id ? "Aplicando..." : "Retirar del feed"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void decidir(item, true)}
                    disabled={actingId === item.incident_id}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
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
