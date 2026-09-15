"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ApiHttpError,
  IncidentCategory,
  UserRole,
  createReport,
  getCurrentUser,
  logout,
} from "@/lib/api-client";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { categoryLabels, categoryOrder, roleLabels } from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  buttonClasses,
  cx,
} from "@/components/ui";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type ReportMode = "ANONYMOUS" | "AUTHENTICATED";

const DESCRIPTION_MIN = 5;
const DESCRIPTION_MAX = 280;

export function ReportForm() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [campusIdStored, setCampusIdStored] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>("ANONYMOUS");

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("INFRASTRUCTURE");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [photo, setPhoto] = useState<File | null>(null);
  const [communityConsent, setCommunityConsent] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // El error de un campo no aparece mientras se escribe, sólo al intentar
  // enviar: señalar «muy corto» en la primera letra es hostigar, no ayudar.
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setToken("cookie-session");
        setRole(user.role);
        setCampusIdStored(user.campus_id);
        setMode("AUTHENTICATED");
      })
      .catch(() => undefined);
  }, []);

  const previewUrl = useMemo(() => {
    if (!photo) return null;
    return URL.createObjectURL(photo);
  }, [photo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const trimmedDescription = description.trim();
  const descriptionError =
    trimmedDescription.length === 0
      ? "Escribe qué ocurrió."
      : trimmedDescription.length < DESCRIPTION_MIN
        ? "Faltan " + (DESCRIPTION_MIN - trimmedDescription.length) + " caracteres para el mínimo."
        : null;

  const stepsDone = {
    description: descriptionError === null,
    photo: photo !== null,
    location: coordinates !== null,
  };
  const missing = [
    !stepsDone.description && "la descripción",
    !stepsDone.photo && "la foto",
    !stepsDone.location && "la ubicación",
  ].filter(Boolean) as string[];
  const needsLogin = mode === "AUTHENTICATED" && !token;
  const ready = missing.length === 0 && !needsLogin;

  const handleLogout = () => {
    void logout().catch(() => undefined);
    setToken(null);
    setRole(null);
    setCampusIdStored(null);
    setSubmitSuccess(null);
    setMode("ANONYMOUS");
  };

  const requestLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Este navegador no permite compartir la ubicación.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        setLocationLoading(false);
      },
      (error) => {
        setLocationError(error.message);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowFieldErrors(true);
    if (!ready || !photo || !coordinates) return;

    const formData = new FormData();
    const sanitizedTitle = reportTitle.trim();
    if (sanitizedTitle) formData.append("title", sanitizedTitle);
    formData.append("description", trimmedDescription);
    formData.append("category", category);
    formData.append("latitude", String(coordinates.latitude));
    formData.append("longitude", String(coordinates.longitude));
    if (coordinates.accuracy != null) {
      formData.append("accuracy_m", String(coordinates.accuracy));
    }
    formData.append("photo", photo);
    if (mode === "AUTHENTICATED" && communityConsent) {
      formData.append("community_consent", "true");
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      // El backend deduce el modo de la cookie de sesión, no de una cabecera.
      const response = await createReport(formData, turnstileToken);
      const prefix = mode === "ANONYMOUS" ? "Reporte anónimo enviado" : "Incidencia enviada";
      setSubmitSuccess(prefix + " · código " + response.incident_id.slice(0, 8));
      setDescription("");
      setReportTitle("");
      setPhoto(null);
      setCommunityConsent(false);
      setShowFieldErrors(false);
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 401) {
        handleLogout();
        setSubmitError("Tu sesión expiró. Inicia sesión de nuevo para enviar el reporte.");
        return;
      }
      setSubmitError(error instanceof Error ? error.message : "No se pudo enviar el reporte");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Card className="p-4 sm:p-5">
        <p className="text-sm font-semibold text-ink">¿Cómo quieres enviar el reporte?</p>
        <p className="mt-1 text-xs text-muted">
          Con una cuenta podrás seguir su avance; el reporte anónimo no permite seguimiento.
        </p>
        <div role="radiogroup" aria-label="Modo de envío" className="mt-3 grid gap-2 sm:grid-cols-2">
          <ModeOption
            selected={mode === "ANONYMOUS"}
            title="Anónimo"
            detail="Sin cuenta, sin seguimiento"
            onClick={() => {
              setMode("ANONYMOUS");
              setCommunityConsent(false);
            }}
          />
          <ModeOption
            selected={mode === "AUTHENTICATED"}
            title="Con mi cuenta"
            detail="Puedes seguir el estado"
            onClick={() => setMode("AUTHENTICATED")}
          />
        </div>

        {needsLogin ? (
          <div className="mt-3 grid gap-2.5 rounded-lg border border-line bg-sunken p-3">
            <p className="text-sm text-body">
              Para asociar el reporte a tu identidad necesitas iniciar sesión.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/login?next=/" className={buttonClasses("primary", "sm")}>
                Iniciar sesión
              </Link>
              <Link href="/register?next=/" className={buttonClasses("secondary", "sm")}>
                Crear cuenta
              </Link>
            </div>
          </div>
        ) : null}

        {mode === "AUTHENTICATED" && token ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-sunken px-3 py-2">
            <p className="text-sm text-body">
              Sesión activa: <strong className="text-ink">{campusIdStored ?? "usuario"}</strong>
              {role ? <span className="text-muted"> · {roleLabels[role]}</span> : null}
            </p>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        ) : null}
      </Card>

      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <Step number={1} title="Cuéntanos qué ocurrió" done={stepsDone.description}>
          <div className="grid gap-4">
            <Field label="Título" optional hint="Una frase corta ayuda a identificarlo de un vistazo.">
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Cable expuesto en el pabellón B"
                />
              )}
            </Field>

            <Field label="Categoría">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={category}
                  onChange={(event) => setCategory(event.target.value as IncidentCategory)}
                >
                  {categoryOrder.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Descripción"
              error={showFieldErrors ? descriptionError : null}
              hint="Incluye qué observaste y una referencia fácil de reconocer."
            >
              {({ id, describedBy, invalid }) => (
                <>
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    className="min-h-32"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="La luminaria está caída junto a la entrada principal y bloquea parte del paso."
                  />
                  <CharacterCount current={description.length} max={DESCRIPTION_MAX} />
                </>
              )}
            </Field>
          </div>
        </Step>

        <Step number={2} title="Adjunta una foto" done={stepsDone.photo}>
          <p className="text-xs text-muted">
            Procura que el problema se vea con claridad y evita fotografiar rostros.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setPhoto(selected);
              setSubmitError(null);
              setSubmitSuccess(null);
            }}
            className="sr-only"
          />

          {previewUrl ? (
            <figure className="mt-3 grid gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa de la evidencia seleccionada"
                className="h-56 w-full rounded-lg border border-line object-cover"
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate text-xs text-muted">{photo?.name}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    Cambiar
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => setPhoto(null)}>
                    Quitar
                  </Button>
                </span>
              </figcaption>
            </figure>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cx(
                "mt-3 grid w-full place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 transition-colors",
                showFieldErrors && !photo
                  ? "border-[var(--tone-danger-solid)] bg-[var(--tone-danger-bg)]"
                  : "border-line-strong bg-sunken hover:border-brand hover:bg-brand-soft",
              )}
            >
              <CameraIcon />
              <span className="text-sm font-semibold text-ink">Tomar o seleccionar foto</span>
              <span className="text-xs text-muted">JPG, PNG o WebP</span>
            </button>
          )}

          <p className="mt-3 text-xs text-muted">
            La evidencia se revisa después del envío; no necesitas esperar en esta pantalla.
          </p>
        </Step>

        <Step number={3} title="Confirma la ubicación" done={stepsDone.location}>
          <p className="text-xs text-muted">
            Usamos tu posición únicamente para ubicar la incidencia dentro del campus.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={requestLocation} loading={locationLoading}>
              {coordinates ? "Volver a ubicar" : "Usar mi ubicación actual"}
            </Button>
            {coordinates ? (
              <Badge tone="success" dot>
                Ubicación capturada
                {coordinates.accuracy ? " · ±" + coordinates.accuracy.toFixed(0) + " m" : ""}
              </Badge>
            ) : null}
          </div>
          {coordinates ? (
            <p className="mt-2 font-mono text-xs text-subtle">
              {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
            </p>
          ) : null}
          {locationError ? (
            <Alert tone="danger" className="mt-3">
              {locationError}
            </Alert>
          ) : null}
        </Step>

        {mode === "AUTHENTICATED" && token ? (
          <Step number={4} title="Privacidad del reporte" done>
            <p className="text-xs text-muted">El reporte es privado de forma predeterminada.</p>
            <div className="mt-3 rounded-lg border border-line bg-sunken p-3">
              <Checkbox
                checked={communityConsent}
                onChange={(event) => setCommunityConsent(event.target.checked)}
                label="Compartir anónimamente en Comunidad"
                description="Podrá aparecer sin tu identidad tras una revisión automática. Puedes retirarlo desde Mis reportes."
              />
            </div>
          </Step>
        ) : null}

        {mode === "ANONYMOUS" ? <TurnstileWidget onToken={setTurnstileToken} /> : null}

        {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
        {submitSuccess ? (
          <Alert tone="success" title={submitSuccess}>
            Guarda el código por si necesitas mencionarlo.
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Button type="submit" size="lg" block loading={submitLoading} disabled={!ready}>
            Enviar reporte
          </Button>
          {/* Un botón inerte sin explicación es un callejón sin salida: si algo
              falta, se dice qué. */}
          {!ready ? (
            <p className="text-center text-xs text-muted" aria-live="polite">
              {needsLogin
                ? "Inicia sesión o cambia a envío anónimo."
                : "Falta " + listToSentence(missing) + " para poder enviar."}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function ModeOption({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-line-strong",
      )}
    >
      <span className={cx("block text-sm font-semibold", selected ? "text-brand-text" : "text-ink")}>
        {title}
      </span>
      <span className="block text-xs text-muted">{detail}</span>
    </button>
  );
}

/**
 * Paso del formulario.
 *
 * El número se convierte en un visto cuando el paso está resuelto: así el
 * avance se ve sin desplazarse hasta el botón de envío.
 */
function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={cx(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
            done ? "bg-[var(--tone-success-solid)] text-white" : "bg-sunken text-muted",
          )}
          aria-hidden="true"
        >
          {done ? "✓" : number}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="sr-only">{done ? "Paso completado" : "Paso pendiente"}</span>
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/** Contador que solo llama la atención cuando queda poco margen. */
function CharacterCount({ current, max }: { current: number; max: number }) {
  const left = max - current;
  const tight = left <= 30;
  return (
    <span
      className={cx(
        "text-right text-xs tabular-nums",
        tight ? "text-[var(--tone-warning-fg)]" : "text-subtle",
      )}
      aria-live={tight ? "polite" : "off"}
    >
      {tight ? "Quedan " + left + " caracteres" : current + "/" + max}
    </span>
  );
}

/** «la foto» · «la foto y la ubicación» · «la descripción, la foto y la ubicación» */
function listToSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 text-subtle" fill="none" aria-hidden="true">
      <path
        d="M4 8.5h2.7l1.4-2.2h7.8l1.4 2.2H20a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V10A1.5 1.5 0 0 1 4 8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.6" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
