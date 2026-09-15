"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { verifyEmail } from "@/lib/api-client";

function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setMessage((await verifyEmail(token)).message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo verificar el correo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      kicker="Acceso Campus"
      title="Verificar cuenta"
      subtitle="Confirma tu correo institucional para activar el acceso."
      error={!token ? "El enlace es inválido o está incompleto." : error}
      notice={message}
      loading={loading}
      disabled={!token || Boolean(message)}
      submitLabel="Verificar correo"
      loadingLabel="Verificando..."
      onSubmit={submit}
      footer={
        <>
          <Link href="/login" className="font-semibold text-brand-text hover:underline">
            Iniciar sesión
          </Link>
          <Link href="/" className="font-semibold text-brand-text hover:underline">
            Volver al inicio
          </Link>
        </>
      }
    >
      {/* La confirmación es explícita a propósito: algunos clientes de correo
          abren los enlaces por su cuenta para analizarlos, y una verificación
          automática se consumiría sola antes de que llegue la persona. */}
      <p className="text-sm text-muted">
        Pulsa el botón para confirmar que este correo es tuyo.
      </p>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center p-8" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
