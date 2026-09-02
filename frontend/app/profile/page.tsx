"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";
import {
  Profile,
  changePassword,
  getProfile,
  logout,
  revokeOtherSessions,
} from "@/lib/api-client";

const ROL = {
  STUDENT: "Estudiante",
  STAFF: "Personal",
  ADMIN: "Administrador",
} as const;

const ESTADO = {
  ACTIVE: "Activa",
  INACTIVE: "Inactiva",
} as const;

/** El panel al que vuelve cada rol. */
const PANEL = {
  STUDENT: "/dashboard",
  STAFF: "/dashboard/staff",
  ADMIN: "/dashboard/admin",
} as const;

function fecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [claveError, setClaveError] = useState<string | null>(null);
  const [claveAviso, setClaveAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [sesionesAviso, setSesionesAviso] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPerfil(await getProfile());
    } catch (e) {
      // Sin sesion no hay perfil que mostrar.
      router.replace("/login?next=/profile");
      setCargaError(e instanceof Error ? e.message : "No se pudo cargar el perfil");
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarClave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClaveError(null);
    setClaveAviso(null);

    // Se comprueba aqui y no solo en el servidor porque el error de escritura
    // es del usuario, y no merece un viaje de ida y vuelta.
    if (nueva !== repetida) {
      setClaveError("La nueva contrasena y su repeticion no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const r = await changePassword(actual, nueva);
      setActual("");
      setNueva("");
      setRepetida("");
      setClaveAviso(r.message);
      void cargar();
    } catch (e) {
      setClaveError(e instanceof Error ? e.message : "No se pudo cambiar la contrasena");
    } finally {
      setGuardando(false);
    }
  };

  const cerrarOtras = async () => {
    setSesionesAviso(null);
    setCerrando(true);
    try {
      const r = await revokeOtherSessions();
      setSesionesAviso(r.message);
      void cargar();
    } catch (e) {
      setSesionesAviso(e instanceof Error ? e.message : "No se pudieron cerrar");
    } finally {
      setCerrando(false);
    }
  };

  const salir = async () => {
    await logout().catch(() => undefined);
    router.replace("/login");
  };

  if (!perfil) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-12">
        <p className="text-sm text-slate-600">
          {cargaError ?? "Cargando tu perfil…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-700">
            Mi cuenta
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-emerald-950">
            {perfil.full_name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={PANEL[perfil.role]}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Volver al panel
          </Link>
          <button
            type="button"
            onClick={salir}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------- datos */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-heading text-lg font-semibold text-emerald-900">Tus datos</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Codigo campus
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-slate-800">{perfil.campus_id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Correo
            </dt>
            <dd className="mt-0.5 text-sm break-all text-slate-800">{perfil.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rol
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">{ROL[perfil.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Estado
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">
              <span
                className={
                  perfil.status === "ACTIVE"
                    ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                    : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
                }
              >
                {ESTADO[perfil.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cuenta creada
            </dt>
            <dd className="mt-0.5 text-sm text-slate-800">{fecha(perfil.created_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          El codigo campus y el correo identifican tu cuenta y solo puede cambiarlos un
          administrador.
        </p>
      </section>

      {/* --------------------------------------------------- contrasena */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-heading text-lg font-semibold text-emerald-900">
          Cambiar contrasena
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Al cambiarla se cerraran tus sesiones en los demas dispositivos.
        </p>

        <form className="mt-4 grid gap-3 sm:max-w-md" onSubmit={cambiarClave}>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            Contrasena actual
            <PasswordInput
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            Nueva contrasena
            <PasswordInput
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
            Repite la nueva contrasena
            <PasswordInput
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {claveError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-700"
            >
              {claveError}
            </p>
          ) : null}

          {claveAviso ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-800"
            >
              {claveAviso}
            </p>
          ) : null}

          <button
            disabled={guardando}
            className="justify-self-start rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {guardando ? "Guardando…" : "Cambiar contrasena"}
          </button>
        </form>
      </section>

      {/* ---------------------------------------------------- sesiones */}
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-heading text-lg font-semibold text-emerald-900">Sesiones</h2>
        <p className="mt-1 text-sm text-slate-700">
          {perfil.other_sessions === 0
            ? "Esta es tu unica sesion abierta."
            : `Tienes ${perfil.other_sessions} sesion(es) abiertas en otros dispositivos.`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Si no reconoces alguna, cierralas y cambia tu contrasena.
        </p>

        {sesionesAviso ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-800"
          >
            {sesionesAviso}
          </p>
        ) : null}

        <button
          type="button"
          onClick={cerrarOtras}
          disabled={cerrando || perfil.other_sessions === 0}
          className="mt-3 rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cerrando ? "Cerrando…" : "Cerrar las demas sesiones"}
        </button>
      </section>
    </main>
  );
}
