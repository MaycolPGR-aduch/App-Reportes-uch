"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  AssignmentStatus,
  CampusZone,
  IncidentCategory,
  IncidentListItem,
  IncidentStatus,
  PriorityLevel,
  StaffAssignmentItem,
  StaffMember,
  SystemStatusResponse,
  UserRole,
  UserStatus,
  assignIncidentToStaff,
  banAdminUser,
  createCampusZone,
  createAdminUser,
  getSystemStatus,
  listAdminUsers,
  listCampusZones,
  listIncidents,
  listStaff,
  listStaffAssignments,
  login,
  unbanAdminUser,
  updateCampusZone,
  updateAdminUser,
  updateAssignmentStatus,
  updateIncidentStatusAdmin,
} from "@/lib/api-client";
import { IncidentsWorkspace } from "@/components/incidents-workspace";

const TOKEN_KEY = "campus_access_token";
const ROLE_KEY = "campus_user_role";
const CAMPUS_ID_KEY = "campus_user_id";

type TabKey = "INCIDENTS" | "SYSTEM" | "USERS" | "STAFF" | "ZONES";
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

const ASSIGNMENT_STATUS_OPTIONS: AssignmentStatus[] = ["ASSIGNED", "ACKNOWLEDGED", "COMPLETED"];
const INCIDENT_STATUS_OPTIONS: IncidentStatus[] = [
  "REPORTED",
  "IN_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];
const DEFAULT_ZONE_GEOJSON = `{
  "type": "Polygon",
  "coordinates": [[
    [-77.084900, -12.056000],
    [-77.084500, -12.056000],
    [-77.084500, -12.055700],
    [-77.084900, -12.055700],
    [-77.084900, -12.056000]
  ]]
}`;

export default function AdminDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("INCIDENTS");

  const [system, setSystem] = useState<SystemStatusResponse | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [newCampusId, setNewCampusId] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("STUDENT");
  const [newStaffAreaName, setNewStaffAreaName] = useState("");
  const [newStaffPhoneNumber, setNewStaffPhoneNumber] = useState("");
  const [newStaffCategory, setNewStaffCategory] = useState<IncidentCategory>("INFRASTRUCTURE");
  const [newStaffMinPriority, setNewStaffMinPriority] = useState<PriorityLevel>("MEDIUM");

  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("STUDENT");
  const [editStatus, setEditStatus] = useState<UserStatus>("ACTIVE");
  const [editPassword, setEditPassword] = useState("");
  const [editStaffAreaName, setEditStaffAreaName] = useState("");
  const [editStaffPhoneNumber, setEditStaffPhoneNumber] = useState("");
  const [editStaffCategory, setEditStaffCategory] = useState<IncidentCategory>("INFRASTRUCTURE");
  const [editStaffMinPriority, setEditStaffMinPriority] = useState<PriorityLevel>("MEDIUM");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffCategoryFilter, setStaffCategoryFilter] = useState<IncidentCategory | "">("");
  const [staffActiveFilter, setStaffActiveFilter] = useState<ActiveFilter>("ALL");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignmentItem[]>([]);
  const [staffAssignmentsLoading, setStaffAssignmentsLoading] = useState(false);
  const [staffActionMessage, setStaffActionMessage] = useState<string | null>(null);

  const [incidentPool, setIncidentPool] = useState<IncidentListItem[]>([]);
  const [incidentPoolLoading, setIncidentPoolLoading] = useState(false);
  const [assignIncidentId, setAssignIncidentId] = useState("");
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignNotify, setAssignNotify] = useState(true);
  const [assignLoading, setAssignLoading] = useState(false);
  const [manualIncidentStatus, setManualIncidentStatus] = useState<IncidentStatus>("IN_PROGRESS");
  const [incidentStatusLoading, setIncidentStatusLoading] = useState(false);
  const [assignmentStatusLoadingId, setAssignmentStatusLoadingId] = useState<string | null>(null);

  const [zones, setZones] = useState<CampusZone[]>([]);
  const [zonesTotal, setZonesTotal] = useState(0);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [zoneActionMessage, setZoneActionMessage] = useState<string | null>(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [zoneActiveFilter, setZoneActiveFilter] = useState<ActiveFilter>("ALL");
  const [selectedZone, setSelectedZone] = useState<CampusZone | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCode, setNewZoneCode] = useState("");
  const [newZonePriority, setNewZonePriority] = useState(100);
  const [newZoneIsActive, setNewZoneIsActive] = useState(true);
  const [newZoneGeojson, setNewZoneGeojson] = useState(DEFAULT_ZONE_GEOJSON);
  const [editZoneName, setEditZoneName] = useState("");
  const [editZoneCode, setEditZoneCode] = useState("");
  const [editZonePriority, setEditZonePriority] = useState(100);
  const [editZoneIsActive, setEditZoneIsActive] = useState(true);
  const [editZoneGeojson, setEditZoneGeojson] = useState(DEFAULT_ZONE_GEOJSON);

  const clearSession = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(CAMPUS_ID_KEY);
    setToken(null);
    setRole(null);
  };

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedRole = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
    if (storedToken && storedRole === "ADMIN") {
      setToken(storedToken);
      setRole(storedRole);
      return;
    }
    if (storedToken && storedRole && storedRole !== "ADMIN") {
      clearSession();
      setAuthError("Solo ADMIN puede acceder a este dashboard.");
    }
  }, []);

  const fetchSystem = useCallback(async () => {
    if (!token) return;
    setSystemLoading(true);
    setSystemError(null);
    try {
      setSystem(await getSystemStatus(token));
    } catch (e) {
      setSystemError(e instanceof Error ? e.message : "No se pudo cargar estado del sistema");
    } finally {
      setSystemLoading(false);
    }
  }, [token]);

  const fetchUsers = useCallback(
    async (searchValue?: string) => {
      if (!token) return;
      setUsersLoading(true);
      setUsersError(null);
      try {
        const data = await listAdminUsers(token, {
          search: (searchValue ?? "").trim() || undefined,
          limit: 200,
          offset: 0,
        });
        setUsers(data.items);
        setUsersTotal(data.total);
      } catch (e) {
        setUsersError(e instanceof Error ? e.message : "No se pudo cargar usuarios");
      } finally {
        setUsersLoading(false);
      }
    },
    [token],
  );

  const fetchStaff = useCallback(async () => {
    if (!token) return;
    setStaffLoading(true);
    setStaffError(null);
    try {
      const data = await listStaff(token, {
        search: staffSearch.trim() || undefined,
        category: staffCategoryFilter || undefined,
        active:
          staffActiveFilter === "ALL"
            ? undefined
            : staffActiveFilter === "ACTIVE"
              ? true
              : false,
        limit: 300,
        offset: 0,
      });
      setStaff(data.items);
      setStaffTotal(data.total);
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "No se pudo cargar staff");
    } finally {
      setStaffLoading(false);
    }
  }, [staffActiveFilter, staffCategoryFilter, staffSearch, token]);

  const fetchIncidentPool = useCallback(async () => {
    if (!token) return;
    setIncidentPoolLoading(true);
    setStaffError(null);
    try {
      const statusBlocks = await Promise.all(
        ["REPORTED", "IN_REVIEW", "IN_PROGRESS"].map((statusFilter) =>
          listIncidents(token, {
            status_filter: statusFilter as IncidentStatus,
            limit: 100,
            offset: 0,
          }),
        ),
      );
      const unique = new Map<string, IncidentListItem>();
      for (const block of statusBlocks) {
        for (const item of block.items) {
          unique.set(item.id, item);
        }
      }
      const ordered = Array.from(unique.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      setIncidentPool(ordered);
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "No se pudo cargar incidencias");
    } finally {
      setIncidentPoolLoading(false);
    }
  }, [token]);

  const fetchStaffAssignments = useCallback(
    async (staffId: string) => {
      if (!token) return;
      setStaffAssignmentsLoading(true);
      setStaffError(null);
      try {
        const data = await listStaffAssignments(token, staffId, { limit: 200, offset: 0 });
        setStaffAssignments(data.items);
      } catch (e) {
        setStaffError(e instanceof Error ? e.message : "No se pudo cargar asignaciones");
      } finally {
        setStaffAssignmentsLoading(false);
      }
    },
    [token],
  );

  const fetchZones = useCallback(async () => {
    if (!token) return;
    setZonesLoading(true);
    setZonesError(null);
    try {
      const data = await listCampusZones(token, {
        search: zoneSearch.trim() || undefined,
        active:
          zoneActiveFilter === "ALL" ? undefined : zoneActiveFilter === "ACTIVE" ? true : false,
        limit: 500,
        offset: 0,
      });
      setZones(data.items);
      setZonesTotal(data.total);
    } catch (e) {
      setZonesError(e instanceof Error ? e.message : "No se pudo cargar zonas");
    } finally {
      setZonesLoading(false);
    }
  }, [token, zoneActiveFilter, zoneSearch]);

  useEffect(() => {
    if (!token || role !== "ADMIN") return;
    fetchSystem();
    fetchUsers();
    fetchStaff();
    fetchIncidentPool();
    fetchZones();
  }, [fetchIncidentPool, fetchStaff, fetchSystem, fetchUsers, fetchZones, role, token]);

  useEffect(() => {
    if (!selectedStaff) {
      setStaffAssignments([]);
      return;
    }
    fetchStaffAssignments(selectedStaff.id);
  }, [fetchStaffAssignments, selectedStaff]);

  const selectedIncident = useMemo(
    () => incidentPool.find((item) => item.id === assignIncidentId) ?? null,
    [assignIncidentId, incidentPool],
  );
  const staffProfileByEmail = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const item of staff) {
      const key = item.email.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return map;
  }, [staff]);

  useEffect(() => {
    if (selectedIncident) {
      setManualIncidentStatus(selectedIncident.status);
    }
  }, [selectedIncident]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await login(campusId.trim(), password);
      if (res.role !== "ADMIN") {
        setAuthError("Solo ADMIN puede acceder.");
        return;
      }
      window.localStorage.setItem(TOKEN_KEY, res.access_token);
      window.localStorage.setItem(ROLE_KEY, res.role);
      window.localStorage.setItem(CAMPUS_ID_KEY, res.campus_id);
      setToken(res.access_token);
      setRole(res.role);
      setPassword("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Error de login");
    } finally {
      setAuthLoading(false);
    }
  };

  const selectUserForEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword("");

    const linkedStaff = staffProfileByEmail.get(user.email.trim().toLowerCase()) ?? null;
    setEditStaffAreaName(linkedStaff?.area_name ?? "");
    setEditStaffPhoneNumber(linkedStaff?.phone_number ?? "");
    setEditStaffCategory(linkedStaff?.category ?? "INFRASTRUCTURE");
    setEditStaffMinPriority(linkedStaff?.min_priority ?? "MEDIUM");
  };

  const saveUserEdit = async () => {
    if (!token || !selectedUser) return;
    setUsersError(null);
    try {
      const payload = {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword.trim() || undefined,
        ...(editRole === "STAFF"
          ? {
              staff_area_name: editStaffAreaName.trim() || undefined,
              staff_phone_number: editStaffPhoneNumber.trim() || null,
              staff_category: editStaffCategory,
              staff_min_priority: editStaffMinPriority,
            }
          : {}),
      };
      await updateAdminUser(token, selectedUser.id, {
        ...payload,
      });
      await Promise.all([fetchUsers(search), fetchStaff()]);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "No se pudo actualizar usuario");
    }
  };

  const toggleBan = async (user: AdminUser) => {
    if (!token) return;
    try {
      if (user.status === "ACTIVE") await banAdminUser(token, user.id);
      else await unbanAdminUser(token, user.id);
      await fetchUsers(search);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "No se pudo cambiar estado del usuario");
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setUsersError(null);
    try {
      const payload = {
        campus_id: newCampusId.trim(),
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        ...(newRole === "STAFF"
          ? {
              staff_area_name: newStaffAreaName.trim() || undefined,
              staff_phone_number: newStaffPhoneNumber.trim() || null,
              staff_category: newStaffCategory,
              staff_min_priority: newStaffMinPriority,
            }
          : {}),
      };
      await createAdminUser(token, {
        ...payload,
      });
      setNewCampusId("");
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("STUDENT");
      setNewStaffAreaName("");
      setNewStaffPhoneNumber("");
      setNewStaffCategory("INFRASTRUCTURE");
      setNewStaffMinPriority("MEDIUM");
      await Promise.all([fetchUsers(search), fetchStaff()]);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "No se pudo crear usuario");
    }
  };

  const selectStaffForAssignment = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember);
    setAssignStaffId(staffMember.id);
    setStaffActionMessage(null);
  };

  const assignIncidentHandler = async () => {
    if (!token) return;
    if (!assignIncidentId || !assignStaffId) {
      setStaffError("Selecciona incidencia y staff para asignar.");
      return;
    }
    setAssignLoading(true);
    setStaffError(null);
    try {
      const response = await assignIncidentToStaff(token, assignIncidentId, {
        responsible_id: assignStaffId,
        notes: assignNotes.trim() || undefined,
        notify: assignNotify,
      });
      setStaffActionMessage(response.message);
      setAssignNotes("");
      await Promise.all([fetchStaff(), fetchIncidentPool(), fetchSystem()]);
      if (selectedStaff) {
        await fetchStaffAssignments(selectedStaff.id);
      }
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "No se pudo asignar incidencia");
    } finally {
      setAssignLoading(false);
    }
  };

  const updateAssignmentStatusHandler = async (
    assignmentId: string,
    statusValue: AssignmentStatus,
  ) => {
    if (!token || !selectedStaff) return;
    setAssignmentStatusLoadingId(assignmentId);
    setStaffError(null);
    try {
      const response = await updateAssignmentStatus(token, assignmentId, {
        status: statusValue,
      });
      setStaffActionMessage(response.message);
      await Promise.all([fetchStaffAssignments(selectedStaff.id), fetchIncidentPool(), fetchSystem()]);
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "No se pudo actualizar asignación");
    } finally {
      setAssignmentStatusLoadingId(null);
    }
  };

  const updateIncidentStatusHandler = async () => {
    if (!token || !assignIncidentId) {
      setStaffError("Selecciona una incidencia para cambiar su estado.");
      return;
    }
    setIncidentStatusLoading(true);
    setStaffError(null);
    try {
      const response = await updateIncidentStatusAdmin(token, assignIncidentId, {
        status: manualIncidentStatus,
      });
      setStaffActionMessage(response.message);
      await Promise.all([fetchIncidentPool(), fetchSystem()]);
    } catch (e) {
      setStaffError(e instanceof Error ? e.message : "No se pudo actualizar estado de incidencia");
    } finally {
      setIncidentStatusLoading(false);
    }
  };

  const parseZoneGeojson = (raw: string): Record<string, unknown> => {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("GeoJSON debe ser un objeto JSON válido.");
    }
    return parsed as Record<string, unknown>;
  };

  const selectZoneForEdit = (zone: CampusZone) => {
    setSelectedZone(zone);
    setEditZoneName(zone.name);
    setEditZoneCode(zone.code ?? "");
    setEditZonePriority(zone.priority);
    setEditZoneIsActive(zone.is_active);
    setEditZoneGeojson(JSON.stringify(zone.polygon_geojson, null, 2));
    setZoneActionMessage(null);
  };

  const createZoneHandler = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setZonesError(null);
    try {
      const polygonGeojson = parseZoneGeojson(newZoneGeojson);
      await createCampusZone(token, {
        name: newZoneName.trim(),
        code: newZoneCode.trim() || null,
        priority: Number(newZonePriority),
        polygon_geojson: polygonGeojson,
        is_active: newZoneIsActive,
      });
      setNewZoneName("");
      setNewZoneCode("");
      setNewZonePriority(100);
      setNewZoneIsActive(true);
      setNewZoneGeojson(DEFAULT_ZONE_GEOJSON);
      setZoneActionMessage("Zona creada correctamente.");
      await fetchZones();
    } catch (e) {
      setZonesError(e instanceof Error ? e.message : "No se pudo crear zona");
    }
  };

  const saveZoneEditHandler = async () => {
    if (!token || !selectedZone) return;
    setZonesError(null);
    try {
      const polygonGeojson = parseZoneGeojson(editZoneGeojson);
      await updateCampusZone(token, selectedZone.id, {
        name: editZoneName.trim(),
        code: editZoneCode.trim() || null,
        priority: Number(editZonePriority),
        polygon_geojson: polygonGeojson,
        is_active: editZoneIsActive,
      });
      setZoneActionMessage("Zona actualizada correctamente.");
      await fetchZones();
    } catch (e) {
      setZonesError(e instanceof Error ? e.message : "No se pudo actualizar zona");
    }
  };

  if (!token || role !== "ADMIN") {
    return (
      <main className="admin-login-stage mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="admin-login-frame">
          <div className="admin-login-border" />
          <form className="admin-login-card" onSubmit={handleLogin}>
            <div className="space-y-1">
              <p className="admin-login-kicker">Panel administrativo</p>
              <h1 className="text-2xl font-semibold leading-tight text-emerald-950">Login para dashboard</h1>
              <p className="text-xs text-slate-600">Acceso exclusivo para usuarios ADMIN.</p>
            </div>

            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Codigo campus
              <input
                className="admin-login-input"
                placeholder="Ejemplo: uadmin01"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                required
              />
            </label>

            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Contrasena
              <input
                className="admin-login-input"
                type="password"
                placeholder="Ingresa tu contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {authError ? (
              <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-700">
                {authError}
              </p>
            ) : null}

            <button
              disabled={authLoading}
              className="admin-login-submit"
            >
              {authLoading ? "Ingresando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-dashboard-pro mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-emerald-950">Dashboard Admin</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("INCIDENTS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "INCIDENTS" ? "bg-emerald-700 text-white" : "border border-[var(--line)]"
            }`}
          >
            Incidencias
          </button>
          <button
            onClick={() => setTab("SYSTEM")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "SYSTEM" ? "bg-emerald-700 text-white" : "border border-[var(--line)]"
            }`}
          >
            Sistema
          </button>
          <button
            onClick={() => setTab("STAFF")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "STAFF" ? "bg-emerald-700 text-white" : "border border-[var(--line)]"
            }`}
          >
            Staff
          </button>
          <button
            onClick={() => setTab("ZONES")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "ZONES" ? "bg-emerald-700 text-white" : "border border-[var(--line)]"
            }`}
          >
            Zonas
          </button>
          <button
            onClick={() => setTab("USERS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === "USERS" ? "bg-emerald-700 text-white" : "border border-[var(--line)]"
            }`}
          >
            Usuarios
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Dashboard base
          </Link>
          <button
            onClick={clearSession}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Salir
          </button>
        </div>
      </div>

      {tab === "INCIDENTS" ? <IncidentsWorkspace token={token} /> : null}

      {tab === "SYSTEM" ? (
        <section className="admin-panel rounded-2xl border border-[var(--line)] bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Estado del sistema</h2>
            <button
              onClick={fetchSystem}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {systemLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
          {systemError ? <p className="text-sm text-red-600">{systemError}</p> : null}
          {system ? (
            <div className="grid gap-2 text-sm">
              <p>
                API: <strong>{system.api_ok ? "OK" : "FAIL"}</strong>
              </p>
              <p>
                Gemini: <strong>{system.gemini.state}</strong> ({system.gemini.model})
              </p>
              <p>
                Fallback 24h: <strong>{system.gemini.fallback_count_24h}</strong>
              </p>
              <p>
                Quota 429: <strong>{system.gemini.quota_exhausted_detected ? "SI" : "NO"}</strong>
              </p>
              <div className="grid gap-1">
                {system.workers.map((w) => (
                  <p key={w.name}>
                    {w.name}: <strong>{w.state}</strong> (pending {w.pending_jobs}, processing{" "}
                    {w.processing_jobs})
                  </p>
                ))}
              </div>
              <div className="grid gap-1 rounded-lg border border-[var(--line)] bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-700">Cola de jobs</p>
                {system.queue_summary.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin jobs recientes.</p>
                ) : null}
                {system.queue_summary.map((item, index) => (
                  <p key={`${item.job_type}-${item.job_status}-${index}`} className="text-xs">
                    {item.job_type} / {item.job_status}: <strong>{item.count}</strong>
                  </p>
                ))}
              </div>
              {system.notes.length > 0 ? (
                <div className="grid gap-1 rounded-lg bg-slate-100 p-2">
                  {system.notes.map((note, index) => (
                    <p key={index} className="text-xs text-slate-700">
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
              {system.gemini.latest_fallback_reason ? (
                <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  Ultimo fallback: {system.gemini.latest_fallback_reason}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "STAFF" ? (
        <section className="grid gap-4">
          <div className="admin-panel rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Staff operativo ({staffTotal})</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  placeholder="Buscar staff..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
                <select
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  value={staffCategoryFilter}
                  onChange={(e) => setStaffCategoryFilter(e.target.value as IncidentCategory | "")}
                >
                  <option value="">Todas categorías</option>
                  <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                  <option value="SECURITY">SECURITY</option>
                  <option value="CLEANING">CLEANING</option>
                </select>
                <select
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  value={staffActiveFilter}
                  onChange={(e) => setStaffActiveFilter(e.target.value as ActiveFilter)}
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                </select>
                <button
                  onClick={fetchStaff}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Buscar
                </button>
              </div>
            </div>
            <p className="mb-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
              Alta y edición de staff ahora se realiza solo desde la pestaña Usuarios (rol STAFF).
            </p>
            {staffError ? <p className="mb-2 text-xs text-red-600">{staffError}</p> : null}
            {staffActionMessage ? (
              <p className="mb-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {staffActionMessage}
              </p>
            ) : null}
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Área</th>
                    <th className="p-2">Contacto</th>
                    <th className="p-2">Pend.</th>
                    <th className="p-2">Comp.</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {staffLoading ? (
                    <tr>
                      <td className="p-2" colSpan={6}>
                        Cargando...
                      </td>
                    </tr>
                  ) : (
                    staff.map((item) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer border-t border-[var(--line)] ${
                          selectedStaff?.id === item.id ? "bg-emerald-50" : ""
                        }`}
                        onClick={() => selectStaffForAssignment(item)}
                      >
                        <td className="p-2">{item.full_name}</td>
                        <td className="p-2">
                          {item.area_name} ({item.category})
                        </td>
                        <td className="p-2">
                          <div className="grid">
                            <span>{item.email}</span>
                            <span>{item.phone_number ?? "Sin teléfono"}</span>
                          </div>
                        </td>
                        <td className="p-2">{item.pending_assignments}</td>
                        <td className="p-2">{item.completed_assignments}</td>
                        <td className="p-2">{item.is_active ? "Activo" : "Inactivo"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-sm font-semibold">Asignación manual y estado de incidencia</h3>
              <select
                value={assignIncidentId}
                onChange={(e) => setAssignIncidentId(e.target.value)}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              >
                <option value="">Selecciona incidencia</option>
                {incidentPool.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    [{incident.status}] [{incident.priority}] {incident.id.slice(0, 8)} -{" "}
                    {incident.description.slice(0, 70)} | Zona:{" "}
                    {incident.location_zone_name ?? "No definida"}
                  </option>
                ))}
              </select>
              <select
                value={assignStaffId}
                onChange={(e) => setAssignStaffId(e.target.value)}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              >
                <option value="">Selecciona staff</option>
                {staff
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name} - {item.area_name} ({item.category})
                    </option>
                  ))}
              </select>
              <textarea
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Notas de asignación"
                maxLength={300}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={assignNotify}
                  onChange={(e) => setAssignNotify(e.target.checked)}
                />
                Enviar correo al responsable
              </label>
              <button
                onClick={assignIncidentHandler}
                disabled={assignLoading || incidentPoolLoading}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {assignLoading ? "Asignando..." : "Asignar incidencia"}
              </button>
              <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-slate-50 p-2">
                <select
                  value={manualIncidentStatus}
                  onChange={(e) => setManualIncidentStatus(e.target.value as IncidentStatus)}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                >
                  {INCIDENT_STATUS_OPTIONS.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {statusValue}
                    </option>
                  ))}
                </select>
                <button
                  onClick={updateIncidentStatusHandler}
                  disabled={incidentStatusLoading || !assignIncidentId}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold disabled:opacity-70"
                >
                  {incidentStatusLoading ? "Actualizando..." : "Actualizar estado de incidencia"}
                </button>
              </div>
            </div>

            <div className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-sm font-semibold">
                Incidencias asignadas {selectedStaff ? `(${selectedStaff.full_name})` : ""}
              </h3>
              {!selectedStaff ? (
                <p className="text-xs text-slate-500">Selecciona un staff para ver asignaciones.</p>
              ) : staffAssignmentsLoading ? (
                <p className="text-xs text-slate-500">Cargando asignaciones...</p>
              ) : staffAssignments.length === 0 ? (
                <p className="text-xs text-slate-500">No hay asignaciones registradas.</p>
              ) : (
                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="p-1.5">Incidencia</th>
                        <th className="p-1.5">Zona</th>
                        <th className="p-1.5">Estado</th>
                        <th className="p-1.5">Asignación</th>
                        <th className="p-1.5">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffAssignments.map((assignment) => (
                        <tr key={assignment.assignment_id} className="border-t border-[var(--line)]">
                          <td className="p-1.5">
                            {assignment.incident_id.slice(0, 8)} ({assignment.incident_category})
                          </td>
                          <td className="p-1.5">{assignment.incident_zone_name ?? "No definida"}</td>
                          <td className="p-1.5">{assignment.incident_status}</td>
                          <td className="p-1.5">{assignment.assignment_status}</td>
                          <td className="p-1.5">
                            <div className="flex flex-wrap gap-1">
                              {ASSIGNMENT_STATUS_OPTIONS.map((statusValue) => (
                                <button
                                  key={statusValue}
                                  onClick={() =>
                                    updateAssignmentStatusHandler(
                                      assignment.assignment_id,
                                      statusValue,
                                    )
                                  }
                                  disabled={assignmentStatusLoadingId === assignment.assignment_id}
                                  className="rounded border border-[var(--line)] px-2 py-0.5"
                                >
                                  {statusValue}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "ZONES" ? (
        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="admin-panel rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Zonas del campus ({zonesTotal})</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  placeholder="Buscar zona..."
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                />
                <select
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  value={zoneActiveFilter}
                  onChange={(e) => setZoneActiveFilter(e.target.value as ActiveFilter)}
                >
                  <option value="ALL">Todas</option>
                  <option value="ACTIVE">Activas</option>
                  <option value="INACTIVE">Inactivas</option>
                </select>
                <button
                  onClick={fetchZones}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Buscar
                </button>
              </div>
            </div>

            {zonesError ? <p className="mb-2 text-xs text-red-600">{zonesError}</p> : null}
            {zoneActionMessage ? (
              <p className="mb-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                {zoneActionMessage}
              </p>
            ) : null}

            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Código</th>
                    <th className="p-2">Prioridad</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {zonesLoading ? (
                    <tr>
                      <td className="p-2" colSpan={5}>
                        Cargando...
                      </td>
                    </tr>
                  ) : zones.length === 0 ? (
                    <tr>
                      <td className="p-2" colSpan={5}>
                        Sin zonas registradas.
                      </td>
                    </tr>
                  ) : (
                    zones.map((zone) => (
                      <tr
                        key={zone.id}
                        className={`cursor-pointer border-t border-[var(--line)] ${
                          selectedZone?.id === zone.id ? "bg-emerald-50" : ""
                        }`}
                        onClick={() => selectZoneForEdit(zone)}
                      >
                        <td className="p-2">{zone.name}</td>
                        <td className="p-2">{zone.code ?? "-"}</td>
                        <td className="p-2">{zone.priority}</td>
                        <td className="p-2">{zone.is_active ? "Activa" : "Inactiva"}</td>
                        <td className="p-2">
                          {new Date(zone.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4">
            <form
              className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4"
              onSubmit={createZoneHandler}
            >
              <h3 className="text-sm font-semibold">Crear zona</h3>
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Nombre (ej. Pabellon A)"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Código (ej. PAB_A)"
                value={newZoneCode}
                onChange={(e) => setNewZoneCode(e.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                type="number"
                min={0}
                max={1000}
                value={newZonePriority}
                onChange={(e) => setNewZonePriority(Number(e.target.value))}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={newZoneIsActive}
                  onChange={(e) => setNewZoneIsActive(e.target.checked)}
                />
                Activa
              </label>
              <textarea
                className="min-h-[160px] rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-xs"
                value={newZoneGeojson}
                onChange={(e) => setNewZoneGeojson(e.target.value)}
                spellCheck={false}
                required
              />
              <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                Crear zona
              </button>
            </form>

            <div className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-sm font-semibold">Editar zona</h3>
              {!selectedZone ? (
                <p className="text-xs text-slate-500">Selecciona una zona del listado.</p>
              ) : (
                <>
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editZoneName}
                    onChange={(e) => setEditZoneName(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editZoneCode}
                    onChange={(e) => setEditZoneCode(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    type="number"
                    min={0}
                    max={1000}
                    value={editZonePriority}
                    onChange={(e) => setEditZonePriority(Number(e.target.value))}
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={editZoneIsActive}
                      onChange={(e) => setEditZoneIsActive(e.target.checked)}
                    />
                    Activa
                  </label>
                  <textarea
                    className="min-h-[180px] rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-xs"
                    value={editZoneGeojson}
                    onChange={(e) => setEditZoneGeojson(e.target.value)}
                    spellCheck={false}
                  />
                  <button
                    onClick={saveZoneEditHandler}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Guardar cambios
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "USERS" ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="admin-panel rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Usuarios ({usersTotal})</h2>
              <div className="flex gap-2">
                <input
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  onClick={() => fetchUsers(search)}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Buscar
                </button>
              </div>
            </div>
            {usersError ? <p className="mb-2 text-xs text-red-600">{usersError}</p> : null}
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-2">Campus</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Rol</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td className="p-2" colSpan={5}>
                        Cargando...
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--line)]">
                        <td className="p-2">{u.campus_id}</td>
                        <td className="p-2">{u.full_name}</td>
                        <td className="p-2">{u.role}</td>
                        <td className="p-2">{u.status}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <button
                              className="rounded border border-[var(--line)] px-2 py-1"
                              onClick={() => selectUserForEdit(u)}
                            >
                              Editar
                            </button>
                            <button
                              className={`rounded px-2 py-1 text-white ${
                                u.status === "ACTIVE" ? "bg-red-600" : "bg-emerald-700"
                              }`}
                              onClick={() => toggleBan(u)}
                            >
                              {u.status === "ACTIVE" ? "Banear" : "Reactivar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4">
            <form
              className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4"
              onSubmit={createUser}
            >
              <h3 className="text-sm font-semibold">Crear usuario</h3>
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Campus ID"
                value={newCampusId}
                onChange={(e) => setNewCampusId(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Nombre completo"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                type="email"
                placeholder="Correo"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                type="password"
                placeholder="Contrasena"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <select
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="STUDENT">STUDENT</option>
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              {newRole === "STAFF" ? (
                <>
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="Área staff (ej. Seguridad UCH)"
                    value={newStaffAreaName}
                    onChange={(e) => setNewStaffAreaName(e.target.value)}
                    required
                  />
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    placeholder="Teléfono staff (opcional)"
                    value={newStaffPhoneNumber}
                    onChange={(e) => setNewStaffPhoneNumber(e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={newStaffCategory}
                    onChange={(e) => setNewStaffCategory(e.target.value as IncidentCategory)}
                  >
                    <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                    <option value="SECURITY">SECURITY</option>
                    <option value="CLEANING">CLEANING</option>
                  </select>
                  <select
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={newStaffMinPriority}
                    onChange={(e) => setNewStaffMinPriority(e.target.value as PriorityLevel)}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </>
              ) : null}
              <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                Crear
              </button>
            </form>

            <div className="admin-panel admin-form-surface grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4">
              <h3 className="text-sm font-semibold">Editar usuario</h3>
              {!selectedUser ? (
                <p className="text-xs text-slate-500">Selecciona un usuario.</p>
              ) : (
                <>
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <select
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="STAFF">STAFF</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  {editRole === "STAFF" ? (
                    <>
                      <input
                        className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        placeholder="Área staff"
                        value={editStaffAreaName}
                        onChange={(e) => setEditStaffAreaName(e.target.value)}
                        required
                      />
                      <input
                        className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        placeholder="Teléfono staff (opcional)"
                        value={editStaffPhoneNumber}
                        onChange={(e) => setEditStaffPhoneNumber(e.target.value)}
                      />
                      <select
                        className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        value={editStaffCategory}
                        onChange={(e) => setEditStaffCategory(e.target.value as IncidentCategory)}
                      >
                        <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                        <option value="SECURITY">SECURITY</option>
                        <option value="CLEANING">CLEANING</option>
                      </select>
                      <select
                        className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        value={editStaffMinPriority}
                        onChange={(e) => setEditStaffMinPriority(e.target.value as PriorityLevel)}
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="CRITICAL">CRITICAL</option>
                      </select>
                    </>
                  ) : null}
                  <select
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    type="password"
                    placeholder="Nueva contrasena opcional"
                    minLength={8}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                  <button
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                    onClick={saveUserEdit}
                  >
                    Guardar cambios
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}


