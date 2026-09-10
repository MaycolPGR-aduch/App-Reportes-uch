import type { ReactNode } from "react";
import { cx } from "./cx";

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "form";
}) {
  return (
    <Tag className={cx("rounded-card border border-line bg-card shadow-card", className)}>
      {children}
    </Tag>
  );
}

/**
 * Cabecera de tarjeta: título a la izquierda, acciones a la derecha.
 * Las acciones bajan a su propia línea antes de aplastar el título.
 */
export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("p-4", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("border-t border-line-subtle px-4 py-3", className)}>{children}</div>
  );
}
