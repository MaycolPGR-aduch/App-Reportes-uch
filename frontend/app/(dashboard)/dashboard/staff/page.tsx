"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiHttpError,
  AssignmentStatus,
  StaffOwnAssignmentItem,
  UserRole,
  completeMyStaffAssignment,
  listMyStaffAssignments,
} from "@/lib/api-client";
import { IncidentsWorkspace } from "@/components/incidents-workspace";

const TOKEN_KEY = "campus_access_token";
const ROLE_KEY = "campus_user_role";
const CAMPUS_ID_KEY = "campus_user_id";

type AssignmentFilter = "ALL" | AssignmentStatus;

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
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(CAMPUS_ID_KEY);
    setToken(null);
    setCampusId(null);
  };

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedRole = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
    const storedCampusId = window.localStorage.getItem(CAMPUS_ID_KEY);

    if (!storedToken || !storedRole) {
      router.replace("/dashboard");
      return;
    }
    if (storedRole === "ADMIN") {
      router.replace("/dashboard/admin");
      return;
    }
    if (storedRole !== "STAFF") {
      router.replace("/dashboard");
      return;
    }

    setToken(storedToken);
    setCampusId(storedCampusId);
  }, [router]);

  const fetchAssignments = useCallback(async () => {
    if (!token) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const response = await listMyStaffAssignments(token, {
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
      const response = await completeMyStaffAssignment(token, assignmentId);
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
    for (const item of assignments) {
      result[item.assignment_status] += 1;
    }
    return result;
  }, [assignments]);

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10">
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-slate-600">
          Validando sesión de staff...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-heading text-3xl font-bold text-emerald-950">Dashboard Staff</h1>
          <p className="text-sm text-slate-600">
            Usuario: <span className="font-semibold text-slate-800">{campusId ?? "staff"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Ir al general
          </Link>
          <button
            onClick={() => {
              clearSession();
              router.replace("/dashboard");
            }}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <StatBox label="Asignaciones" value={String(assignmentsTotal)} />
        <StatBox label="Pendientes" value={String(summary.ASSIGNED + summary.ACKNOWLEDGED)} />
        <StatBox label="Asignadas" value={String(summary.ASSIGNED)} />
        <StatBox label="Completadas" value={String(summary.COMPLETED)} />
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Mis incidencias asignadas</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
              value={filter}
              onChange={(event) => setFilter(event.target.value as AssignmentFilter)}
            >
              <option value="ALL">Todas</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <button
              onClick={fetchAssignments}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Actualizar
            </button>
          </div>
        </div>

        {assignmentsError ? <p className="mb-2 text-sm text-red-600">{assignmentsError}</p> : null}
        {actionMessage ? (
          <p className="mb-2 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {actionMessage}
          </p>
        ) : null}

        {assignmentsLoading ? (
          <p className="text-sm text-slate-500">Cargando asignaciones...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes asignaciones para este filtro.</p>
        ) : (
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="p-2">Incidencia</th>
                  <th className="p-2">Zona</th>
                  <th className="p-2">Área</th>
                  <th className="p-2">Estado incidencia</th>
                  <th className="p-2">Estado asignación</th>
                  <th className="p-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.assignment_id} className="border-t border-[var(--line)]">
                    <td className="p-2">
                      <p className="font-semibold text-slate-800">
                        {assignment.incident_id.slice(0, 8)} ({assignment.incident_category})
                      </p>
                      <p className="line-clamp-2 text-[11px] text-slate-600">
                        {assignment.incident_description}
                      </p>
                    </td>
                    <td className="p-2">{assignment.incident_zone_name ?? "No definida"}</td>
                    <td className="p-2">{assignment.responsible_area_name}</td>
                    <td className="p-2">{assignment.incident_status}</td>
                    <td className="p-2">{assignment.assignment_status}</td>
                    <td className="p-2">
                      {assignment.assignment_status === "COMPLETED" ? (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                          Completada
                        </span>
                      ) : (
                        <button
                          onClick={() => completeAssignment(assignment.assignment_id)}
                          disabled={completingAssignmentId === assignment.assignment_id}
                          className="rounded border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-70"
                        >
                          {completingAssignmentId === assignment.assignment_id
                            ? "Guardando..."
                            : "Marcar completada"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Incidencias generales</h2>
        <IncidentsWorkspace token={token} />
      </section>
    </main>
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
