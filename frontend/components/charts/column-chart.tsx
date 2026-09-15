"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

export type ColumnPoint = {
  key: string;
  /** Etiqueta corta para el eje y el globo, p. ej. «14 sep». */
  label: string;
  value: number;
};

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 160;
const BASELINE = VIEW_HEIGHT - 18;
const TOP = 8;

/**
 * Columnas por día.
 *
 * Una sola serie, así que no lleva leyenda: el título ya dice qué se cuenta.
 * El eje horizontal sólo rotula el primero, el del medio y el último —con más
 * etiquetas se solapan en móvil— y el resto del detalle vive en el globo.
 */
export function ColumnChart({
  points,
  className,
}: {
  points: ColumnPoint[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className={cx("py-8 text-center text-xs text-muted", className)}>Sin datos.</p>;
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const slot = VIEW_WIDTH / points.length;
  const barWidth = Math.min(slot * 0.62, 26);
  const plotHeight = BASELINE - TOP;

  // Tres referencias horizontales bastan para situar la altura sin convertir
  // el fondo en una cuadrícula que compite con las propias columnas.
  // Con valores bajos el punto medio coincide con el máximo (max=1 da 1, 1, 0).
  // Sin deduplicar se dibujaban dos líneas superpuestas —una salía el doble de
  // gruesa— y React recibía dos hijos con la misma clave.
  const gridValues = [...new Set([max, Math.round(max / 2), 0])];
  const active = hovered !== null ? points[hovered] : null;

  return (
    <div className={cx("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Evolución diaria; máximo ${max} en un día. Los valores exactos están en la tabla.`}
        onMouseLeave={() => setHovered(null)}
      >
        {gridValues.map((value) => {
          const y = BASELINE - (value / max) * plotHeight;
          return (
            <line
              key={value}
              x1="0"
              x2={VIEW_WIDTH}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {points.map((point, index) => {
          const height = point.value > 0 ? Math.max((point.value / max) * plotHeight, 2) : 0;
          const x = index * slot + (slot - barWidth) / 2;
          return (
            <g key={point.key}>
              {height > 0 ? (
                <rect
                  x={x}
                  y={BASELINE - height}
                  width={barWidth}
                  height={height}
                  rx="3"
                  fill="var(--brand)"
                  opacity={hovered === null || hovered === index ? 1 : 0.45}
                />
              ) : null}
              {/* Zona sensible del ancho completo del hueco: apuntar a una
                  columna de dos píxeles sería imposible. */}
              <rect
                x={index * slot}
                y={0}
                width={slot}
                height={VIEW_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          );
        })}

        <line
          x1="0"
          x2={VIEW_WIDTH}
          y1={BASELINE}
          y2={BASELINE}
          stroke="var(--border-default)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="mt-1 flex justify-between text-[0.68rem] text-subtle">
        <span>{points[0].label}</span>
        {points.length > 2 ? <span>{points[Math.floor(points.length / 2)].label}</span> : null}
        {points.length > 1 ? <span>{points[points.length - 1].label}</span> : null}
      </div>

      {active ? (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-overlay px-2 py-1 text-xs shadow-md"
          style={{
            left: `${((hovered! + 0.5) / points.length) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold text-ink">{active.value}</span>{" "}
          <span className="text-muted">· {active.label}</span>
        </div>
      ) : null}
    </div>
  );
}
