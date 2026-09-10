"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
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
import { initialsOf, roleLabels, userStatusLabels, userStatusTones } from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Skeleton,
  buttonClasses,
} from "@/components/ui";

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
      // Sin sesión no hay perfil que mostrar.
      router.replace("/login?next=/profile");
      setCargaError(e instanceof Error ? e.message : "No se pudo cargar el perfil");
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // La repetición se comprueba aquí y no sólo en el servidor porque el error
  // es de escritura, y no merece un viaje de ida y vuelta.
  const noCoinciden = repetida.length > 0 && nueva !== repetida;

  const cambiarClave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClaveError(null);
    setClaveAviso(null);

    if (nueva !== repetida) {
      setClaveError("La nueva contraseña y su repetición no coinciden.");
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
      setClaveError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña");
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
      <main className="mx-auto grid w-full max-w-3xl flex-1 gap-5 px-4 py-8 sm:px-6">
        {cargaError ? (
          <Alert tone="danger">{cargaError}</Alert>
        ) : (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-56 w-full rounded-card" />
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-base font-bold text-brand-text"
            aria-hidden="true"
          >
            {initialsOf(perfil.full_name)}
          </span>
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-text">
              Mi cuenta
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{perfil.full_name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={PANEL[perfil.role]} className={buttonClasses("secondary", "sm")}>
            Volver al panel
          </Link>
          <Button variant="secondary" size="sm" onClick={salir}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader
          title="Tus datos"
          description="El código campus y el correo sólo puede cambiarlos un administrador."
        />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Dato label="Código campus">
              <span className="font-mono">{perfil.campus_id}</span>
            </Dato>
            <Dato label="Correo">
              <span className="break-all">{perfil.email}</span>
            </Dato>
            <Dato label="Rol">{roleLabels[perfil.role]}</Dato>
            <Dato label="Estado">
              <Badge tone={userStatusTones[perfil.status]} dot>
                {userStatusLabels[perfil.status]}
              </Badge>
            </Dato>
            <Dato label="Cuenta creada">{fecha(perfil.created_at)}</Dato>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cambiar contraseña"
          description="Al cambiarla se cerrarán tus sesiones en los demás dispositivos."
        />
        <CardBody>
          <form className="grid gap-4 sm:max-w-md" onSubmit={cambiarClave}>
            <Field label="Contraseña actual">
              {({ id, describedBy }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  autoComplete="current-password"
                  minLength={8}
                  required
                />
              )}
            </Field>

            <Field label="Nueva contraseña" hint="Al menos 8 caracteres.">
              {({ id, describedBy }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              )}
            </Field>

            <Field
              label="Repite la nueva contraseña"
              error={noCoinciden ? "Las dos contraseñas no coinciden." : null}
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              )}
            </Field>

            {claveError ? <Alert tone="danger">{claveError}</Alert> : null}
            {claveAviso ? <Alert tone="success">{claveAviso}</Alert> : null}

            <Button
              type="submit"
              className="justify-self-start"
              loading={guardando}
              disabled={noCoinciden}
            >
              Cambiar contraseña
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sesiones" />
        <CardBody className="grid gap-3">
          <p className="text-sm text-body">
            {perfil.other_sessions === 0
              ? "Esta es tu única sesión abierta."
              : "Tienes " + perfil.other_sessions + " sesión(es) abiertas en otros dispositivos."}
          </p>
          <p className="text-xs text-muted">
            Si no reconoces alguna, ciérralas y cambia tu contraseña.
          </p>

          {sesionesAviso ? <Alert tone="success">{sesionesAviso}</Alert> : null}

          <Button
            variant="secondary"
            className="justify-self-start"
            onClick={cerrarOtras}
            loading={cerrando}
            disabled={perfil.other_sessions === 0}
          >
            Cerrar las demás sesiones
          </Button>
        </CardBody>
      </Card>
    </main>
  );
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}
