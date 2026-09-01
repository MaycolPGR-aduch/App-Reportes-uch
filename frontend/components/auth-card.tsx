"use client";

import { FormEvent, ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  subtitle: string;
  /** Mensaje de error, en rojo. */
  error?: string | null;
  /** Mensaje informativo o de éxito, en verde. */
  notice?: string | null;
  submitLabel: string;
  loadingLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  /** Enlaces al pie: registro, recuperación, volver. */
  footer?: ReactNode;
};

/**
 * Marco de las pantallas de acceso.
 *
 * El mismo recuadro estaba escrito dos veces —en `report-form.tsx` y en el
 * panel— y ya había divergido. Aquí vive una sola vez, conservando las clases
 * `admin-login-*` que definen su aspecto en `globals.css`.
 */
export function AuthCard({
  kicker,
  title,
  subtitle,
  error,
  notice,
  submitLabel,
  loadingLabel,
  loading = false,
  disabled = false,
  onSubmit,
  children,
  footer,
}: Props) {
  return (
    <main className="admin-login-stage mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-8 sm:px-6">
      <div className="admin-login-frame">
        <div className="admin-login-border" />
        <form className="admin-login-card" onSubmit={onSubmit}>
          <div className="space-y-1">
            <p className="admin-login-kicker">{kicker}</p>
            <h1 className="font-heading text-2xl font-semibold leading-tight text-emerald-950">
              {title}
            </h1>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>

          {children}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-800"
            >
              {notice}
            </p>
          ) : null}

          <button disabled={loading || disabled} className="admin-login-submit">
            {loading ? loadingLabel : submitLabel}
          </button>

          {footer ? (
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
              {footer}
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}
