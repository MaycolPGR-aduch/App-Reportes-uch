"use client";

import { useState } from "react";
import {
  GovernanceMode,
  IncidentCategory,
  PriorityLevel,
  TriageDecisionInfo,
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

/**
 * Lo mínimo que el panel necesita saber de una incidencia.
 *
 * Es un subconjunto a propósito: así lo alimenta tanto el detalle de la
 * pestaña de incidencias como cualquier otra vista, sin que el panel dependa
 * de la forma completa de ninguna de ellas.
 */
export type TriageSubject = {
  incident_id: string;
  category: IncidentCategory;
  priority: PriorityLevel;
  reported_category: IncidentCategory | null;
  governance_mode: GovernanceMode;
  ai_suggested_category: IncidentCategory | null;
  ai_suggested_priority: PriorityLevel | null;
  ai_confidence: number | null;
  last_triage: TriageDecisionInfo | null;
};

type Props = {
  item: TriageSubject;
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
    <div className="grid gap-2 rounded-lg border border-line bg-sunken p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-body">
          Clasificación
        </h4>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-body">
          {item.governance_mode === "MANUAL"
            ? "Manual"
            : item.governance_mode === "AI_ASSISTED"
              ? "Asistido por IA"
              : "Régimen anterior"}
        </span>
        {confianzaBaja ? (
          <span className="rounded-full bg-[var(--tone-warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--tone-warning-fg)]">
            Confianza baja
          </span>
        ) : null}
      </div>

      {/* Las tres versiones del caso, que es lo que el estudio compara. */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-body sm:grid-cols-3">
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
              <span className="text-subtle">Sin recomendación</span>
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
        <label className="grid gap-1 text-[11px] font-semibold text-body">
          Categoría
          <select
            className="rounded-lg border border-line px-2 py-1 text-xs"
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

        <label className="grid gap-1 text-[11px] font-semibold text-body">
          Prioridad
          <select
            className="rounded-lg border border-line px-2 py-1 text-xs"
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
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-[var(--tone-success-fg)] hover:bg-brand-soft"
          >
            Usar la de la IA
          </button>
        ) : null}
      </div>

      {/* El motivo solo se pide al apartarse de la recomendación: exigirlo
          siempre lo convertiría en un trámite que se rellena sin pensar. */}
      {difiereDeLaIA ? (
        <label className="grid gap-1 text-[11px] font-semibold text-body">
          Motivo de la corrección
          <input
            className="rounded-lg border border-line px-2 py-1 text-xs"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué no se acepta la propuesta de la IA"
            maxLength={300}
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="rounded bg-[var(--tone-danger-bg)] px-2 py-1 text-[11px] text-[var(--tone-danger-fg)]">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="rounded bg-[var(--tone-success-bg)] px-2 py-1 text-[11px] text-[var(--tone-success-fg)]">
          {aviso}
        </p>
      ) : null}

      {item.last_triage ? (
        <p className="rounded bg-sunken px-2 py-1 text-[11px] text-body">
          Clasificada por <strong>{item.last_triage.actor_label}</strong> el{" "}
          {new Date(item.last_triage.created_at).toLocaleString()}
          {item.last_triage.reason ? ` · ${item.last_triage.reason}` : ""}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="justify-self-start rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
      >
        {guardando ? "Guardando…" : difiereDeLaIA ? "Guardar corrección" : "Confirmar"}
      </button>
    </div>
  );
}
