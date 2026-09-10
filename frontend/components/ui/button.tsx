import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand shadow-xs hover:bg-brand-hover",
  secondary: "border border-line bg-card text-body hover:border-line-strong hover:text-ink",
  ghost: "text-brand-text hover:bg-brand-soft",
  danger:
    "border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] " +
    "text-[var(--tone-danger-fg)] hover:border-[var(--tone-danger-solid)]",
  quiet: "bg-sunken text-body hover:text-ink",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-3.5 text-sm",
  lg: "h-12 px-5 text-base",
};

/**
 * Devuelve las clases sin renderizar nada, para dárselas a un `Link` de Next
 * que debe verse como botón pero seguir siendo un enlace.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(base, variants[variant], sizes[size], extra);
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra el disco giratorio y bloquea el botón sin cambiar su ancho. */
  loading?: boolean;
  /** Ocupa todo el ancho disponible. */
  block?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses(variant, size), block && "w-full", className)}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="size-3.5 shrink-0 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
