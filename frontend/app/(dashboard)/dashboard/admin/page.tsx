"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  SystemStatusResponse,
  UserRole,
  getCurrentUser,
  getSystemStatus,
  login,
  logout,
} from "@/lib/api-client";
import { PasswordInput } from "@/components/password-input";
import { AuthCard } from "@/components/auth-card";
import { AdminNav, type SectionKey } from "@/components/admin/admin-nav";
import { OverviewSection } from "@/components/admin/overview-section";
import { AssignmentsSection } from "@/components/admin/assignments-section";
import { StaffSection } from "@/components/admin/staff-section";
import { ZonesSection } from "@/components/admin/zones-section";
import { UsersSection } from "@/components/admin/users-section";
import { SystemSection } from "@/components/admin/system-section";
import { SocialSection } from "@/components/admin/social-section";
import { IncidentsWorkspace } from "@/components/incidents-workspace";
import { Button, Field, Input, Skeleton, buttonClasses } from "@/components/ui";

/*
 * Armazón del panel de administración.
 *
 * Antes esta pantalla era un único componente de más de mil setecientas líneas
 * con unos sesenta `useState` compartidos entre siete pestañas. Ahora sólo
 * resuelve el acceso y decide qué sección se muestra; cada sección trae sus
 * propios datos al entrar en ella, así que no hay estado que mantener en pie
 * entre secciones ni recargas cruzadas que recordar.
 */

type Estado = "COMPROBANDO" | "SIN_ACCESO" | "DENTRO";

const TITULOS: Record<SectionKey, string> = {
  OVERVIEW: "Resumen",
  INCIDENTS: "Incidencias",
  ASSIGNMENTS: "Asignaciones",
  SOCIAL: "Comunidad",
  STAFF: "Personal",
  ZONES: "Zonas del campus",
  USERS: "Usuarios",
  SYSTEM: "Estado del sistema",
};

export default function AdminDashboardPage() {
  const [estado, setEstado] = useState<Estado>("COMPROBANDO");
  const [seccion, setSeccion] = useState<SectionKey>("OVERVIEW");
  const [system, setSystem] = useState<SystemStatusResponse | null>(null);

  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const admitir = useCallback((role: UserRole) => {
    if (role !== "ADMIN") {
      setEstado("SIN_ACCESO");
      setAuthError("Solo las cuentas de administración pueden abrir este panel.");
      return false;
    }
    setEstado("DENTRO");
    setAuthError(null);
    return true;
  }, []);

  useEffect(() => {
    getCurrentUser()
      .then((user) => admitir(user.role))
      .catch(() => setEstado("SIN_ACCESO"));
  }, [admitir]);

  // El aviso del menú lateral: lo único que merece un número en rojo antes de
  // entrar en la sección es tener trabajo fuera de plazo.
  useEffect(() => {
    if (estado !== "DENTRO") return;
    getSystemStatus()
      .then(setSystem)
      .catch(() => undefined);
  }, [estado]);

  const entrar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const response = await login(campusId.trim(), password);
      setPassword("");
      if (!admitir(response.role)) await logout().catch(() => undefined);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión");
    } finally {
      setAuthLoading(false);
    }
  };

  const salir = async () => {
    await logout().catch(() => undefined);
    setEstado("SIN_ACCESO");
    setSeccion("OVERVIEW");
  };

  if (estado === "COMPROBANDO") {
    return (
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full rounded-card" />
      </main>
    );
  }

  if (estado === "SIN_ACCESO") {
    return (
      <AuthCard
        kicker="Panel administrativo"
        title="Acceso al panel"
        subtitle="Exclusivo para cuentas de administración."
        error={authError}
        loading={authLoading}
        submitLabel="Entrar"
        loadingLabel="Entrando..."
        onSubmit={entrar}
        footer={
          <Link href="/" className="font-semibold text-brand-text hover:underline">
            Volver a reportar
          </Link>
        }
      >
        <Field label="Código campus">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              placeholder="uadmin01"
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
              autoComplete="username"
              required
            />
          )}
        </Field>
        <Field label="Contraseña">
          {({ id, describedBy }) => (
            <PasswordInput
              id={id}
              aria-describedby={describedBy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          )}
        </Field>
      </AuthCard>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
      <div className="lg:contents">
        <AdminNav
          active={seccion}
          onChange={setSeccion}
          alerts={{ ASSIGNMENTS: system?.overdue_assignments ?? 0 }}
        />
      </div>

      <div className="grid min-w-0 gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-text">
              Panel administrativo
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold">{TITULOS[seccion]}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className={buttonClasses("secondary", "sm")}>
              Mi cuenta
            </Link>
            <Button variant="secondary" size="sm" onClick={salir}>
              Cerrar sesión
            </Button>
          </div>
        </header>

        {seccion === "OVERVIEW" ? <OverviewSection /> : null}
        {seccion === "INCIDENTS" ? <IncidentsWorkspace /> : null}
        {seccion === "ASSIGNMENTS" ? <AssignmentsSection /> : null}
        {seccion === "SOCIAL" ? <SocialSection /> : null}
        {seccion === "STAFF" ? <StaffSection /> : null}
        {seccion === "ZONES" ? <ZonesSection /> : null}
        {seccion === "USERS" ? <UsersSection /> : null}
        {seccion === "SYSTEM" ? <SystemSection /> : null}
      </div>
    </main>
  );
}
