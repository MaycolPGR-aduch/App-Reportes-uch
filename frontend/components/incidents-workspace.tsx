"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  categoryLabels,
  categoryOrder,
  labelOf,
  locationStatusLabels,
  locationStatusTones,
  priorityLabels,
  priorityOrder,
  priorityTones,
  readableDate,
  relativeTime,
  statusLabels,
  statusOrder,
  statusTones,
  toneOf,
} from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  StatCard,
  cx,
} from "@/components/ui";

const PAGE_SIZE = 50;

/**
 * Explorador de incidencias: filtros, listado y detalle.
 *
 * Recibía una prop `token` que no era un token —siempre valía la cadena
 * "cookie-session"— y sólo servía para decidir si lanzar la petición. La
 * sesión viaja en la cookie, así que el componente ya no finge tenerla.
 */
export function IncidentsWorkspace() {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [evidenceLoadingId, setEvidenceLoadingId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listIncidents({
        status_filter: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setItems(response.items);
      setTotal(response.total);
      if (response.items.length === 0) setSelectedId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las incidencias");
    } finally {
      setLoading(false);
    }
    // Los filtros se aplican al enviar el formulario, no en cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let current = true;
    setDetailLoading(true);
    getIncidentDetail(selectedId)
      .then((data) => current && setDetail(data))
      .catch(() => current && setDetail(null))
      .finally(() => current && setDetailLoading(false));
    return () => {
      current = false;
    };
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
    };
  }, [evidenceUrl]);

  const openEvidence = async (incidentId: string, evidenceId: string) => {
    setEvidenceError(null);
    setEvidenceLoadingId(evidenceId);
    try {
      const url = await getEvidenceObjectUrl(incidentId, evidenceId);
      if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
      setEvidenceUrl(url);
    } catch (cause) {
      setEvidenceError(cause instanceof Error ? cause.message : "No se pudo cargar la evidencia");
    } finally {
      setEvidenceLoadingId(null);
    }
  };

  const closeEvidence = () => {
    if (evidenceUrl) URL.revokeObjectURL(evidenceUrl);
    setEvidenceUrl(null);
  };

  const priorityCount = useMemo(() => {
    const result: Record<PriorityLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const item of items) result[item.priority] += 1;
    return result;
  }, [items]);

  const unassigned = items.filter((item) => item.assignment_count === 0).length;

  return (
    <div className="grid gap-4">
      <Card>
        <form
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            void fetchList();
          }}
        >
          <Field label="Estado">
            {({ id }) => (
              <Select
                id={id}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as IncidentStatus | "")}
              >
                <option value="">Todos</option>
                {statusOrder.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Categoría">
            {({ id }) => (
              <Select
                id={id}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as IncidentCategory | "")}
              >
                <option value="">Todas</option>
                {categoryOrder.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prioridad">
            {({ id }) => (
              <Select
                id={id}
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as PriorityLevel | "")}
              >
                <option value="">Todas</option>
                {priorityOrder
                  .slice()
                  .reverse()
                  .map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Desde">
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field label="Hasta">
              {({ id }) => (
                <Input
                  id={id}
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              )}
            </Field>
            <Button type="submit" loading={loading}>
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Coinciden" value={total} loading={loading} />
        <StatCard label="Críticas" value={priorityCount.CRITICAL} tone="danger" loading={loading} />
        <StatCard label="Altas" value={priorityCount.HIGH} tone="warning" loading={loading} />
        <StatCard
          label="Sin asignar"
          value={unassigned}
          tone={unassigned > 0 ? "warning" : "success"}
          loading={loading}
        />
      </section>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader
            title={`Listado (${items.length})`}
            description={
              total > items.length
                ? `Se muestran las ${PAGE_SIZE} más recientes de ${total}.`
                : undefined
            }
          />
          <CardBody className="p-0">
            {loading ? (
              <div className="grid gap-2 p-4">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                className="m-4 border-0"
                title="Sin incidencias para estos filtros"
                description="Prueba a ampliar el rango de fechas o quitar algún filtro."
              />
            ) : (
              <ul className="max-h-[34rem] overflow-y-auto">
                {items.map((item) => {
                  const selected = selectedId === item.id;
                  return (
                    <li key={item.id}>
                      {/* Cada fila es un botón real: entra en el tabulador y
                          anuncia si está seleccionada. Antes el color de fondo
                          por prioridad era la única señal, y encima competía
                          con el del propio estado seleccionado. */}
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        aria-current={selected ? "true" : undefined}
                        className={cx(
                          "grid w-full gap-1.5 border-b border-line-subtle px-4 py-3 text-left transition-colors",
                          selected ? "bg-brand-soft" : "hover:bg-sunken",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={priorityTones[item.priority]} dot>
                            {priorityLabels[item.priority]}
                          </Badge>
                          <Badge tone="neutral">{categoryLabels[item.category]}</Badge>
                          <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
                          <span
                            className="ml-auto text-xs text-subtle"
                            title={readableDate(item.created_at)}
                          >
                            {relativeTime(item.created_at)}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-sm text-body">{item.description}</span>
                        <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                          <span>{item.location_zone_name ?? "Zona no definida"}</span>
                          <span>
                            {item.assignment_count === 0
                              ? "Sin asignar"
                              : `Responsable: ${item.assigned_to.join(", ")}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Detalle"
            description={detail ? `Incidencia ${detail.id.slice(0, 8)}` : undefined}
          />
          <CardBody className="grid gap-3">
            {detailLoading ? (
              <>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : !detail ? (
              <EmptyState
                className="border-0"
                title="Ninguna incidencia seleccionada"
                description="Pulsa una fila del listado para ver su ficha completa."
              />
            ) : (
              <IncidentDetailView
                detail={detail}
                onOpenEvidence={openEvidence}
                evidenceLoadingId={evidenceLoadingId}
                evidenceError={evidenceError}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {evidenceUrl ? <EvidenceLightbox url={evidenceUrl} onClose={closeEvidence} /> : null}
    </div>
  );
}

function IncidentDetailView({
  detail,
  onOpenEvidence,
  evidenceLoadingId,
  evidenceError,
}: {
  detail: IncidentDetail;
  onOpenEvidence: (incidentId: string, evidenceId: string) => void;
  evidenceLoadingId: string | null;
  evidenceError: string | null;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={priorityTones[detail.priority]} dot size="md">
          {priorityLabels[detail.priority]}
        </Badge>
        <Badge tone="neutral" size="md">
          {categoryLabels[detail.category]}
        </Badge>
        <Badge tone={statusTones[detail.status]} size="md">
          {statusLabels[detail.status]}
        </Badge>
      </div>

      <p className="text-sm text-body">{detail.description}</p>

      <dl className="grid gap-2 rounded-lg border border-line bg-sunken p-3 text-xs">
        <Dato label="Identificador">
          <span className="font-mono">{detail.id}</span>
        </Dato>
        <Dato label="Reportante">{detail.reporter_name}</Dato>
        <Dato label="Creada">{readableDate(detail.created_at)}</Dato>
        {detail.location ? (
          <>
            <Dato label="Coordenadas">
              <span className="font-mono">
                {detail.location.latitude.toFixed(6)}, {detail.location.longitude.toFixed(6)}
              </span>
            </Dato>
            <Dato label="Zona">
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {detail.location.resolved_zone_name ?? "No definida"}
                <Badge tone={toneOf(locationStatusTones, detail.location.location_status)}>
                  {labelOf(locationStatusLabels, detail.location.location_status)}
                </Badge>
              </span>
            </Dato>
          </>
        ) : null}
      </dl>

      <Bloque titulo={`Responsables (${detail.assignments.length})`}>
        {detail.assignments.length === 0 ? (
          <p className="text-xs text-muted">
            Sin asignar. Usa la sección Asignaciones para encomendarla.
          </p>
        ) : (
          detail.assignments.map((assignment) => {
            const overdue =
              assignment.due_at !== null &&
              assignment.completed_at === null &&
              new Date(assignment.due_at) < new Date();
            return (
              <div
                key={assignment.id}
                className="grid gap-0.5 border-t border-line-subtle pt-2 text-xs first:border-t-0 first:pt-0"
              >
                <p className="font-medium text-ink">
                  {assignment.responsible_name}
                  <span className="font-normal text-muted"> · {assignment.responsible_area}</span>
                </p>
                <p className="text-muted">
                  {assignment.responsible_email}
                  {assignment.responsible_phone ? ` · ${assignment.responsible_phone}` : ""}
                </p>
                {assignment.completed_at ? (
                  <p className="text-[var(--tone-success-fg)]">
                    Atendida el {readableDate(assignment.completed_at)}
                  </p>
                ) : assignment.due_at ? (
                  <p
                    className={cx(
                      overdue ? "font-medium text-[var(--tone-danger-fg)]" : "text-muted",
                    )}
                    title={readableDate(assignment.due_at)}
                  >
                    {overdue ? "Venció " : "Vence "}
                    {relativeTime(assignment.due_at)}
                  </p>
                ) : null}
                {assignment.notes ? <p className="italic text-subtle">{assignment.notes}</p> : null}
              </div>
            );
          })
        )}
      </Bloque>

      <Bloque titulo={`Evidencias (${detail.evidences.length})`}>
        {detail.evidences.length === 0 ? (
          <p className="text-xs text-muted">Sin evidencias adjuntas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.evidences.map((evidence) => (
              <Button
                key={evidence.id}
                size="sm"
                variant="secondary"
                onClick={() => onOpenEvidence(detail.id, evidence.id)}
                loading={evidenceLoadingId === evidence.id}
              >
                Ver imagen {evidence.id.slice(0, 8)}
              </Button>
            ))}
          </div>
        )}
        {evidenceError ? (
          <Alert tone="danger" className="mt-2">
            {evidenceError}
          </Alert>
        ) : null}
      </Bloque>

      {detail.ai_metrics.length > 0 ? (
        <Bloque titulo="Análisis de la IA">
          {detail.ai_metrics.slice(0, 3).map((metric) => {
            const raw = metric.raw_response ?? {};
            const source = typeof raw.source === "string" ? raw.source : "desconocida";
            const fallback = typeof raw.fallback_reason === "string" ? raw.fallback_reason : null;
            return (
              <div key={metric.id} className="grid gap-1 rounded-lg border border-line p-2 text-xs">
                <p className="text-subtle">
                  {readableDate(metric.created_at)} ·{" "}
                  <span className="font-mono">{metric.model_name}</span>
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{categoryLabels[metric.predicted_category]}</Badge>
                  <Badge tone={priorityTones[metric.priority_label]}>
                    {priorityLabels[metric.priority_label]} ({metric.priority_score})
                  </Badge>
                  <span className="text-muted">Confianza {metric.confidence}</span>
                </p>
                <p className="text-body">{metric.reasoning_summary || "Sin resumen."}</p>
                <p className="text-subtle">Fuente: {source}</p>
                {fallback ? <Alert tone="warning">Respaldo usado: {fallback}</Alert> : null}
              </div>
            );
          })}
        </Bloque>
      ) : null}
    </>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 rounded-lg border border-line p-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

/** Visor de la evidencia a tamaño completo. */
function EvidenceLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--scrim)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Evidencia a tamaño completo"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="grid max-h-[90vh] w-full max-w-4xl gap-3 overflow-auto rounded-card border border-line bg-overlay p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Evidencia</h3>
          <Button size="sm" variant="secondary" autoFocus onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Evidencia de la incidencia" className="w-full rounded-lg" />
      </div>
    </div>
  );
}
