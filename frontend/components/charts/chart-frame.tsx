"use client";

import { ReactNode, useId, useState } from "react";
import type { Tone } from "@/lib/labels";
import { ToneSwatch, cx } from "@/components/ui";

export type Serie = {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  /* Trama diagonal en lugar de color plano. Se reserva para el tramo que debe
     leerse como «inactivo» y cuyo gris no llega a la cromía mínima exigida:
     la trama es la codificación secundaria que lo sustituye. */
  textured?: boolean;
};

/**
 * Marco común de los gráficos: título, leyenda y la misma tabla en texto.
 *
 * La tabla no es un extra: la paleta clara tiene tonos por debajo de 3:1 de
 * contraste contra el fondo, y la norma que seguimos exige, en ese caso,
 * ofrecer los valores en texto además de en color.
 */
export function ChartFrame({
  title,
  description,
  series,
  total,
  unit,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Alimenta la leyenda y la tabla. Con una sola serie no se dibuja leyenda. */
  series?: Serie[];
  total?: number;
  unit?: string;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const hasLegend = (series?.length ?? 0) >= 2;

  return (
    <figure className={cx("m-0 grid gap-3", className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        {series?.length ? (
          <button
            type="button"
            onClick={() => setShowTable((open) => !open)}
            aria-expanded={showTable}
            aria-controls={tableId}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-muted underline decoration-dotted underline-offset-2 hover:text-brand-text"
          >
            {showTable ? "Ocultar tabla" : "Ver tabla"}
          </button>
        ) : null}
      </figcaption>

      {children}

      {hasLegend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {series?.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted">
              <ToneSwatch tone={item.tone} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      {showTable && series?.length ? (
        <table id={tableId} className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 text-left font-medium text-muted">
                Serie
              </th>
              <th scope="col" className="py-1.5 text-right font-medium text-muted">
                {unit ?? "Valor"}
              </th>
              {total ? (
                <th scope="col" className="py-1.5 text-right font-medium text-muted">
                  %
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {series.map((item) => (
              <tr key={item.key} className="border-b border-line-subtle last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal text-body">
                  {item.label}
                </th>
                <td className="py-1.5 text-right tabular-nums text-ink">{item.value}</td>
                {total ? (
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {total > 0 ? Math.round((item.value / total) * 100) : 0}%
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}

/** Trama a 45° para el tramo sin color propio. Se declara una vez por gráfico. */
export function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="var(--tone-neutral-bg)" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--tone-neutral-solid)" strokeWidth="2.5" />
    </pattern>
  );
}

/** El color plano del tono, o la trama si la serie la pide. */
export function serieFill(item: Serie, hatchId: string): string {
  return item.textured ? `url(#${hatchId})` : `var(--tone-${item.tone}-solid)`;
}
