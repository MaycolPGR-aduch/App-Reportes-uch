"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiHttpError,
  IncidentCategory,
  UserRole,
  createReport,
  getCurrentUser,
  login,
  logout,
  registerUser,
} from "@/lib/api-client";
import { TurnstileWidget } from "@/components/turnstile-widget";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type ReportMode = "ANONYMOUS" | "AUTHENTICATED";
type AuthTab = "LOGIN" | "REGISTER";

export function ReportForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [campusIdStored, setCampusIdStored] = useState<string | null>(null);
  const [mode, setMode] = useState<ReportMode>("ANONYMOUS");

  const [campusId, setCampusId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authTab, setAuthTab] = useState<AuthTab>("LOGIN");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await login(campusId.trim(), password);
      setToken("cookie-session");
      setRole(response.role);
      setCampusIdStored(response.campus_id);
      setPassword("");
      setMode("AUTHENTICATED");
      setSubmitSuccess("Sesion iniciada. Puedes reportar inmediatamente.");

      if (response.role === "ADMIN") {
        router.push("/dashboard");
      } else if (response.role === "STAFF") {
        router.push("/dashboard/staff");
      } else {
        router.push("/");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const response = await registerUser({
        campus_id: campusId.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      setPassword("");
      setSubmitSuccess(response.message);
      setMode("ANONYMOUS");
      router.push("/");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setAuthLoading(false);
    }
  };

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
      setLocationError("Geolocalizacion no soportada en este navegador.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
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
    if (mode === "AUTHENTICATED" && !token) {
      setSubmitError("En modo con cuenta debes iniciar sesion.");
      return;
    }
    if (!photo) {
      setSubmitError("Adjunta una foto de evidencia.");
      return;
    }
    if (!coordinates) {
      setSubmitError("Captura ubicacion GPS antes de enviar.");
      return;
    }

    const sanitizedDescription = description.trim();
    if (sanitizedDescription.length < 5 || sanitizedDescription.length > 280) {
      setSubmitError("La descripcion debe tener entre 5 y 280 caracteres.");
      return;
    }

    const formData = new FormData();
    const sanitizedTitle = reportTitle.trim();
    if (sanitizedTitle) {
      formData.append("title", sanitizedTitle);
    }
    formData.append("description", sanitizedDescription);
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
      // The backend derives the mode from the session cookie, not from a header.
      const response = await createReport(formData, turnstileToken);
      const prefix = mode === "ANONYMOUS" ? "Reporte anonimo enviado" : "Incidencia enviada";
      setSubmitSuccess(
        `${prefix} (${response.incident_id.slice(0, 8)}). Estado IA: ${response.ai_status}`,
      );
      setDescription("");
      setReportTitle("");
      setPhoto(null);
      setCommunityConsent(false);
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 401) {
        handleLogout();
        setSubmitError("Tu sesion expiro o el token es invalido. Inicia sesion nuevamente.");
        return;
      }
      setSubmitError(error instanceof Error ? error.message : "No se pudo enviar el reporte");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--line)] bg-emerald-50/70 p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-900">¿Cómo quieres enviar el reporte?</p>
            <p className="mt-1 text-xs text-slate-600">
              Con una cuenta podrás consultar su avance; el reporte anónimo no permite seguimiento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("ANONYMOUS");
                setCommunityConsent(false);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "ANONYMOUS"
                  ? "bg-emerald-700 text-white"
                  : "border border-emerald-200 bg-white text-emerald-800"
              }`}
            >
              Reportar anónimamente
            </button>
            <button
              type="button"
              onClick={() => setMode("AUTHENTICATED")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "AUTHENTICATED"
                  ? "bg-emerald-700 text-white"
                  : "border border-emerald-200 bg-white text-emerald-800"
              }`}
            >
              Usar mi cuenta
            </button>
          </div>
        </div>

        {mode === "AUTHENTICATED" && !token ? (
          <form
            className="mb-5 grid gap-4 rounded-2xl border border-[var(--line)] p-4"
            onSubmit={authTab === "LOGIN" ? handleLogin : handleRegister}
          >
            <h2 className="font-heading text-lg font-semibold text-emerald-900">Acceso Campus</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Inicia sesion o crea tu cuenta para asociar el reporte a tu identidad.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthTab("LOGIN")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  authTab === "LOGIN"
                    ? "bg-emerald-700 text-white"
                    : "border border-[var(--line)] text-emerald-800"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthTab("REGISTER")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  authTab === "REGISTER"
                    ? "bg-emerald-700 text-white"
                    : "border border-[var(--line)] text-emerald-800"
                }`}
              >
                Crear cuenta
              </button>
            </div>
            <label className="grid gap-1 text-sm">
              Codigo campus
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                value={campusId}
                onChange={(e) => setCampusId(e.target.value)}
                placeholder="u20260001"
                required
              />
            </label>
            {authTab === "REGISTER" ? (
              <>
                <label className="grid gap-1 text-sm">
                  Nombre completo
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Correo
                  <input
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-1 text-sm">
              Contrasena
              <input
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
              />
            </label>
            {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
            <button
              disabled={authLoading}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {authLoading
                ? authTab === "LOGIN"
                  ? "Validando..."
                  : "Creando cuenta..."
                : authTab === "LOGIN"
                  ? "Ingresar"
                  : "Crear cuenta"}
            </button>
          </form>
        ) : null}

        {mode === "AUTHENTICATED" && token ? (
          <div className="mb-5 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-emerald-50/40 p-3">
            <p className="text-sm text-emerald-900">
              Sesion activa: <strong>{campusIdStored ?? "usuario"}</strong>
              {role ? ` (${role})` : ""}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Cerrar sesion
            </button>
          </div>
        ) : null}

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">1. Cuéntanos qué ocurrió</p>
              <p className="mt-1 text-xs text-slate-500">
                Incluye qué observaste y una referencia fácil de reconocer.
              </p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium text-slate-800">
              Título <span className="font-normal text-slate-500">(opcional)</span>
              <input
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                maxLength={120}
                placeholder="Ejemplo: Cable expuesto en el pabellón B"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-800">
              Categoría
              <select
                className="rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
                value={category}
                onChange={(event) => setCategory(event.target.value as IncidentCategory)}
              >
                <option value="INFRASTRUCTURE">Infraestructura</option>
                <option value="SECURITY">Seguridad</option>
                <option value="CLEANING">Limpieza</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-800">
              Descripción
              <textarea
                className="min-h-32 rounded-xl border border-[var(--line)] px-3 py-2.5 font-normal outline-none focus:border-emerald-600"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={280}
                placeholder="Ejemplo: La luminaria está caída junto a la entrada principal y bloquea parte del paso."
                required
              />
              <span className="text-right text-xs font-normal text-slate-500">
                {description.length}/280 caracteres
              </span>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <div>
              <p className="text-sm font-semibold text-emerald-900">2. Adjunta una foto</p>
              <p className="mt-1 text-xs text-slate-600">
                Procura que el problema se vea con claridad y evita fotografiar rostros.
              </p>
            </div>
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
                setReportTitle("");
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl bg-[var(--warning)] px-5 py-4 text-base font-bold text-white hover:brightness-95"
            >
              Tomar o seleccionar foto
            </button>
            {photo ? (
              <p className="text-xs text-slate-600">Archivo: {photo.name}</p>
            ) : (
              <p className="text-xs text-slate-600">Todavía no seleccionaste una foto.</p>
            )}
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa de evidencia"
                className="h-56 w-full rounded-xl border border-[var(--line)] object-cover"
              />
            ) : null}
            <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              La evidencia se revisará después del envío. No necesitas esperar en esta pantalla.
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <div>
              <p className="text-sm font-semibold text-amber-900">3. Confirma la ubicación</p>
              <p className="mt-1 text-xs text-slate-600">
                Usaremos tu posición únicamente para ubicar la incidencia dentro del campus.
              </p>
            </div>
            <button
              type="button"
              onClick={requestLocation}
              className="rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700"
              disabled={locationLoading}
            >
              {locationLoading ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
            </button>
            {coordinates ? (
              <p className="rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-emerald-800">
                Ubicación capturada correctamente
                {coordinates.accuracy ? ` · precisión aproximada ${coordinates.accuracy.toFixed(0)} m` : ""}
              </p>
            ) : null}
            {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
          </div>

          {mode === "AUTHENTICATED" && token ? (
            <div className="grid gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div>
                <p className="text-sm font-semibold text-sky-950">4. Privacidad del reporte</p>
                <p className="mt-1 text-xs text-slate-600">
                  El reporte es privado de forma predeterminada.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-emerald-950">
                <input
                  type="checkbox"
                  checked={communityConsent}
                  onChange={(event) => setCommunityConsent(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-700"
                />
                <span>
                  <strong className="block">Compartir anónimamente en Comunidad</strong>
                  Podrá aparecer sin tu identidad después de una revisión automática. Puedes retirarlo desde Mis reportes.
                </span>
              </label>
            </div>
          ) : null}

          {mode === "ANONYMOUS" ? <TurnstileWidget onToken={setTurnstileToken} /> : null}

          {submitError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {submitSuccess}
            </p>
          ) : null}

          <button
            disabled={submitLoading}
            className="rounded-2xl bg-emerald-700 px-5 py-4 text-base font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitLoading ? "Enviando reporte..." : "Enviar reporte"}
          </button>
        </form>
      </section>

    </div>
  );
}
