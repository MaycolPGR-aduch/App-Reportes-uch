"use client";

import type { Serie } from "./chart-frame";
import { cx } from "@/components/ui";

/**
 * Una sola barra repartida entre los tramos de un conjunto.
 *
 * Sustituye al donut: comparar longitudes sobre una recta común es más fácil
 * que comparar ángulos, y aquí lo que se pregunta es «cuánto pesa cada estado
 * sobre el total». Los tramos se separan con 2px del fondo para que dos
 * colores contiguos no se lean como uno solo.
 */
export function CompositionBar({
  series,
  total,
  className,
}: {
  series: Serie[];
  total: number;
  className?: string;
}) {
  if (total <= 0) {
    return (
      <p className={cx("py-6 text-center text-xs text-muted", className)}>
        Sin incidencias en el periodo.
      </p>
    );
  }

  const visible = series.filter((item) => item.value > 0);

  return (
    <div className={cx("grid gap-2", className)}>
      <div className="flex h-3 gap-0.5" role="presentation">
        {visible.map((item) => (
          <div
            key={item.key}
            title={`${item.label}: ${item.value}`}
            className={cx(
              "h-full first:rounded-l-full last:rounded-r-full",
              item.textured && "bg-[image:repeating-linear-gradient(45deg,var(--tone-neutral-solid)_0_2px,var(--tone-neutral-bg)_2px_6px)]",
            )}
            style={{
              flexGrow: item.value,
              flexBasis: 0,
              backgroundColor: item.textured ? undefined : `var(--tone-${item.tone}-solid)`,
            }}
          />
        ))}
      </div>

      {/* Etiqueta directa de los tramos: la cifra no se deduce del color. */}
      <ul className="grid gap-1">
        {series.map((item) => (
          <li key={item.key} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-body">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-ink">{item.value}</span>{" "}
              ({Math.round((item.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
