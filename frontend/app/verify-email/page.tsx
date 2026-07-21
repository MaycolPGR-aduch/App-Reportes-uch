"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
      <form onSubmit={submit} className="grid w-full gap-4 rounded-2xl border border-[var(--line)] bg-white p-6">
        <h1 className="font-heading text-2xl font-bold text-emerald-950">Verificar cuenta</h1>
        <p className="text-sm text-slate-600">Confirma tu correo institucional para activar el acceso.</p>
        {!token ? <p className="text-sm text-red-700">El enlace es inválido o está incompleto.</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button disabled={!token || loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {loading ? "Verificando..." : "Verificar correo"}
        </button>
        <Link href="/" className="text-sm font-semibold text-emerald-800">Volver al inicio</Link>
      </form>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyEmailForm /></Suspense>;
}
