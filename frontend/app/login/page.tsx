"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { login } from "@/lib/api-client";
import { rutaDeRetornoSegura } from "@/lib/next-url";

function LoginForm() {
  const router = useRouter();
  const next = rutaDeRetornoSegura(useSearchParams().get("next"));
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await login(campusId.trim(), password);
      setPassword("");
      if (next) {
        router.push(next);
        return;
      }
      // Sin destino explícito, cada rol tiene el suyo.
      if (response.role === "STAFF") router.push("/dashboard/staff");
      else if (response.role === "ADMIN") router.push("/dashboard/admin");
      else router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
      setLoading(false);
    }
  };

  const consulta = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <AuthCard
      kicker="Acceso Campus"
      title="Inicia sesión"
      subtitle="Ingresa con tu código campus para reportar y gestionar incidencias."
      error={error}
      loading={loading}
      submitLabel="Entrar"
      loadingLabel="Ingresando..."
      onSubmit={handleSubmit}
      footer={
        <>
          <Link className="font-semibold text-brand-text hover:underline" href={`/register${consulta}`}>
            Crear cuenta
          </Link>
          <Link className="font-semibold text-brand-text hover:underline" href="/forgot-password">
            Olvidé mi contraseña
          </Link>
        </>
      }
    >
      <Field label="Código campus">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={campusId}
            onChange={(e) => setCampusId(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            minLength={8}
            required
          />
        )}
      </Field>
    </AuthCard>
  );
}

export default function LoginPage() {
  // `useSearchParams` obliga a un limite de Suspense para poder prerenderizar.
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center p-8" />}>
      <LoginForm />
    </Suspense>
  );
}
