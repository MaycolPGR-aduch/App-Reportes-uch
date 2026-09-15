"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AssignmentListItem,
  AssignmentStatus,
  IncidentCategory,
  StaffMember,
  listAssignments,
} from "@/lib/api-client";
import {
  assignmentStatusLabels,
  assignmentStatusTones,
  categoryLabels,
  priorityLabels,
  priorityTones,
} from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  type Column,
} from "@/components/ui";

const PAGE_SIZE = 25;

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ["ASSIGNED", "ACKNOWLEDGED", "COMPLETED"];
const CATEGORIES: IncidentCategory[] = ["INFRASTRUCTURE", "SECURITY", "CLEANING"];

/** AAAA-MM-DD en hora local, que es lo que entiende un `<input type="date">`. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** El día anterior, en hora local. */
function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Convierte el día elegido en el instante que el servidor debe comparar.
 *
 * El rango es inclusivo: «hasta el 15» significa hasta el final del 15, no
 * hasta su medianoche inicial. Sin este ajuste el último día quedaría fuera.
 */
function startOfDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toISOString();
}
function endOfDay(iso: string): string {
  return new Date(`${iso}T23:59:59.999`).toISOString();
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  staff: StaffMember[];
};

/**
 * Todas las asignaciones hechas, filtrables y paginadas.
 *
 * La pestaña tenía el flujo para asignar y la carga de cada persona, pero
 * ninguna vista de conjunto: para saber qué se había encomendado en un día
 * había que abrir la carga de cada responsable, uno por uno.
 *
 * Arranca mostrando hoy y ayer, que es lo que se consulta a diario; los
 * filtros permiten llegar a cualquier fecha, estado, categoría o persona.
 */
export function AssignmentsList({ staff }: Props) {
  const [dateFrom, setDateFrom] = useState(isoDate(yesterday()));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const [category, setCategory] = useState<IncidentCategory | "">("");
  const [responsibleId, setResponsibleId] = useState("");
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<AssignmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAssignments({
        date_from: dateFrom ? startOfDay(dateFrom) : undefined,
        date_to: dateTo ? endOfDay(dateTo) : undefined,
        status_filter: status || undefined,
        category: category || undefined,
        responsible_id: responsibleId || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las asignaciones");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status, category, responsibleId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cualquier cambio de filtro vuelve a la primera página: la actual podría
  // no existir con el nuevo total.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setCategory("");
    setResponsibleId("");
    setPage(0);
  };

  const backToDefault = () => {
    setDateFrom(isoDate(yesterday()));
    setDateTo(isoDate(new Date()));
    setStatus("");
    setCategory("");
    setResponsibleId("");
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const columns: Array<Column<AssignmentListItem>> = [
    {
      key: "assigned_at",
      header: "Asignada",
      cell: (r) => <span className="whitespace-nowrap text-xs">{fecha(r.assigned_at)}</span>,
    },
    {
      key: "incident",
      header: "Incidencia",
      cell: (r) => (
        <div className="grid gap-1">
          <span className="line-clamp-2 text-sm text-body">{r.incident_description}</span>
          <span className="flex flex-wrap gap-1">
            <Badge tone="neutral">{categoryLabels[r.incident_category]}</Badge>
            <Badge tone={priorityTones[r.incident_priority]} dot>
              {priorityLabels[r.incident_priority]}
            </Badge>
            {r.incident_zone_name ? (
              <span className="text-xs text-muted">{r.incident_zone_name}</span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: "responsible",
      header: "Responsable",
      cell: (r) => (
        <div className="grid">
          <span className="text-sm">{r.responsible_name}</span>
          <span className="text-xs text-muted">{r.responsible_area}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <div className="grid gap-1">
          <Badge tone={assignmentStatusTones[r.assignment_status]} dot>
            {assignmentStatusLabels[r.assignment_status]}
          </Badge>
          {r.overdue ? <Badge tone="danger">Vencida</Badge> : null}
        </div>
      ),
    },
    {
      key: "due",
      header: "Plazo",
      cell: (r) => (
        <span className={r.overdue ? "text-xs font-medium text-[var(--tone-danger-fg)]" : "text-xs"}>
          {fecha(r.due_at)}
        </span>
      ),
    },
    {
      key: "completed",
      header: "Completada",
      cell: (r) => <span className="text-xs">{fecha(r.completed_at)}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Todas las asignaciones"
        description="Por defecto se muestran las de hoy y ayer. Usa los filtros para consultar cualquier fecha."
      />
      <CardBody className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Desde">
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => withReset(setDateFrom)(e.target.value)}
              />
            )}
          </Field>
          <Field label="Hasta">
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => withReset(setDateTo)(e.target.value)}
              />
            )}
          </Field>
          <Field label="Estado">
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(e) => withReset(setStatus)(e.target.value as AssignmentStatus | "")}
              >
                <option value="">Todos</option>
                {ASSIGNMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {assignmentStatusLabels[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Categoría">
            {({ id }) => (
              <Select
                id={id}
                value={category}
                onChange={(e) => withReset(setCategory)(e.target.value as IncidentCategory | "")}
              >
                <option value="">Todas</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabels[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Personal">
            {({ id }) => (
              <Select
                id={id}
                value={responsibleId}
                onChange={(e) => withReset(setResponsibleId)(e.target.value)}
              >
                <option value="">Todo el personal</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            {loading
              ? "Cargando…"
              : total === 0
                ? "Sin asignaciones para estos filtros"
                : `Mostrando ${from}–${to} de ${total}`}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={backToDefault}>
              Hoy y ayer
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Ver todo
            </Button>
          </span>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.assignment_id}
          caption="Asignaciones que coinciden con los filtros"
          loading={loading ? <SkeletonRows rows={5} /> : undefined}
          empty={
            <EmptyState
              className="border-0"
              title="Nada por aquí"
              description="Ninguna asignación coincide con los filtros elegidos."
            />
          }
        />

        {totalPages > 1 ? (
          <nav className="flex items-center justify-between gap-2" aria-label="Paginación">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Siguiente
            </Button>
          </nav>
        ) : null}
      </CardBody>
    </Card>
  );
}
