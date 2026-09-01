"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { requestPasswordReset } from "@/lib/api-client";

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
      // que correos estan registrados. El aviso de aqui respeta esa reserva.
      setNotice(
        "Si el correo esta registrado, recibiras un enlace para restablecer tu " +
          "contrasena. Revisa tambien la carpeta de no deseados.",
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
      title="Recupera tu contrasena"
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
          <Link className="font-semibold text-emerald-800 hover:underline" href="/login">
            Volver al inicio de sesion
          </Link>
          <span className="text-slate-500">
            Si no llega, escribe al administrador del campus.
          </span>
        </>
      }
    >
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
    </AuthCard>
  );
}
