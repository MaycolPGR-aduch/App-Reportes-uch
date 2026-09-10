"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { PasswordInput } from "@/components/password-input";
import { confirmPasswordReset } from "@/lib/api-client";
import { Field } from "@/components/ui";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setMessage((await confirmPasswordReset(token, password)).message);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      kicker="Acceso Campus"
      title="Restablecer contraseña"
      subtitle="Elige una contraseña nueva para tu cuenta."
      // Un enlace roto es un error de entrada, no un fallo del envío: se avisa
      // antes de que nadie escriba una contraseña que no se va a poder guardar.
      error={!token ? "El enlace es inválido o está incompleto." : error}
      notice={message}
      loading={loading}
      disabled={!token || Boolean(message)}
      submitLabel="Actualizar contraseña"
      loadingLabel="Actualizando..."
      onSubmit={submit}
      footer={
        <Link href="/login" className="font-semibold text-brand-text hover:underline">
          Ir al inicio de sesión
        </Link>
      }
    >
      <Field label="Nueva contraseña" hint="Al menos 8 caracteres.">
        {({ id, describedBy }) => (
          <PasswordInput
            id={id}
            aria-describedby={describedBy}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        )}
      </Field>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center p-8" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
