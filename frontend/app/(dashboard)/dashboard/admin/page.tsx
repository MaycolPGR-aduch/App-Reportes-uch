"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminUser,
  SystemStatusResponse,
  UserRole,
  UserStatus,
  banAdminUser,
  createAdminUser,
  getSystemStatus,
  listAdminUsers,
  login,
  unbanAdminUser,
  updateAdminUser,
} from "@/lib/api-client";
import { IncidentsWorkspace } from "@/components/incidents-workspace";

const TOKEN_KEY = "campus_access_token";
const ROLE_KEY = "campus_user_role";
const CAMPUS_ID_KEY = "campus_user_id";

type TabKey = "INCIDENTS" | "SYSTEM" | "USERS";

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

  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("STUDENT");
  const [editStatus, setEditStatus] = useState<UserStatus>("ACTIVE");
  const [editPassword, setEditPassword] = useState("");

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

  useEffect(() => {
    if (!token || role !== "ADMIN") return;
    fetchSystem();
    fetchUsers();
  }, [fetchSystem, fetchUsers, role, token]);

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
  };

  const saveUserEdit = async () => {
    if (!token || !selectedUser) return;
    try {
      await updateAdminUser(token, selectedUser.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword.trim() || undefined,
      });
      await fetchUsers(search);
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
    try {
      await createAdminUser(token, {
        campus_id: newCampusId.trim(),
        full_name: newFullName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setNewCampusId("");
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("STUDENT");
      await fetchUsers(search);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "No se pudo crear usuario");
    }
  };

  if (!token || role !== "ADMIN") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <form
          className="grid w-full gap-4 rounded-2xl border border-[var(--line)] bg-white p-6"
          onSubmit={handleLogin}
        >
          <h1 className="text-2xl font-semibold text-emerald-900">Login Dashboard Admin</h1>
          <input
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            placeholder="Codigo campus"
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
            required
          />
          <input
            className="rounded-xl border border-[var(--line)] px-3 py-2"
            type="password"
            placeholder="Contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
          <button
            disabled={authLoading}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white"
          >
            {authLoading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
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
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
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

      {tab === "USERS" ? (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
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
              className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4"
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
              <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                Crear
              </button>
            </form>

            <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4">
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

