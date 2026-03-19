"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IncidentCategory, UserRole, createReport, login, registerUser } from "@/lib/api-client";

const TOKEN_KEY = "campus_access_token";
const ROLE_KEY = "campus_user_role";
const CAMPUS_ID_KEY = "campus_user_id";

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
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedRole = window.localStorage.getItem(ROLE_KEY) as UserRole | null;
    const storedCampusId = window.localStorage.getItem(CAMPUS_ID_KEY);

    if (storedToken) {
      setToken(storedToken);
      setRole(storedRole);
      setCampusIdStored(storedCampusId);
      setMode("AUTHENTICATED");
    }
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
      window.localStorage.setItem(TOKEN_KEY, response.access_token);
      window.localStorage.setItem(ROLE_KEY, response.role);
      window.localStorage.setItem(CAMPUS_ID_KEY, response.campus_id);
      setToken(response.access_token);
      setRole(response.role);
      setCampusIdStored(response.campus_id);
      setPassword("");
      setMode("AUTHENTICATED");
      setSubmitSuccess("Sesion iniciada. Puedes reportar inmediatamente.");

      if (response.role === "ADMIN") {
        router.push("/dashboard");
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
      window.localStorage.setItem(TOKEN_KEY, response.access_token);
      window.localStorage.setItem(ROLE_KEY, response.role);
      window.localStorage.setItem(CAMPUS_ID_KEY, response.campus_id);
      setToken(response.access_token);
      setRole(response.role);
      setCampusIdStored(response.campus_id);
      setPassword("");
      setSubmitSuccess("Cuenta creada correctamente. Ya puedes reportar.");
      setMode("AUTHENTICATED");
      router.push("/");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(CAMPUS_ID_KEY);
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
    formData.append("description", sanitizedDescription);
    formData.append("category", category);
    formData.append("latitude", String(coordinates.latitude));
    formData.append("longitude", String(coordinates.longitude));
    if (coordinates.accuracy != null) {
      formData.append("accuracy_m", String(coordinates.accuracy));
    }
    formData.append("photo", photo);

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const authToken = mode === "AUTHENTICATED" ? token : null;
      const response = await createReport(authToken, formData);
      const prefix = mode === "ANONYMOUS" ? "Reporte anonimo enviado" : "Incidencia enviada";
      setSubmitSuccess(
        `${prefix} (${response.incident_id.slice(0, 8)}). Estado IA: ${response.ai_status}`,
      );
      setDescription("");
      setPhoto(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo enviar el reporte");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm sm:p-8">
        <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--line)] bg-emerald-50/70 p-4">
          <p className="text-sm font-semibold text-emerald-900">Modo de reporte</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("ANONYMOUS")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                mode === "ANONYMOUS"
                  ? "bg-emerald-700 text-white"
                  : "border border-emerald-200 bg-white text-emerald-800"
              }`}
            >
              Anonimo (sin login)
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
              Con cuenta campus
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
                className="rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-emerald-600"
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
                    className="rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-emerald-600"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Correo
                  <input
                    className="rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-emerald-600"
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
                className="rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-emerald-600"
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
              className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
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
          <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-sm font-semibold text-emerald-900">1. Evidencia fotografica</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl bg-[var(--warning)] px-5 py-4 text-base font-bold text-white hover:brightness-95"
            >
              Tomar / Adjuntar foto
            </button>
            {photo ? (
              <p className="text-xs text-slate-600">Archivo: {photo.name}</p>
            ) : (
              <p className="text-xs text-slate-600">Sin foto seleccionada.</p>
            )}
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa de evidencia"
                className="h-56 w-full rounded-xl border border-[var(--line)] object-cover"
              />
            ) : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <p className="text-sm font-semibold text-amber-900">2. Ubicacion GPS</p>
            <button
              type="button"
              onClick={requestLocation}
              className="rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700"
              disabled={locationLoading}
            >
              {locationLoading ? "Obteniendo ubicacion..." : "Capturar ubicacion actual"}
            </button>
            {coordinates ? (
              <p className="font-mono text-xs text-slate-700">
                lat {coordinates.latitude.toFixed(6)} | lon {coordinates.longitude.toFixed(6)} | acc{" "}
                {coordinates.accuracy ? `${coordinates.accuracy.toFixed(1)}m` : "N/A"}
              </p>
            ) : null}
            {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-[var(--line)] p-4">
            <p className="text-sm font-semibold text-slate-900">3. Descripcion breve</p>
            <label className="grid gap-1 text-sm">
              Categoria
              <select
                className="rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-emerald-600"
                value={category}
                onChange={(event) => setCategory(event.target.value as IncidentCategory)}
              >
                <option value="INFRASTRUCTURE">Infraestructura</option>
                <option value="SECURITY">Seguridad</option>
                <option value="CLEANING">Limpieza</option>
              </select>
            </label>
            <textarea
              className="min-h-28 rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-emerald-600"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              placeholder="Ejemplo: luminaria caida frente al pabellon B."
              required
            />
          </div>

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
            {submitLoading ? "Enviando reporte..." : "Enviar incidencia"}
          </button>
        </form>
      </section>

      <aside className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold text-emerald-900">Flujo MVP</h3>
        <ol className="mt-3 grid gap-3 text-sm text-[var(--text-muted)]">
          <li>1. Modo anonimo o con cuenta segun contexto.</li>
          <li>2. El reporte entra por API unica con evidencia + GPS.</li>
          <li>3. Se guarda transaccionalmente en PostgreSQL.</li>
          <li>4. Se encola clasificacion IA y alertas por correo.</li>
        </ol>
      </aside>
    </div>
  );
}
