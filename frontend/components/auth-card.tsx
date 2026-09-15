"use client";

import { FormEvent, ReactNode } from "react";
import { Alert, Button } from "@/components/ui";

type Props = {
  kicker: string;
  title: string;
  subtitle: string;
  /** Mensaje de error. */
  error?: string | null;
  /** Mensaje informativo o de éxito. */
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
 * El mismo recuadro estaba escrito dos veces —en el formulario de reporte y en
 * el panel— y ya había divergido. Aquí vive una sola vez.
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
    <main className="auth-stage">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="grid gap-1">
          <p className="auth-kicker">{kicker}</p>
          <h1 className="font-display text-2xl font-bold leading-tight">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>

        {children}

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <Button type="submit" size="lg" block loading={loading} disabled={disabled}>
          {loading ? loadingLabel : submitLabel}
        </Button>

        {footer ? (
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted">{footer}</div>
        ) : null}
      </form>
    </main>
  );
}
