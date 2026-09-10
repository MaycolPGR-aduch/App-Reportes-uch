"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiHttpError,
  AssignmentStatus,
  StaffOwnAssignmentItem,
  completeMyStaffAssignment,
  getCurrentUser,
  listMyStaffAssignments,
  logout,
} from "@/lib/api-client";
import {
  assignmentStatusLabels,
  assignmentStatusTones,
  categoryLabels,
  priorityLabels,
  priorityTones,
  readableDate,
  relativeTime,
  statusLabels,
  statusTones,
} from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Select,
  Skeleton,
  StatCard,
  buttonClasses,
  cx,
} from "@/components/ui";

type AssignmentFilter = "ALL" | AssignmentStatus;

const FILTERS: Array<{ value: AssignmentFilter; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "ASSIGNED", label: assignmentStatusLabels.ASSIGNED },
  { value: "ACKNOWLEDGED", label: assignmentStatusLabels.ACKNOWLEDGED },
  { value: "COMPLETED", label: assignmentStatusLabels.COMPLETED },
];

function isOverdue(item: StaffOwnAssignmentItem): boolean {
  return (
    item.assignment_status !== "COMPLETED" &&
    item.due_at !== null &&
    new Date(item.due_at) < new Date()
  );
}

export default function StaffDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssignmentFilter>("ALL");

  const [assignments, setAssignments] = useState<StaffOwnAssignmentItem[]>([]);
  const [assignmentsTotal, setAssignmentsTotal] = useState(0);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [completingAssignmentId, setCompletingAssignmentId] = useState<string | null>(null);

  const clearSession = () => {
    void logout().catch(() => undefined);
    setToken(null);
    setCampusId(null);
  };

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user.role === "ADMIN") return router.replace("/dashboard/admin");
        if (user.role !== "STAFF") return router.replace("/dashboard");
        setToken("cookie-session");
        setCampusId(user.campus_id);
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  const fetchAssignments = useCallback(async () => {
    if (!token) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const response = await listMyStaffAssignments({
        status_filter: filter === "ALL" ? undefined : filter,
        limit: 200,
        offset: 0,
      });
      setAssignments(response.items);
      setAssignmentsTotal(response.total);
    } catch (error) {
      if (error instanceof ApiHttpError && (error.status === 401 || error.status === 403)) {
        clearSession();
        router.replace("/dashboard");
        return;
      }
      setAssignmentsError(
        error instanceof Error ? error.message : "No se pudieron cargar tus asignaciones",
      );
    } finally {
      setAssignmentsLoading(false);
    }
  }, [filter, router, token]);

  useEffect(() => {
    if (!token) return;
    fetchAssignments();
  }, [fetchAssignments, token]);

  const completeAssignment = async (assignmentId: string) => {
    if (!token) return;
    setCompletingAssignmentId(assignmentId);
    setAssignmentsError(null);
    setActionMessage(null);
    try {
      const response = await completeMyStaffAssignment(assignmentId);
      setActionMessage(response.message);
      await fetchAssignments();
    } catch (error) {
      if (error instanceof ApiHttpError && (error.status === 401 || error.status === 403)) {
        clearSession();
        router.replace("/dashboard");
        return;
      }
      setAssignmentsError(error instanceof Error ? error.message : "No se pudo completar la tarea");
    } finally {
      setCompletingAssignmentId(null);
    }
  };

  const summary = useMemo(() => {
    const result: Record<AssignmentStatus, number> = {
      ASSIGNED: 0,
      ACKNOWLEDGED: 0,
      COMPLETED: 0,
    };
    let overdue = 0;
    for (const item of assignments) {
      result[item.assignment_status] += 1;
      if (isOverdue(item)) overdue += 1;
    }
    return { ...result, overdue };
  }, [assignments]);

  /*
   * Lo vencido primero y, dentro de lo pendiente, lo que antes vence.
   * La lista llegaba en el orden del servidor, así que una tarea con el plazo
   * pasado podía quedar la última de doscientas.
   */
  const ordered = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const aDone = a.assignment_status === "COMPLETED";
      const bDone = b.assignment_status === "COMPLETED";
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return b.assigned_at.localeCompare(a.assigned_at);
    });
  }, [assignments]);

  if (!token) {
    return (
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-20 rounded-card" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-text">
            Panel de personal
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Mis asignaciones</h1>
          <p className="mt-1 text-sm text-muted">
            Sesión de <span className="font-medium text-ink">{campusId ?? "staff"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/profile" className={buttonClasses("secondary", "sm")}>
            Mi cuenta
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              clearSession();
              router.replace("/dashboard");
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Asignaciones" value={assignmentsTotal} loading={assignmentsLoading} />
        <StatCard
          label="Pendientes"
          value={summary.ASSIGNED + summary.ACKNOWLEDGED}
          tone="info"
          loading={assignmentsLoading}
        />
        {/* El plazo vencido no aparecía en ninguna parte de esta pantalla, que
            es justo el dato que decide qué se atiende primero. */}
        <StatCard
          label="Con plazo vencido"
          value={summary.overdue}
          tone={summary.overdue > 0 ? "danger" : "success"}
          hint={summary.overdue > 0 ? "Atiéndelas primero" : "Nada fuera de plazo"}
          loading={assignmentsLoading}
        />
        <StatCard
          label="Completadas"
          value={summary.COMPLETED}
          tone="success"
          loading={assignmentsLoading}
        />
      </section>

      <Card>
        <CardHeader
          title="Incidencias asignadas"
          description="Ordenadas por urgencia: primero lo vencido, luego lo que antes vence."
          actions={
            <>
              <Select
                aria-label="Filtrar por estado de la asignación"
                className="h-8 w-auto text-xs"
                value={filter}
                onChange={(event) => setFilter(event.target.value as AssignmentFilter)}
              >
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={fetchAssignments} loading={assignmentsLoading}>
                Actualizar
              </Button>
            </>
          }
        />
        <CardBody className="grid gap-3">
          {assignmentsError ? <Alert tone="danger">{assignmentsError}</Alert> : null}
          {actionMessage ? <Alert tone="success">{actionMessage}</Alert> : null}

          {assignmentsLoading ? (
            <>
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </>
          ) : ordered.length === 0 ? (
            <EmptyState
              title="No tienes asignaciones para este filtro"
              description={
                filter === "ALL"
                  ? "Cuando administración te encomiende una incidencia aparecerá aquí."
                  : "Prueba con el filtro «Todas» para ver el resto."
              }
            />
          ) : (
            ordered.map((assignment) => (
              <AssignmentCard
                key={assignment.assignment_id}
                assignment={assignment}
                completing={completingAssignmentId === assignment.assignment_id}
                onComplete={() => completeAssignment(assignment.assignment_id)}
              />
            ))
          )}
        </CardBody>
      </Card>
    </main>
  );
}

function AssignmentCard({
  assignment,
  completing,
  onComplete,
}: {
  assignment: StaffOwnAssignmentItem;
  completing: boolean;
  onComplete: () => void;
}) {
  const overdue = isOverdue(assignment);
  const done = assignment.assignment_status === "COMPLETED";

  return (
    <article
      className={cx(
        "rounded-lg border p-3.5 transition-colors",
        overdue ? "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)]" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={priorityTones[assignment.incident_priority]} dot>
          {priorityLabels[assignment.incident_priority]}
        </Badge>
        <Badge tone="neutral">{categoryLabels[assignment.incident_category]}</Badge>
        <Badge tone={statusTones[assignment.incident_status]}>
          {statusLabels[assignment.incident_status]}
        </Badge>
        <Badge tone={assignmentStatusTones[assignment.assignment_status]}>
          {assignmentStatusLabels[assignment.assignment_status]}
        </Badge>
        <span className="ml-auto font-mono text-xs text-subtle">
          {assignment.incident_id.slice(0, 8)}
        </span>
      </div>

      <p className="mt-2.5 text-sm text-body">{assignment.incident_description}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted">
          <p>
            Zona: <span className="text-ink">{assignment.incident_zone_name ?? "No definida"}</span>
            {" · "}
            Área: <span className="text-ink">{assignment.responsible_area_name}</span>
          </p>
          {/* El plazo se da en relativo porque lo que importa es cuánto falta,
              y en absoluto en el título para quien necesite el día exacto. */}
          {assignment.due_at && !done ? (
            <p
              className={cx("mt-0.5 font-medium", overdue ? "text-[var(--tone-danger-fg)]" : "")}
              title={readableDate(assignment.due_at)}
            >
              {overdue ? "Venció " : "Vence "}
              {relativeTime(assignment.due_at)}
            </p>
          ) : null}
          {assignment.completed_at ? (
            <p className="mt-0.5 text-[var(--tone-success-fg)]">
              Atendida el {readableDate(assignment.completed_at)}
            </p>
          ) : null}
        </div>

        {done ? (
          <Badge tone="success" dot size="md">
            Completada
          </Badge>
        ) : (
          <Button size="sm" onClick={onComplete} loading={completing}>
            Marcar completada
          </Button>
        )}
      </div>
    </article>
  );
}
