import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("skeleton block", className)} />;
}

/**
 * Relleno de una tabla mientras llegan los datos.
 *
 * Ocupa el sitio de las filas reales para que la página no dé el salto que
 * daba con «Cargando...», que medía una línea y luego se convertía en veinte.
 */
/* Anchos dispares: una tabla real no tiene todas las celdas del mismo largo,
   y un esqueleto perfectamente alineado se lee como una tabla vacía. */
const CELL_WIDTHS = ["w-4/5", "w-3/5", "w-11/12", "w-2/5", "w-3/4", "w-1/2"];

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="border-t border-line-subtle">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td key={columnIndex} className="px-3 py-2.5">
              <Skeleton
                className={cx("h-3.5", CELL_WIDTHS[(rowIndex + columnIndex * 2) % CELL_WIDTHS.length])}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cx("rounded-card border border-line bg-card p-4", className)}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-16" />
        </div>
      ))}
    </>
  );
}
