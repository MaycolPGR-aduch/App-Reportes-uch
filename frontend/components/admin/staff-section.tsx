"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IncidentCategory,
  StaffAssignmentItem,
  StaffMember,
  listStaff,
  listStaffAssignments,
} from "@/lib/api-client";
import {
  assignmentStatusLabels,
  assignmentStatusTones,
  categoryLabels,
  categoryOrder,
  priorityLabels,
  priorityTones,
  readableDate,
  relativeTime,
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
  Input,
  Select,
  Skeleton,
  SkeletonRows,
  cx,
} from "@/components/ui";
import { BarList, ChartFrame } from "@/components/charts";
import type { Column } from "@/components/ui";

type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

function isOverdue(item: StaffAssignmentItem): boolean {
  return (
    item.assignment_status !== "COMPLETED" &&
    item.due_at !== null &&
    new Date(item.due_at) < new Date()
  );
}

export function StaffSection() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");

  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignmentItem[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStaff({
        search: search.trim() || undefined,
        category: categoryFilter || undefined,
        active: activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE",
        limit: 300,
        offset: 0,
      });
      setStaff(data.items);
      setTotal(data.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el personal");
    } finally {
      setLoading(false);
    }
    // Los filtros se aplican al pulsar «Buscar», no en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setAssignments([]);
      return;
    }
    let current = true;
    setAssignmentsLoading(true);
    listStaffAssignments(selected.id, { limit: 200, offset: 0 })
      .then((data) => current && setAssignments(data.items))
      .catch(
        (cause) =>
          current &&
          setError(cause instanceof Error ? cause.message : "No se pudieron cargar asignaciones"),
      )
      .finally(() => current && setAssignmentsLoading(false));
    return () => {
      current = false;
    };
  }, [selected]);

  const pending = assignments.filter((item) => item.assignment_status !== "COMPLETED");
  const completed = assignments.filter((item) => item.assignment_status === "COMPLETED");

  /* Comparar la carga entre personas es lo que decide a quién se asigna lo
     siguiente; en la tabla, con las cifras en columnas, había que leerlas de
     una en una. */
  const workload = useMemo(
    () =>
      staff
        .filter((member) => member.is_active)
        .sort((a, b) => b.pending_assignments - a.pending_assignments)
        .slice(0, 8)
        .map((member) => ({
          key: member.id,
          label: member.full_name,
          detail: member.area_name,
          value: member.pending_assignments,
        })),
    [staff],
  );

  const columns: Array<Column<StaffMember>> = [
    {
      key: "name",
      header: "Nombre",
      cell: (member) => (
        <span className="grid">
          <span>{member.full_name}</span>
          <span className="text-xs text-muted">{member.email}</span>
        </span>
      ),
    },
    {
      key: "area",
      header: "Área",
      cell: (member) => (
        <span className="grid gap-1">
          <span className="text-xs">{member.area_name}</span>
          <Badge tone="neutral">{categoryLabels[member.category]}</Badge>
        </span>
      ),
    },
    {
      key: "pending",
      header: "Pend.",
      numeric: true,
      cell: (member) => member.pending_assignments,
    },
    {
      key: "completed",
      header: "Comp.",
      numeric: true,
      cell: (member) => member.completed_assignments,
    },
    {
      key: "state",
      header: "Estado",
      cell: (member) => (
        <Badge tone={member.is_active ? "success" : "neutral"} dot>
          {member.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title={`Personal operativo (${total})`}
            description="El alta y la edición se hacen desde Usuarios, con el rol Personal."
            actions={
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void load();
                }}
              >
                <Input
                  className="h-8 w-32 text-xs"
                  placeholder="Buscar…"
                  aria-label="Buscar personal"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  className="h-8 w-auto text-xs"
                  aria-label="Filtrar por categoría"
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value as IncidentCategory | "")
                  }
                >
                  <option value="">Todas las categorías</option>
                  {categoryOrder.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </Select>
                <Select
                  className="h-8 w-auto text-xs"
                  aria-label="Filtrar por estado"
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                </Select>
                <Button size="sm" type="submit" loading={loading}>
                  Buscar
                </Button>
              </form>
            }
          />
          <CardBody className="p-0 pb-3">
            <DataTable
              caption="Personal operativo"
              columns={columns}
              rows={staff}
              rowKey={(member) => member.id}
              onSelect={setSelected}
              selectedKey={selected?.id ?? null}
              rowLabel={(member) => `Ver la carga de ${member.full_name}`}
              loading={loading ? <SkeletonRows rows={6} columns={columns.length} /> : null}
              empty="Nadie coincide con estos filtros."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reparto de la carga" description="Pendientes por persona activa." />
          <CardBody>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (
              <ChartFrame title="Asignaciones abiertas">
                <BarList
                  items={workload}
                  tone="teal"
                  emptyLabel="Nadie tiene asignaciones pendientes."
                />
              </ChartFrame>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={selected ? `Carga de ${selected.full_name}` : "Carga individual"}
          description={
            selected
              ? `${selected.area_name} · ${selected.email}`
              : "Elige una fila del listado para ver qué lleva y qué ya atendió."
          }
        />
        <CardBody className="grid gap-4">
          {!selected ? (
            <EmptyState
              title="Ninguna persona seleccionada"
              description="Pulsa el nombre de una fila para abrir su carga de trabajo."
            />
          ) : assignmentsLoading ? (
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </>
          ) : assignments.length === 0 ? (
            <EmptyState
              title="Sin incidencias asignadas"
              description="Esta persona todavía no tiene ninguna encomienda."
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold text-ink">Pendientes ({pending.length})</h3>
                {pending.length === 0 ? (
                  <p className="text-xs text-muted">Nada pendiente.</p>
                ) : (
                  pending.map((item) => {
                    const overdue = isOverdue(item);
                    return (
                      <article
                        key={item.assignment_id}
                        className={cx(
                          "rounded-lg border p-2.5 text-xs",
                          overdue
                            ? "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)]"
                            : "border-line",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={priorityTones[item.incident_priority]} dot>
                            {priorityLabels[item.incident_priority]}
                          </Badge>
                          <Badge tone="neutral">{categoryLabels[item.incident_category]}</Badge>
                          <Badge tone={assignmentStatusTones[item.assignment_status]}>
                            {assignmentStatusLabels[item.assignment_status]}
                          </Badge>
                          <span className="ml-auto font-mono text-subtle">
                            {item.incident_id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-body">{item.incident_description}</p>
                        <p className="mt-1 text-muted">
                          Zona: {item.incident_zone_name ?? "No definida"}
                        </p>
                        {item.due_at ? (
                          <p
                            className={cx(
                              "mt-0.5 font-medium",
                              overdue ? "text-[var(--tone-danger-fg)]" : "text-muted",
                            )}
                            title={readableDate(item.due_at)}
                          >
                            {overdue ? "Venció " : "Vence "}
                            {relativeTime(item.due_at)}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>

              <div className="grid gap-2">
                <h3 className="text-sm font-semibold text-ink">Atendidas ({completed.length})</h3>
                {completed.length === 0 ? (
                  <p className="text-xs text-muted">Todavía ninguna.</p>
                ) : (
                  <div className="grid max-h-72 gap-1.5 overflow-auto pr-1">
                    {completed.map((item) => (
                      <div
                        key={item.assignment_id}
                        className="border-b border-line-subtle pb-1.5 text-xs last:border-0"
                      >
                        <p className="text-body">
                          <span className="font-mono text-subtle">
                            {item.incident_id.slice(0, 8)}
                          </span>{" "}
                          · {categoryLabels[item.incident_category]} ·{" "}
                          {item.incident_zone_name ?? "Zona no definida"}
                        </p>
                        {item.completed_at ? (
                          <p className="text-[var(--tone-success-fg)]">
                            Atendida el {readableDate(item.completed_at)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
