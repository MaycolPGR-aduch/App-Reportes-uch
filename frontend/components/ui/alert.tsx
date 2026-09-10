import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { cx } from "./cx";

const toneStyles: Record<Tone, string> = {
  neutral: "border-[var(--tone-neutral-border)] bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-fg)]",
  brand: "border-[var(--tone-brand-border)] bg-[var(--tone-brand-bg)] text-[var(--tone-brand-fg)]",
  info: "border-[var(--tone-info-border)] bg-[var(--tone-info-bg)] text-[var(--tone-info-fg)]",
  success: "border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)]",
  warning: "border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]",
  danger: "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)]",
  violet: "border-[var(--tone-violet-border)] bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)]",
  indigo: "border-[var(--tone-indigo-border)] bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo-fg)]",
  teal: "border-[var(--tone-teal-border)] bg-[var(--tone-teal-bg)] text-[var(--tone-teal-fg)]",
};

/**
 * Mensaje de resultado de una acción.
 *
 * `danger` se anuncia con `role="alert"` (interrumpe al lector de pantalla)
 * y el resto con `role="status"` (espera a que termine la frase en curso):
 * un fallo merece la interrupción, un «guardado» no.
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
        toneStyles[tone],
        className,
      )}
    >
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cx(title ? "mt-0.5" : undefined, "text-[0.82rem]")}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}
