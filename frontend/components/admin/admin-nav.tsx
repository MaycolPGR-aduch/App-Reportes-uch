"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export type SectionKey =
  | "OVERVIEW"
  | "INCIDENTS"
  | "ASSIGNMENTS"
  | "STAFF"
  | "ZONES"
  | "USERS"
  | "SOCIAL"
  | "SYSTEM";

type Item = { key: SectionKey; label: string; icon: ReactNode };

/*
 * Las secciones agrupadas por para qué se entra al panel: primero lo que se
 * mira a diario, luego lo que se configura de vez en cuando. Antes eran siete
 * botones iguales en una fila que en un portátil estrecho ya se partía.
 */
const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Operación",
    items: [
      { key: "OVERVIEW", label: "Resumen", icon: <IconChart /> },
      { key: "INCIDENTS", label: "Incidencias", icon: <IconList /> },
      { key: "ASSIGNMENTS", label: "Asignaciones", icon: <IconAssign /> },
      { key: "SOCIAL", label: "Comunidad", icon: <IconCommunity /> },
    ],
  },
  {
    title: "Configuración",
    items: [
      { key: "STAFF", label: "Personal", icon: <IconStaff /> },
      { key: "ZONES", label: "Zonas", icon: <IconMap /> },
      { key: "USERS", label: "Usuarios", icon: <IconUsers /> },
      { key: "SYSTEM", label: "Sistema", icon: <IconSystem /> },
    ],
  },
];

export function AdminNav({
  active,
  onChange,
  alerts,
}: {
  active: SectionKey;
  onChange: (key: SectionKey) => void;
  /** Contadores que merecen un aviso, p. ej. asignaciones fuera de plazo. */
  alerts?: Partial<Record<SectionKey, number>>;
}) {
  return (
    <nav aria-label="Secciones del panel" className="lg:sticky lg:top-16 lg:self-start">
      {/* En pantalla ancha es una columna; en móvil, una tira que se desplaza
          en horizontal sin robar alto al contenido. */}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
        {GROUPS.map((group) => (
          <div key={group.title} className="grid gap-1">
            <p className="hidden px-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-subtle lg:block">
              {group.title}
            </p>
            <ul className="flex gap-1 lg:grid">
              {group.items.map((item) => {
                const count = alerts?.[item.key] ?? 0;
                const selected = active === item.key;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onChange(item.key)}
                      aria-current={selected ? "page" : undefined}
                      className={cx(
                        "flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        selected
                          ? "bg-brand-soft text-brand-text"
                          : "text-muted hover:bg-sunken hover:text-ink",
                      )}
                    >
                      <span className={cx("shrink-0", selected ? "text-brand" : "text-subtle")}>
                        {item.icon}
                      </span>
                      {item.label}
                      {count > 0 ? (
                        <span className="ml-auto rounded-full bg-[var(--tone-danger-solid)] px-1.5 text-[0.65rem] font-bold text-white">
                          {count}
                          <span className="sr-only"> requieren atención</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

const iconProps = {
  viewBox: "0 0 20 20",
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconChart() {
  return (
    <svg {...iconProps}>
      <path d="M3 16.5V9M8 16.5V4M13 16.5v-5M18 16.5V7" />
    </svg>
  );
}
function IconList() {
  return (
    <svg {...iconProps}>
      <path d="M7 5.5h10M7 10h10M7 14.5h10M3.2 5.5h.01M3.2 10h.01M3.2 14.5h.01" />
    </svg>
  );
}
function IconAssign() {
  return (
    <svg {...iconProps}>
      <path d="M4 6.5h8M4 10h5M4 13.5h8" />
      <path d="M13.5 12.4 15.3 14l3-3.4" />
    </svg>
  );
}
function IconCommunity() {
  return (
    <svg {...iconProps}>
      <path d="M17 12.4a2 2 0 0 1-2 2H7.6L4 17.2V5.6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2Z" />
    </svg>
  );
}
function IconStaff() {
  return (
    <svg {...iconProps}>
      <circle cx="10" cy="7" r="2.9" />
      <path d="M4.3 16.4a5.8 5.8 0 0 1 11.4 0" />
    </svg>
  );
}
function IconMap() {
  return (
    <svg {...iconProps}>
      <path d="m3.2 5.6 4.4-1.8 4.8 1.8 4.4-1.8v10.6l-4.4 1.8-4.8-1.8-4.4 1.8Z" />
      <path d="M7.6 3.8v10.6M12.4 5.6v10.6" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="7.2" r="2.6" />
      <path d="M2.8 16a5.3 5.3 0 0 1 10.4 0" />
      <path d="M13.6 5.1a2.6 2.6 0 0 1 0 4.9M14.6 11.6a4.4 4.4 0 0 1 2.7 4" />
    </svg>
  );
}
function IconSystem() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4.2" width="14" height="5" rx="1.4" />
      <rect x="3" y="10.8" width="14" height="5" rx="1.4" />
      <path d="M6 6.7h.01M6 13.3h.01" />
    </svg>
  );
}
