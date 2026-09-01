"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { registerUser } from "@/lib/api-client";
import { rutaDeRetornoSegura } from "@/lib/next-url";

function RegisterForm() {
  const next = rutaDeRetornoSegura(useSearchParams().get("next"));
  const [campusId, setCampusId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const response = await registerUser({
        campus_id: campusId.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      setPassword("");
      // Se muestra el mensaje del servidor en vez de redirigir: dice si hay que
      // revisar el correo o esperar a que un administrador active la cuenta, y
      // esa diferencia importa.
      setNotice(response.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const consulta = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard
      kicker="Acceso Campus"
      title="Crea tu cuenta"
      subtitle="Necesitas un correo institucional. Reportar de forma anonima no requiere cuenta."
      error={error}
      notice={notice}
      loading={loading}
      disabled={Boolean(notice)}
      submitLabel="Crear cuenta"
      loadingLabel="Creando cuenta..."
      onSubmit={handleSubmit}
      footer={
        <>
          <Link className="font-semibold text-emerald-800 hover:underline" href={`/login${consulta}`}>
            Ya tengo cuenta
          </Link>
          <Link className="font-semibold text-emerald-800 hover:underline" href="/">
            Reportar sin cuenta
          </Link>
        </>
      }
    >
      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
        Codigo campus
        <input
          className="admin-login-input"
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
          placeholder="u20260001"
          autoComplete="username"
          required
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
        Nombre completo
        <input
          className="admin-login-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
        Correo institucional
        <input
          className="admin-login-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
        />
      </label>

      <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
        Contrasena
        <PasswordInput
          className="admin-login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center p-8" />}>
      <RegisterForm />
    </Suspense>
  );
}
