/**
 * Traducción de los enum del backend a lo que ve una persona.
 *
 * Antes cada pantalla resolvía esto por su cuenta: el feed de estudiante tenía
 * diccionarios, el panel de admin imprimía `IN_PROGRESS` en crudo y la vista de
 * staff mezclaba ambos. Aquí viven una sola vez, junto al tono de color con el
 * que se pintan, para que un estado signifique lo mismo en todas partes.
 */
import type {
  AssignmentStatus,
  GovernanceMode,
  IncidentCategory,
  IncidentStatus,
  PriorityLevel,
  UserRole,
  UserStatus,
} from "@/lib/api-client";

/** Familia de color de una insignia. La traducción del tono a CSS vive en `Badge`. */
export type Tone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "indigo"
  | "teal";

export const categoryLabels: Record<IncidentCategory, string> = {
  INFRASTRUCTURE: "Infraestructura",
  SECURITY: "Seguridad",
  CLEANING: "Limpieza",
};

export const categoryTones: Record<IncidentCategory, Tone> = {
  INFRASTRUCTURE: "info",
  SECURITY: "danger",
  CLEANING: "success",
};

export const statusLabels: Record<IncidentStatus, string> = {
  REPORTED: "Reportado",
  IN_REVIEW: "En revisión",
  IN_PROGRESS: "En atención",
  RESOLVED: "Resuelto",
  REJECTED: "No publicado",
};

export const statusTones: Record<IncidentStatus, Tone> = {
  REPORTED: "violet",
  IN_REVIEW: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  REJECTED: "neutral",
};

export const priorityLabels: Record<PriorityLevel, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

/*
 * La prioridad es una escala ordenada, no un conjunto de categorías: sube de
 * frío a cálido y cada peldaño se distingue del siguiente. Los cuatro colores
 * salen de `scripts/validate_palette.js` —banda de luminosidad, cromía mínima
 * y separación bajo daltonismo—, no de elegirlos a ojo. Reservados: ningún
 * gráfico los usa para otra cosa.
 */
export const priorityTones: Record<PriorityLevel, Tone> = {
  LOW: "indigo",
  MEDIUM: "teal",
  HIGH: "warning",
  CRITICAL: "danger",
};

/** De menos a más urgente. Fija el orden de leyendas, ejes y barras apiladas. */
export const priorityOrder: PriorityLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Orden del ciclo de vida, no alfabético: así se leen los embudos. */
export const statusOrder: IncidentStatus[] = [
  "REPORTED",
  "IN_REVIEW",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];

export const categoryOrder: IncidentCategory[] = ["INFRASTRUCTURE", "SECURITY", "CLEANING"];

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  ASSIGNED: "Asignada",
  ACKNOWLEDGED: "Recibida",
  COMPLETED: "Completada",
};

export const assignmentStatusTones: Record<AssignmentStatus, Tone> = {
  ASSIGNED: "warning",
  ACKNOWLEDGED: "info",
  COMPLETED: "success",
};

export const roleLabels: Record<UserRole, string> = {
  STUDENT: "Estudiante",
  STAFF: "Personal",
  ADMIN: "Administración",
};

export const roleTones: Record<UserRole, Tone> = {
  STUDENT: "neutral",
  STAFF: "info",
  ADMIN: "brand",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Activa",
  INACTIVE: "Suspendida",
};

export const userStatusTones: Record<UserStatus, Tone> = {
  ACTIVE: "success",
  INACTIVE: "danger",
};

export const governanceModeLabels: Record<GovernanceMode, string> = {
  MANUAL: "Manual",
  AI_ASSISTED: "IA asistida",
  AI_AUTONOMOUS: "IA autónoma",
};

/** `location_status` llega como texto libre: sólo estos tres valores están definidos. */
export const locationStatusLabels: Record<string, string> = {
  MATCHED: "Dentro de zona",
  OUTSIDE: "Fuera del campus",
  UNKNOWN: "Sin resolver",
};

export const locationStatusTones: Record<string, Tone> = {
  MATCHED: "success",
  OUTSIDE: "warning",
  UNKNOWN: "neutral",
};

/** Estados del router de IA expuestos por `/system/status`. */
export const aiStateLabels: Record<string, string> = {
  OK: "Operativo",
  HEALTHY: "Operativo",
  RETRYING: "Reintentando",
  FALLBACK_ACTIVE: "Usando respaldo",
  FAILING: "Con fallos",
  MISSING_CONFIGURATION: "Sin configurar",
};

export const aiStateTones: Record<string, Tone> = {
  OK: "success",
  HEALTHY: "success",
  RETRYING: "warning",
  FALLBACK_ACTIVE: "warning",
  FAILING: "danger",
  MISSING_CONFIGURATION: "danger",
};

export const workerStateLabels: Record<string, string> = {
  ACTIVE: "Activo",
  IDLE: "En reposo",
  STALE: "Sin señal",
};

export const workerStateTones: Record<string, Tone> = {
  ACTIVE: "success",
  IDLE: "neutral",
  STALE: "danger",
};

export const jobTypeLabels: Record<string, string> = {
  CLASSIFY_INCIDENT: "Clasificar incidencia",
  SEND_NOTIFICATION: "Enviar notificación",
};

export const jobStatusLabels: Record<string, string> = {
  PENDING: "En cola",
  PROCESSING: "Procesando",
  COMPLETED: "Completado",
  FAILED: "Fallido",
};

export const jobStatusTones: Record<string, Tone> = {
  PENDING: "neutral",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "danger",
};

/**
 * Traduce si conoce la clave y devuelve el original si no.
 *
 * Los campos que el backend tipa como `str` pueden crecer sin avisar al
 * frontend; preferimos mostrar el valor crudo antes que un hueco en blanco.
 */
export function labelOf(dictionary: Record<string, string>, value: string | null): string {
  if (!value) return "—";
  return dictionary[value] ?? value;
}

export function toneOf(dictionary: Record<string, Tone>, value: string | null): Tone {
  if (!value) return "neutral";
  return dictionary[value] ?? "neutral";
}

const dateTime = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" });

export function readableDate(value: string): string {
  return dateTime.format(new Date(value));
}

export function shortDate(value: string | Date): string {
  return dateOnly.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * «hace 5 min», «en 2 h». Para plazos, que se leen mejor en relativo que en
 * fecha absoluta: lo urgente es cuánto falta, no el día exacto.
 */
export function relativeTime(value: string): string {
  const diffSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  const format = new Intl.RelativeTimeFormat("es-PE", { numeric: "auto" });
  let amount = diffSeconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return format.format(Math.round(amount), unit);
    amount /= size;
  }
  return format.format(Math.round(amount), "year");
}

/** Iniciales para avatares. «Ana María Pérez» → «AP». */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
