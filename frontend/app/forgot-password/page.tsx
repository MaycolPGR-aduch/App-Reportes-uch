"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { requestPasswordReset } from "@/lib/api-client";
import { Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      // El servidor responde lo mismo exista o no la cuenta, para no revelar
      // qué correos están registrados. El aviso de aquí respeta esa reserva.
      setNotice(
        "Si el correo está registrado, recibirás un enlace para restablecer tu " +
          "contraseña. Revisa también la carpeta de no deseados.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      kicker="Acceso Campus"
      title="Recupera tu contraseña"
      subtitle="Escribe tu correo institucional y te enviaremos un enlace para cambiarla."
      error={error}
      notice={notice}
      loading={loading}
      disabled={Boolean(notice)}
      submitLabel="Enviar enlace"
      loadingLabel="Enviando..."
      onSubmit={handleSubmit}
      footer={
        <>
          <Link className="font-semibold text-brand-text hover:underline" href="/login">
            Volver al inicio de sesión
          </Link>
          <span className="text-subtle">Si no llega, escribe al administrador del campus.</span>
        </>
      }
    >
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
    </AuthCard>
  );
}
