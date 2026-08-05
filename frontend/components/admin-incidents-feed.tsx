"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IncidentCategory,
  IncidentStatus,
  StudentFeedItem,
  getAdminIncidentFeedImageObjectUrl,
  listAdminIncidentFeed,
} from "@/lib/api-client";
import {
  SecureFeedImage,
  categoryLabels,
  readableDate,
  statusClass,
  statusLabels,
} from "@/components/student-incidents-feed";

export function AdminIncidentsFeed() {
  const [items, setItems] = useState<StudentFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "">("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const response = await listAdminIncidentFeed({
          status_filter: statusFilter || undefined,
          category: categoryFilter || undefined,
          limit: 12,
          offset: reset ? 0 : items.length,
        });
        setItems((current) => (reset ? response.items : [...current, ...response.items]));
        setTotal(response.total);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la vista social.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categoryFilter, items.length, statusFilter],
  );

  useEffect(() => {
    setLightboxUrl(null);
    void loadFeed(true);
    // Item count does not participate in a reset; filters are the reload controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, statusFilter]);

  return (
    <section className="student-feed-shell" aria-label="Vista social de incidencias">
      <header className="student-feed-header">
        <div>
          <p className="student-feed-kicker">Vista social</p>
          <h1>Incidencias del campus</h1>
          <p>Consulta todos los reportes en un formato visual y resumido.</p>
        </div>
      </header>

      <div className="student-feed-toolbar" aria-label="Filtros de la vista social">
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as IncidentCategory | "")}
        >
          <option value="">Todas las categorías</option>
          <option value="INFRASTRUCTURE">Infraestructura</option>
          <option value="SECURITY">Seguridad</option>
          <option value="CLEANING">Limpieza</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as IncidentStatus | "")}
        >
          <option value="">Todos los estados</option>
          <option value="REPORTED">Reportado</option>
          <option value="IN_REVIEW">En revisión</option>
          <option value="IN_PROGRESS">En atención</option>
          <option value="RESOLVED">Resuelto</option>
          <option value="REJECTED">No publicado</option>
        </select>
        <button type="button" onClick={() => void loadFeed(true)} disabled={loading}>
          Actualizar
        </button>
      </div>

      {error ? <p className="student-feed-error" role="alert">{error}</p> : null}
      {loading ? <p className="student-feed-loading">Actualizando incidencias…</p> : null}

      <div className="student-feed-list" aria-live="polite">
        {!loading && items.length === 0 ? (
          <div className="student-feed-empty">
            <p className="text-lg font-bold text-slate-800">No hay incidencias con estos filtros.</p>
            <p>Prueba otra categoría o estado.</p>
          </div>
        ) : null}
        {items.map((item) => (
          <article className="feed-card" key={item.id}>
            <div className="feed-card-head">
              <div className="flex min-w-0 items-center gap-3">
                <div className="feed-avatar" aria-hidden="true">CA</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">Reporte del campus</p>
                  <p className="text-xs text-slate-500">{readableDate(item.created_at)}</p>
                </div>
              </div>
              <span className={`feed-status ${statusClass(item.status)}`}>
                {statusLabels[item.status]}
              </span>
            </div>

            <p className="feed-description">{item.description}</p>
            {item.has_image ? (
              <SecureFeedImage
                incidentId={item.id}
                imageLoader={getAdminIncidentFeedImageObjectUrl}
                alt="Evidencia de la incidencia"
                onOpen={setLightboxUrl}
              />
            ) : null}
            <div className="feed-meta">
              <span className="feed-chip">{categoryLabels[item.category]}</span>
              <span className="feed-zone">{item.location_zone_name ?? "Zona no definida"}</span>
            </div>
            <div className="feed-owner-note">
              <p>
                {item.is_community_visible
                  ? "Visible anónimamente en Comunidad"
                  : item.community_consent
                    ? "Pendiente de revisión para Comunidad"
                    : "Reporte privado"}
              </p>
            </div>
          </article>
        ))}
      </div>

      {items.length < total ? (
        <button
          type="button"
          className="student-load-more"
          onClick={() => void loadFeed(false)}
          disabled={loadingMore}
        >
          {loadingMore ? "Cargando…" : "Cargar más"}
        </button>
      ) : null}

      {lightboxUrl ? (
        <div className="feed-lightbox" role="dialog" aria-modal="true" aria-label="Vista ampliada de evidencia">
          <button type="button" className="feed-lightbox-close" onClick={() => setLightboxUrl(null)}>
            Cerrar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Evidencia ampliada" />
        </div>
      ) : null}
    </section>
  );
}
