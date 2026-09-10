"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";

/*
 * Tabla con filas seleccionables.
 *
 * Las tablas del panel usaban `<tr onClick>`: con el ratón funcionaba y con el
 * teclado la fila no existía. Aquí la celda que identifica la fila lleva un
 * `<button>` real, así que entra en el orden de tabulación, responde a Intro y
 * anuncia cuál está seleccionada mediante `aria-selected` en la fila.
 */

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Contenido de la celda. */
  cell: (row: T) => ReactNode;
  /** Alineación a la derecha para columnas numéricas. */
  numeric?: boolean;
  className?: string;
};

type Props<T> = {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Activa la selección de filas. Sin esta prop la tabla es sólo de lectura. */
  onSelect?: (row: T) => void;
  selectedKey?: string | null;
  /** Texto accesible del botón de cada fila, p. ej. «Ver a Ana Pérez». */
  rowLabel?: (row: T) => string;
  caption?: string;
  loading?: ReactNode;
  empty?: ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onSelect,
  selectedKey,
  rowLabel,
  caption,
  loading,
  empty,
  className,
}: Props<T>) {
  const showEmpty = !loading && rows.length === 0;

  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="bg-sunken">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  "px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted",
                  column.numeric ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading}
          {showEmpty ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-muted">
                {empty ?? "Sin resultados."}
              </td>
            </tr>
          ) : null}
          {!loading
            ? rows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    aria-selected={onSelect ? selected : undefined}
                    className={cx(
                      "border-t border-line-subtle transition-colors",
                      onSelect && "hover:bg-sunken",
                      selected && "bg-brand-soft hover:bg-brand-soft",
                    )}
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cx(
                          "px-3 py-2.5 align-top text-body",
                          column.numeric && "text-right tabular-nums",
                          column.className,
                        )}
                      >
                        {/* La primera columna es el asidero: sólo ella es
                            interactiva, para no meter una parada de tabulador
                            por cada celda de la tabla. */}
                        {index === 0 && onSelect ? (
                          <button
                            type="button"
                            onClick={() => onSelect(row)}
                            className="w-full rounded text-left font-medium text-ink hover:text-brand-text"
                          >
                            <span className="sr-only">{rowLabel?.(row) ?? "Seleccionar fila"}</span>
                            <span aria-hidden="true">{column.cell(row)}</span>
                          </button>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}
