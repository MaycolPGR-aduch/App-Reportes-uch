"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { confirmPasswordReset } from "@/lib/api-client";

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
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-12">
      <form onSubmit={submit} className="grid w-full gap-4 rounded-2xl border border-[var(--line)] bg-white p-6">
        <h1 className="font-heading text-2xl font-bold text-emerald-950">Restablecer contraseña</h1>
        <input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-[var(--line)] px-3 py-2" placeholder="Nueva contraseña" />
        {!token ? <p className="text-sm text-red-700">El enlace es inválido o está incompleto.</p> : null}
        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button disabled={!token || loading} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-800">Ir al login</Link>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
