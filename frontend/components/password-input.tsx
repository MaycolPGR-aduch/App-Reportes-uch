"use client";

import { InputHTMLAttributes, useId, useState } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Clases del input. El botón se posiciona sobre él sin alterar el diseño. */
  className?: string;
};

/**
 * Campo de contraseña con alternador de visibilidad.
 *
 * El botón es `type="button"`: dentro de un formulario, un botón sin tipo
 * explícito envía el formulario al pulsarlo, que aquí sería justo lo contrario
 * de lo que espera quien solo quiere comprobar lo que escribió.
 */
export function PasswordInput({ className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const descripcionId = useId();

  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        // `w-full`: antes el input era hijo directo de un contenedor grid y se
        // estiraba solo; dentro del envoltorio encoge a su anchura intrínseca y
        // el botón quedaría fuera del recuadro.
        // El relleno derecho va en línea porque las clases del proyecto usan la
        // forma abreviada `padding`, que ganaría a una utilidad `pr-*`.
        className={`${className} w-full`}
        style={{ paddingRight: "2.5rem", ...(props.style ?? {}) }}
        aria-describedby={descripcionId}
      />
      <button
        type="button"
        onClick={() => setVisible((actual) => !actual)}
        // Se anuncia la acción, no el estado: es lo que ocurrirá al pulsar.
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-emerald-800"
      >
        {visible ? (
          // Ojo tachado: la contraseña está a la vista y pulsar la oculta.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .9-.5 2-1.4 3.1M6.2 6.9C4 8.3 3 10.3 3 12c0 2.5 4 7 9 7 1.6 0 3-.4 4.2-1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
      <span id={descripcionId} className="sr-only">
        La contraseña está {visible ? "visible" : "oculta"}.
      </span>
    </span>
  );
}
