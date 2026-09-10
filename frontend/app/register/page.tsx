"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { registerUser } from "@/lib/api-client";
import { rutaDeRetornoSegura } from "@/lib/next-url";
import { Field, Input } from "@/components/ui";

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
      subtitle="Necesitas un correo institucional. Reportar de forma anónima no requiere cuenta."
      error={error}
      notice={notice}
      loading={loading}
      disabled={Boolean(notice)}
      submitLabel="Crear cuenta"
      loadingLabel="Creando cuenta..."
      onSubmit={handleSubmit}
      footer={
        <>
          <Link className="font-semibold text-brand-text hover:underline" href={`/login${consulta}`}>
            Ya tengo cuenta
          </Link>
          <Link className="font-semibold text-brand-text hover:underline" href="/">
            Reportar sin cuenta
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
            placeholder="u20260001"
            autoComplete="username"
            required
          />
        )}
      </Field>

      <Field label="Nombre completo">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        )}
      </Field>

      <Field label="Correo institucional">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        )}
      </Field>

      <Field label="Contraseña" hint="Al menos 8 caracteres.">
        {({ id, describedBy }) => (
          <PasswordInput
            id={id}
            aria-describedby={describedBy}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        )}
      </Field>
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
