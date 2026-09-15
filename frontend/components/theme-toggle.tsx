"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";

type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "campus-alertas-theme";

/**
 * Script que corre antes del primer pintado.
 *
 * Sin él, quien tiene el tema oscuro elegido ve un fogonazo blanco en cada
 * carga: React todavía no ha montado nada cuando el navegador pinta el `body`.
 * Se inyecta en el `<head>` y por eso es una cadena y no un componente.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (error) {
    /* Modo privado o cookies bloqueadas: se queda con el tema del sistema. */
  }
})();
`;

const OPTIONS: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Tema claro", icon: <SunIcon /> },
  { value: "system", label: "Tema del sistema", icon: <SystemIcon /> },
  { value: "dark", label: "Tema oscuro", icon: <MoonIcon /> },
];

/* El tema vive en el atributo `data-theme` del <html>, que es un sistema
 * externo a React: lo escribe el script de arranque antes de que React exista
 * y puede cambiarlo cualquier pestaña. Por eso se lee con
 * `useSyncExternalStore` y no con estado propio sincronizado en un efecto:
 * así no hay un render inicial con el valor equivocado que corregir después.
 */
const EVENTO_TEMA = "campus-alertas:tema";

function subscribe(alCambiar: () => void) {
  window.addEventListener(EVENTO_TEMA, alCambiar);
  // Otra pestaña que cambie el tema escribe en el mismo almacenamiento.
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO_TEMA, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

function leerTema(): Theme {
  const valor = document.documentElement.getAttribute("data-theme");
  return valor === "light" || valor === "dark" ? valor : "system";
}

/** En el servidor no hay elección posible: siempre se pinta el del sistema. */
function leerTemaServidor(): Theme {
  return "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, leerTema, leerTemaServidor);

  const aplicar = (next: Theme) => {
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);

    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento la elección vale para esta pestaña, no se recuerda.
    }
    window.dispatchEvent(new Event(EVENTO_TEMA));
  };

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className="flex items-center gap-0.5 rounded-full border border-line bg-card p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => aplicar(option.value)}
            aria-pressed={active}
            title={option.label}
            className={cx(
              "grid size-7 place-items-center rounded-full transition-colors",
              active ? "bg-brand-soft text-brand-text" : "text-subtle hover:text-body",
            )}
          >
            <span className="sr-only">{option.label}</span>
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.4v1.7M10 15.9v1.7M17.6 10h-1.7M4.1 10H2.4M15.4 4.6l-1.2 1.2M5.8 14.2l-1.2 1.2M15.4 15.4l-1.2-1.2M5.8 5.8 4.6 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M16.3 11.7A6.8 6.8 0 0 1 8.3 3.7a6.9 6.9 0 1 0 8 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <rect x="2.6" y="4" width="14.8" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.2 16.8h5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
