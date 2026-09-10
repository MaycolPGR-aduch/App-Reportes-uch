import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Estado vacío: dice qué falta y qué hacer al respecto.
 *
 * Un vacío no siempre es un problema —«no tienes tareas vencidas» es una
 * buena noticia—, de ahí que el texto de acción sea opcional.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid justify-items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center",
        className,
      )}
    >
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
