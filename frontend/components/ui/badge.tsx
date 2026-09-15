import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { cx } from "./cx";

/*
 * Cada tono es un trío de variables (fondo, texto, borde) que ya viene
 * resuelto para tema claro y oscuro. La insignia no elige colores: elige tono.
 */
const toneStyles: Record<Tone, string> = {
  neutral: "bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral-fg)] border-[var(--tone-neutral-border)]",
  brand: "bg-[var(--tone-brand-bg)] text-[var(--tone-brand-fg)] border-[var(--tone-brand-border)]",
  info: "bg-[var(--tone-info-bg)] text-[var(--tone-info-fg)] border-[var(--tone-info-border)]",
  success: "bg-[var(--tone-success-bg)] text-[var(--tone-success-fg)] border-[var(--tone-success-border)]",
  warning: "bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)] border-[var(--tone-warning-border)]",
  danger: "bg-[var(--tone-danger-bg)] text-[var(--tone-danger-fg)] border-[var(--tone-danger-border)]",
  violet: "bg-[var(--tone-violet-bg)] text-[var(--tone-violet-fg)] border-[var(--tone-violet-border)]",
  indigo: "bg-[var(--tone-indigo-bg)] text-[var(--tone-indigo-fg)] border-[var(--tone-indigo-border)]",
  teal: "bg-[var(--tone-teal-bg)] text-[var(--tone-teal-fg)] border-[var(--tone-teal-border)]",
};

const dotStyles: Record<Tone, string> = {
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

type Props = {
  tone?: Tone;
  children: ReactNode;
  /**
   * Añade un punto de color. El texto ya dice el estado, así que el punto es
   * refuerzo, no el único portador del significado.
   */
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function Badge({ tone = "neutral", children, dot = false, size = "sm", className }: Props) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs",
        toneStyles[tone],
        className,
      )}
    >
      {dot ? <span className={cx("size-1.5 rounded-full", dotStyles[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Cuadrito de color para las leyendas de los gráficos. */
export function ToneSwatch({ tone }: { tone: Tone }) {
  return <span className={cx("size-2.5 rounded-sm", dotStyles[tone])} aria-hidden="true" />;
}

export { dotStyles as toneSolidClasses };
