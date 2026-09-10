"use client";

import { ModerationQueue } from "@/components/moderation-queue";
import { AdminIncidentsFeed } from "@/components/admin-incidents-feed";

/**
 * Comunidad: primero lo que espera decisión y debajo lo ya publicado.
 *
 * Son dos componentes que ya existían; el orden importa, porque la cola de
 * moderación es trabajo pendiente y el muro es sólo consulta.
 */
export function SocialSection() {
  return (
    <div className="grid gap-4">
      <ModerationQueue />
      <AdminIncidentsFeed />
    </div>
  );
}
