"use client";

import type { Tone } from "@/lib/labels";
import { cx } from "@/components/ui";

export type BarItem = {
  key: string;
  label: string;
  value: number;
  tone?: Tone;
  /** Segunda línea bajo la etiqueta, p. ej. el área de un responsable. */
  detail?: string;
};

/**
 * Barras horizontales para comparar magnitudes con nombre.
 *
 * Horizontales y no verticales porque las etiquetas son texto de longitud
 * dispar —nombres de zona, de personal— y en vertical habría que girarlas.
 * Cada barra lleva su cifra al lado: el valor nunca depende de medir el largo
 * contra un eje.
 */
export function BarList({
  items,
  tone = "brand",
  max,
  emptyLabel = "Sin datos todavía.",
  className,
}: {
  items: BarItem[];
  /** Tono por defecto cuando el elemento no trae el suyo. */
  tone?: Tone;
  /** Escala fija. Si se omite, la barra mayor ocupa el ancho completo. */
  max?: number;
  emptyLabel?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className={cx("py-6 text-center text-xs text-muted", className)}>{emptyLabel}</p>;
  }

  const scale = max ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className={cx("grid gap-2.5", className)}>
      {items.map((item) => {
        // Un valor distinto de cero nunca se dibuja como nada: por debajo del
        // 1.5% la barra dejaría de verse y parecería un cero.
        const ratio = scale > 0 ? item.value / scale : 0;
        const width = item.value > 0 ? Math.max(ratio * 100, 1.5) : 0;
        return (
          <li key={item.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-body" title={item.label}>
                {item.label}
                {item.detail ? <span className="text-subtle"> · {item.detail}</span> : null}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">
                {item.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  backgroundColor: `var(--tone-${item.tone ?? tone}-solid)`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
