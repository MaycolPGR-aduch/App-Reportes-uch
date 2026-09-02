"use client";

import { useState } from "react";
import {
  IncidentCategory,
  ModerationQueueItem,
  PriorityLevel,
  triageIncident,
} from "@/lib/api-client";

const CATEGORIAS: { valor: IncidentCategory; texto: string }[] = [
  { valor: "INFRASTRUCTURE", texto: "Infraestructura" },
  { valor: "SECURITY", texto: "Seguridad" },
  { valor: "CLEANING", texto: "Limpieza" },
];

const PRIORIDADES: { valor: PriorityLevel; texto: string }[] = [
  { valor: "LOW", texto: "Baja" },
  { valor: "MEDIUM", texto: "Media" },
  { valor: "HIGH", texto: "Alta" },
  { valor: "CRITICAL", texto: "Crítica" },
];

const nombreCategoria = (c: IncidentCategory | null) =>
  CATEGORIAS.find((x) => x.valor === c)?.texto ?? "—";
const nombrePrioridad = (p: PriorityLevel | null) =>
  PRIORIDADES.find((x) => x.valor === p)?.texto ?? "—";

/** Por debajo de esto la recomendación merece más desconfianza que atención. */
const CONFIANZA_BAJA = 0.75;

type Props = {
  item: ModerationQueueItem;
  onDone: () => void;
};

/**
 * Confirmar o corregir la clasificación de una incidencia.
 *
 * Antes no existía: `category` y `priority` solo cambiaban porque la IA las
 * reescribiera, de modo que su criterio era inapelable. Aquí decide una
 * persona, y lo que decide queda registrado junto a lo que proponía la IA —
 * que es la medición del estudio.
 */
export function TriagePanel({ item, onDone }: Props) {
  const [categoria, setCategoria] = useState<IncidentCategory>(item.category);
  const [prioridad, setPrioridad] = useState<PriorityLevel>(item.priority);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hayPropuesta = item.ai_suggested_category !== null;
  const confianzaBaja =
    item.ai_confidence !== null && item.ai_confidence < CONFIANZA_BAJA;

  const difiereDeLaIA =
    hayPropuesta &&
    (categoria !== item.ai_suggested_category || prioridad !== item.ai_suggested_priority);

  const aceptarPropuesta = () => {
    if (item.ai_suggested_category) setCategoria(item.ai_suggested_category);
    if (item.ai_suggested_priority) setPrioridad(item.ai_suggested_priority);
  };

  const guardar = async () => {
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      const r = await triageIncident(item.incident_id, {
        category: categoria,
        priority: prioridad,
        reason: motivo.trim() || undefined,
      });
      setAviso(r.message);
      setMotivo("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la clasificación");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Clasificación
        </h4>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
          {item.governance_mode === "MANUAL"
            ? "Manual"
            : item.governance_mode === "AI_ASSISTED"
              ? "Asistido por IA"
              : "Régimen anterior"}
        </span>
        {confianzaBaja ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Confianza baja
          </span>
        ) : null}
      </div>

      {/* Las tres versiones del caso, que es lo que el estudio compara. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="font-semibold">Eligió quien reportó</dt>
          <dd>{nombreCategoria(item.reported_category)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Propone la IA</dt>
          <dd>
            {hayPropuesta ? (
              <>
                {nombreCategoria(item.ai_suggested_category)} ·{" "}
                {nombrePrioridad(item.ai_suggested_priority)}
                {item.ai_confidence !== null
                  ? ` · ${Math.round(item.ai_confidence * 100)}%`
                  : ""}
              </>
            ) : (
              <span className="text-slate-400">Sin recomendación</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Vigente</dt>
          <dd>
            {nombreCategoria(item.category)} · {nombrePrioridad(item.priority)}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] font-semibold text-slate-700">
          Categoría
          <select
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as IncidentCategory)}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[11px] font-semibold text-slate-700">
          Prioridad
          <select
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PriorityLevel)}
          >
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </select>
        </label>

        {hayPropuesta ? (
          <button
            type="button"
            onClick={aceptarPropuesta}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Usar la de la IA
          </button>
        ) : null}
      </div>

      {/* El motivo solo se pide al apartarse de la recomendación: exigirlo
          siempre lo convertiría en un trámite que se rellena sin pensar. */}
      {difiereDeLaIA ? (
        <label className="grid gap-1 text-[11px] font-semibold text-slate-700">
          Motivo de la corrección
          <input
            className="rounded-lg border border-[var(--line)] px-2 py-1 text-xs"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué no se acepta la propuesta de la IA"
            maxLength={300}
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
          {aviso}
        </p>
      ) : null}

      {item.last_triage ? (
        <p className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
          Clasificada por <strong>{item.last_triage.actor_label}</strong> el{" "}
          {new Date(item.last_triage.created_at).toLocaleString()}
          {item.last_triage.reason ? ` · ${item.last_triage.reason}` : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="justify-self-start rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : difiereDeLaIA ? "Guardar corrección" : "Confirmar"}
      </button>
    </div>
  );
}
