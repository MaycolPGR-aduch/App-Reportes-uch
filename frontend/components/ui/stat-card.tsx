import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { cx } from "./cx";
import { Skeleton } from "./skeleton";

const accents: Record<Tone, string> = {
  neutral: "bg-[var(--tone-neutral-solid)]",
  brand: "bg-[var(--tone-brand-solid)]",
  info: "bg-[var(--tone-info-solid)]",
  success: "bg-[var(--tone-success-solid)]",
  warning: "bg-[var(--tone-warning-solid)]",
  danger: "bg-[var(--tone-danger-solid)]",
  violet: "bg-[var(--tone-violet-solid)]",
  indigo: "bg-[var(--tone-indigo-solid)]",
  teal: "bg-[var(--tone-teal-solid)]",
};

/**
 * Cifra destacada. Vivía duplicada en el panel de admin y en el de staff,
 * con dos aspectos distintos para el mismo dato.
 *
 * La franja de color de la izquierda es la única señal de tono: pintar el
 * número entero de rojo hace que un cero también grite.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  loading = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cx(
        "relative overflow-hidden rounded-card border border-line bg-card px-4 py-3.5 shadow-card",
        className,
      )}
    >
      <span className={cx("absolute inset-y-0 left-0 w-1", accents[tone])} aria-hidden="true" />
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-14" />
      ) : (
        <p className="mt-1 font-display text-2xl font-bold leading-tight text-ink">{value}</p>
      )}
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}
