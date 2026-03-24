"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { UserRole, login } from "@/lib/api-client";
import { IncidentsWorkspace } from "@/components/incidents-workspace";

const TOKEN_KEY = "campus_access_token";
const ROLE_KEY = "campus_user_role";
const CAMPUS_ID_KEY = "campus_user_id";

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedRole = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
    if (storedToken) setToken(storedToken);
    if (storedRole) setRole(storedRole);
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(CAMPUS_ID_KEY);
    setToken(null);
    setRole(null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const response = await login(campusId.trim(), password);
      window.localStorage.setItem(TOKEN_KEY, response.access_token);
      window.localStorage.setItem(ROLE_KEY, response.role);
      window.localStorage.setItem(CAMPUS_ID_KEY, response.campus_id);
      setToken(response.access_token);
      setRole(response.role);
      setPassword("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "No se pudo iniciar sesion");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 px-4 py-10 sm:px-6">
        <form
          className="grid w-full gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm"
          onSubmit={handleLogin}
        >
          <h1 className="font-heading text-2xl font-semibold text-emerald-900">
            Login para dashboard
          </h1>
          <label className="grid gap-1 text-sm">
            Codigo campus
            <input
              className="rounded-xl border border-[var(--line)] px-3 py-2"
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Contrasena
            <input
              className="rounded-xl border border-[var(--line)] px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
          <button
            disabled={authLoading}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-70"
          >
            {authLoading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-bold text-emerald-950">
          Dashboard de Incidencias
        </h1>
        <div className="flex items-center gap-2">
          {role === "ADMIN" ? (
            <Link
              href="/dashboard/admin"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Ir a panel admin
            </Link>
          ) : null}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
      <IncidentsWorkspace token={token} />
    </main>
  );
}

