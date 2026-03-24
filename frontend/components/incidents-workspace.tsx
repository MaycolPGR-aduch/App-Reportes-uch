"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IncidentCategory,
  IncidentDetail,
  IncidentListItem,
  IncidentStatus,
  PriorityLevel,
  getEvidenceObjectUrl,
  getIncidentDetail,
  listIncidents,
} from "@/lib/api-client";

type IncidentsWorkspaceProps = {
  token: string;
};

export function IncidentsWorkspace({ token }: IncidentsWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState<string | null>(null);

  const fetchList = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await listIncidents(token, {
        status_filter: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
        limit: 50,
        offset: 0,
      });
      setItems(response.items);
      setTotal(response.total);
      if (response.items.length === 0) {
        setSelectedId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar incidencias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!token || !selectedId) {
        setSelectedDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const detail = await getIncidentDetail(token, selectedId);
        setSelectedDetail(detail);
      } catch {
        setSelectedDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [selectedId, token]);

  useEffect(() => {
    return () => {
      if (evidenceUrl) {
        URL.revokeObjectURL(evidenceUrl);
      }
    };
  }, [evidenceUrl]);

  const openEvidence = async (incidentId: string, evidenceId: string) => {
    if (!token) return;
    setEvidenceError(null);
    setEvidenceLoadingId(evidenceId);
    try {
      const url = await getEvidenceObjectUrl(token, incidentId, evidenceId);
      if (evidenceUrl) {
        URL.revokeObjectURL(evidenceUrl);
      }
      setEvidenceUrl(url);
      setEvidenceTitle(`Evidencia ${evidenceId.slice(0, 8)}`);
    } catch (e) {
      setEvidenceError(e instanceof Error ? e.message : "No se pudo cargar evidencia");
    } finally {
      setEvidenceLoadingId(null);
    }
  };

  const closeEvidence = () => {
    if (evidenceUrl) {
      URL.revokeObjectURL(evidenceUrl);
    }
    setEvidenceUrl(null);
    setEvidenceTitle(null);
  };

  const priorityCount = useMemo(() => {
    const result: Record<PriorityLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const item of items) {
      result[item.priority] += 1;
    }
    return result;
  }, [items]);

  return (
    <>
      <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 md:grid-cols-5">
        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "")}
        >
          <option value="">Estado: todos</option>
          <option value="REPORTED">Reportado</option>
          <option value="IN_REVIEW">En revision</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="RESOLVED">Resuelto</option>
          <option value="REJECTED">Rechazado</option>
        </select>
        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as IncidentCategory | "")}
        >
          <option value="">Categoria: todas</option>
          <option value="INFRASTRUCTURE">Infraestructura</option>
          <option value="SECURITY">Seguridad</option>
          <option value="CLEANING">Limpieza</option>
        </select>
        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityLevel | "")}
        >
          <option value="">Prioridad: todas</option>
          <option value="LOW">Baja</option>
          <option value="MEDIUM">Media</option>
          <option value="HIGH">Alta</option>
          <option value="CRITICAL">Critica</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-2 py-2 text-sm"
          />
          <button
            onClick={fetchList}
            className="rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Filtrar
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatBox label="Total" value={String(total)} />
        <StatBox label="Criticas" value={String(priorityCount.CRITICAL)} />
        <StatBox label="Altas" value={String(priorityCount.HIGH)} />
        <StatBox label="Medias+Bajas" value={String(priorityCount.MEDIUM + priorityCount.LOW)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold text-slate-700">
            Incidencias ({items.length})
          </div>
          {loading ? <p className="p-4 text-sm text-slate-500">Cargando...</p> : null}
          {error ? <p className="p-4 text-sm text-red-600">{error}</p> : null}
          <ul className="max-h-[520px] overflow-y-auto">
            {items.map((item) => {
              const priorityBg =
                item.priority === "CRITICAL"
                  ? "bg-red-50"
                  : item.priority === "HIGH"
                    ? "bg-orange-50"
                    : "bg-yellow-50";
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className={`grid w-full gap-1 border-b border-[var(--line)] px-4 py-3 text-left hover:bg-emerald-50 ${
                      selectedId === item.id ? "bg-emerald-100" : priorityBg
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      [{item.priority}] {item.category}
                    </span>
                    <span className="line-clamp-2 text-sm text-slate-700">{item.description}</span>
                    <span className="text-xs text-slate-500">
                      Reportante: {item.reporter_campus_id}
                    </span>
                  </button>
                </li>
              );
            })}
            {!loading && items.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500">Sin incidencias para los filtros.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Detalle</h2>
          {detailLoading ? <p className="text-sm text-slate-500">Cargando detalle...</p> : null}
          {!detailLoading && !selectedDetail ? (
            <p className="text-sm text-slate-500">Selecciona una incidencia del listado.</p>
          ) : null}
          {selectedDetail ? (
            <div className="grid gap-3 text-sm">
              <DetailRow label="ID" value={selectedDetail.id} mono />
              <DetailRow label="Estado" value={selectedDetail.status} />
              <DetailRow label="Categoria" value={selectedDetail.category} />
              <DetailRow label="Prioridad" value={selectedDetail.priority} />
              <DetailRow label="Reportante" value={selectedDetail.reporter_name} />
              <DetailRow label="Descripcion" value={selectedDetail.description} />
              {selectedDetail.location ? (
                <DetailRow
                  label="GPS"
                  value={`${selectedDetail.location.latitude.toFixed(6)}, ${selectedDetail.location.longitude.toFixed(6)}`}
                  mono
                />
              ) : null}
              <DetailRow label="Evidencias" value={String(selectedDetail.evidences.length)} />
              {selectedDetail.evidences.length > 0 ? (
                <div className="grid gap-2 rounded-lg border border-[var(--line)] p-2.5">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Ver evidencia
                  </span>
                  {selectedDetail.evidences.map((evidence) => (
                    <button
                      key={evidence.id}
                      onClick={() => openEvidence(selectedDetail.id, evidence.id)}
                      className="rounded-lg border border-[var(--line)] px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      {evidenceLoadingId === evidence.id
                        ? "Cargando imagen..."
                        : `Ver imagen ${evidence.id.slice(0, 8)}`}
                    </button>
                  ))}
                </div>
              ) : null}
              <DetailRow label="Metricas IA" value={String(selectedDetail.ai_metrics.length)} />
              {selectedDetail.ai_metrics.length > 0 ? (
                <div className="grid gap-2 rounded-lg border border-[var(--line)] p-2.5">
                  <span className="text-xs uppercase tracking-[0.15em] text-slate-500">
                    Ultimas metricas IA
                  </span>
                  {selectedDetail.ai_metrics.slice(0, 3).map((metric) => {
                    const source =
                      metric.raw_response && typeof metric.raw_response.source === "string"
                        ? metric.raw_response.source
                        : "unknown";
                    const fallbackReason =
                      metric.raw_response &&
                      typeof metric.raw_response.fallback_reason === "string"
                        ? metric.raw_response.fallback_reason
                        : null;
                    return (
                      <div
                        key={metric.id}
                        className="grid gap-1 rounded-lg border border-[var(--line)] bg-slate-50 p-2"
                      >
                        <p className="text-xs text-slate-500">
                          {new Date(metric.created_at).toLocaleString()} | {metric.model_name}
                        </p>
                        <p className="text-xs font-semibold text-slate-800">
                          Categoria IA: {metric.predicted_category} | Prioridad:{" "}
                          {metric.priority_label} ({metric.priority_score}) | Confianza:{" "}
                          {metric.confidence}
                        </p>
                        <p className="text-xs text-slate-700">
                          Motivo IA: {metric.reasoning_summary || "Sin resumen"}
                        </p>
                        <p className="text-xs text-slate-600">Fuente: {source}</p>
                        {fallbackReason ? (
                          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                            Fallback: {fallbackReason}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <DetailRow
                label="Notificaciones"
                value={String(selectedDetail.notifications.length)}
              />
              {evidenceError ? (
                <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                  {evidenceError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {evidenceUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{evidenceTitle ?? "Evidencia"}</h3>
              <button
                onClick={closeEvidence}
                className="rounded-lg border border-[var(--line)] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={evidenceUrl}
              alt={evidenceTitle ?? "Evidencia"}
              className="w-full rounded-xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-emerald-900">{value}</p>
    </article>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 rounded-lg border border-[var(--line)] p-2.5">
      <span className="text-xs uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <span className={`text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
