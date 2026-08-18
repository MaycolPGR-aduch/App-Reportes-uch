"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser, UserRole, getCurrentUser, login, logout } from "@/lib/api-client";
import { StudentIncidentsFeed } from "@/components/student-incidents-feed";

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setToken("cookie-session");
        setRole(user.role);
        setUser(user);
        if (user.role === "STAFF") router.replace("/dashboard/staff");
        if (user.role === "ADMIN") router.replace("/dashboard/admin");
      })
      .catch(() => undefined);
  }, [router]);

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setToken(null);
    setRole(null);
    setUser(null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const response = await login(campusId.trim(), password);
      setToken("cookie-session");
      setRole(response.role);
      setPassword("");
      if (response.role === "STAFF") {
        router.push("/dashboard/staff");
      } else if (response.role === "ADMIN") {
        router.push("/dashboard/admin");
      } else {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "No se pudo iniciar sesion");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="admin-login-stage mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="admin-login-frame">
          <div className="admin-login-border" />
          <form className="admin-login-card" onSubmit={handleLogin}>
            <div className="space-y-1">
              <p className="admin-login-kicker">Acceso general</p>
              <h1 className="font-heading text-2xl font-semibold leading-tight text-emerald-950">
                Login para dashboard
              </h1>
              <p className="text-xs text-slate-600">
                Ingresa con tu codigo campus para gestionar incidencias.
              </p>
            </div>

            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Codigo campus
              <input
                className="admin-login-input"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            {authError ? (
              <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-700">
                {authError}
              </p>
            ) : null}

            <button disabled={authLoading} className="admin-login-submit">
              {authLoading ? "Ingresando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (role === "STUDENT" && user) {
    return <StudentIncidentsFeed fullName={user.full_name} onLogout={handleLogout} />;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-12">
      <p className="text-sm text-slate-600">Abriendo tu panel…</p>
    </main>
  );
}
