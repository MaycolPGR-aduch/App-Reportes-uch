"use client";

import { AdminIncidentsFeed } from "@/components/admin-incidents-feed";

/**
 * Comunidad: lo que ya está publicado, tal como lo ve la comunidad.
 *
 * Aquí vivía también la cola de moderación con el triaje dentro. Se sacó por
 * dos motivos. El de fondo: la cola filtraba por consentimiento de
 * publicación, así que las incidencias que no consentían quedaban sin forma de
 * que un administrador confirmara su categoría y prioridad --y el triaje es la
 * medición central del estudio. El de nombre: «Comunidad» debe mostrar lo que
 * la comunidad ve, no el trabajo pendiente de quien modera.
 *
 * Triar y moderar se hacen ahora desde la ficha de cada incidencia, en la
 * pestaña de incidencias, donde están todas.
 */
export function SocialSection() {
  return <AdminIncidentsFeed />;
}
