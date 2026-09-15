"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { cx } from "./cx";

/*
 * Un control de formulario es siempre: etiqueta + control + ayuda o error.
 * `Field` cablea los tres con `id`, `aria-describedby` y `aria-invalid` para
 * que un lector de pantalla anuncie el error junto al campo y no suelto al
 * final del formulario, que es como estaba.
 */

const controlBase =
  "w-full rounded-lg border bg-card text-body placeholder:text-subtle " +
  "transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus-visible:outline-none " +
  "focus:border-brand focus:ring-2 focus:ring-[var(--brand-soft-hover)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const controlSize = "h-10 px-3 text-sm";

function stateClasses(invalid?: boolean) {
  return invalid ? "border-[var(--tone-danger-solid)]" : "border-line";
}

type FieldProps = {
  label: ReactNode;
  /** Texto de ayuda permanente bajo el campo. */
  hint?: ReactNode;
  error?: string | null;
  /** Marca visible junto a la etiqueta para campos que no son obligatorios. */
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1 font-normal text-subtle">(opcional)</span> : null}
      </label>
      {children({ id, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-[var(--tone-danger-fg)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ className, invalid, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(controlBase, controlSize, stateClasses(invalid), className)}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx(controlBase, controlSize, "pr-8", stateClasses(invalid), className)}
      {...rest}
    >
      {children}
    </select>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx(controlBase, "min-h-24 px-3 py-2.5 text-sm", stateClasses(invalid), className)}
      {...rest}
    />
  );
}

/** Casilla con su etiqueta: toda la fila es zona de clic. */
export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-2.5 text-sm text-body",
        rest.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
        {...rest}
      />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
