"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CommunityFeedItem,
  IncidentCategory,
  IncidentStatus,
  StudentFeedItem,
  addCommunityReaction,
  getCommunityFeedImageObjectUrl,
  getMyIncidentFeedImageObjectUrl,
  listCommunityFeed,
  listMyIncidentFeed,
  removeCommunityReaction,
  revokeCommunityConsent,
} from "@/lib/api-client";
import {
  categoryLabels,
  categoryOrder,
  readableDate,
  statusLabels,
  statusOrder,
  statusTones,
} from "@/lib/labels";
import { Alert, Badge, Button, EmptyState, Skeleton, buttonClasses } from "@/components/ui";

type FeedTab = "MINE" | "COMMUNITY";

type SecureFeedImageProps = {
  incidentId: string;
  imageLoader: (incidentId: string) => Promise<string>;
  alt: string;
  onOpen: (url: string) => void;
};

export function SecureFeedImage({ incidentId, imageLoader, alt, onOpen }: SecureFeedImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    imageLoader(incidentId)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
        else URL.revokeObjectURL(nextUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageLoader, incidentId]);

  if (failed) {
    return <div className="feed-image-placeholder">La imagen ya no está disponible.</div>;
  }
  if (!url) {
    return <div className="feed-image-placeholder">Cargando evidencia…</div>;
  }
  return (
    <button type="button" className="feed-image-button" onClick={() => onOpen(url)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="feed-image" />
    </button>
  );
}

type IncidentCardProps = {
  item: StudentFeedItem | CommunityFeedItem;
  tab: FeedTab;
  onOpenImage: (url: string) => void;
  onReact: (item: CommunityFeedItem) => void;
  reactingId: string | null;
  onRevoke: (item: StudentFeedItem) => void;
  revokingId: string | null;
};

function IncidentCard({
  item,
  tab,
  onOpenImage,
  onReact,
  reactingId,
  onRevoke,
  revokingId,
}: IncidentCardProps) {
  const isMine = tab === "MINE";
  const mine = item as StudentFeedItem;
  const community = item as CommunityFeedItem;
  return (
    <article className="feed-card">
      <div className="feed-card-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="feed-avatar" aria-hidden="true">
            {isMine ? "Yo" : "CA"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              {isMine ? "Mi reporte" : "Comunidad Campus"}
            </p>
            <p className="text-xs text-muted">{readableDate(item.created_at)}</p>
          </div>
        </div>
        <Badge tone={statusTones[item.status]} dot>
          {statusLabels[item.status]}
        </Badge>
      </div>

      <p className="feed-description">{item.description}</p>

      {item.has_image ? (
        <SecureFeedImage
          incidentId={item.id}
          imageLoader={isMine ? getMyIncidentFeedImageObjectUrl : getCommunityFeedImageObjectUrl}
          alt={isMine ? "Evidencia de mi reporte" : "Evidencia compartida por la comunidad"}
          onOpen={onOpenImage}
        />
      ) : null}

      <div className="feed-meta">
        <Badge tone="neutral">{categoryLabels[item.category]}</Badge>
        <span className="feed-zone">{item.location_zone_name ?? "Zona no definida"}</span>
      </div>

      {isMine ? (
        <div className="feed-owner-note">
          {mine.community_consent ? (
            <>
              <p>
                {mine.is_community_visible
                  ? "Compartido anónimamente en Comunidad."
                  : "La publicación está pendiente de la validación de IA."}
              </p>
              <button
                type="button"
                className="feed-text-action"
                onClick={() => onRevoke(mine)}
                disabled={revokingId === mine.id}
              >
                {revokingId === mine.id ? "Retirando…" : "Retirar de Comunidad"}
              </button>
            </>
          ) : (
            <p>Este reporte es privado y solo tú puedes verlo.</p>
          )}
        </div>
      ) : (
        <div className="feed-reaction-bar">
          {community.is_own_report ? (
            <span className="text-xs font-semibold text-[var(--tone-success-fg)]">Tu reporte compartido</span>
          ) : (
            <button
              type="button"
              className={`feed-reaction ${community.reacted_by_me ? "is-active" : ""}`}
              onClick={() => onReact(community)}
              disabled={reactingId === community.id}
              aria-pressed={community.reacted_by_me}
            >
              {community.reacted_by_me ? "✓ Apoyado" : "♡ Apoyar"}
            </button>
          )}
          <span className="text-xs font-semibold text-muted">
            {community.reaction_count} {community.reaction_count === 1 ? "apoyo" : "apoyos"}
          </span>
        </div>
      )}
    </article>
  );
}

export function StudentIncidentsFeed({ fullName, onLogout }: { fullName: string; onLogout: () => void }) {
  const [tab, setTab] = useState<FeedTab>("MINE");
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "">("");
  const [myItems, setMyItems] = useState<StudentFeedItem[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [communityItems, setCommunityItems] = useState<CommunityFeedItem[]>([]);
  const [communityTotal, setCommunityTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (reset: boolean) => {
      const isMine = tab === "MINE";
      const offset = reset ? 0 : isMine ? myItems.length : communityItems.length;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const params = {
          status_filter: statusFilter || undefined,
          category: categoryFilter || undefined,
          limit: 12,
          offset,
        };
        if (isMine) {
          const response = await listMyIncidentFeed(params);
          setMyItems((current) => (reset ? response.items : [...current, ...response.items]));
          setMyTotal(response.total);
        } else {
          const response = await listCommunityFeed(params);
          setCommunityItems((current) => (reset ? response.items : [...current, ...response.items]));
          setCommunityTotal(response.total);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el feed.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categoryFilter, communityItems.length, myItems.length, statusFilter, tab],
  );

  useEffect(() => {
    setLightboxUrl(null);
    void loadFeed(true);
    // Resetting does not use the current item count; only these controls should reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, categoryFilter]);

  const handleReaction = async (item: CommunityFeedItem) => {
    setReactingId(item.id);
    try {
      const state = item.reacted_by_me
        ? await removeCommunityReaction(item.id)
        : await addCommunityReaction(item.id);
      setCommunityItems((items) =>
        items.map((entry) =>
          entry.id === item.id
            ? { ...entry, reaction_count: state.reaction_count, reacted_by_me: state.reacted_by_me }
            : entry,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el apoyo.");
    } finally {
      setReactingId(null);
    }
  };

  const handleRevoke = async (item: StudentFeedItem) => {
    setRevokingId(item.id);
    try {
      await revokeCommunityConsent(item.id);
      setMyItems((items) =>
        items.map((entry) =>
          entry.id === item.id
            ? { ...entry, community_consent: false, is_community_visible: false }
            : entry,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo retirar el reporte.");
    } finally {
      setRevokingId(null);
    }
  };

  const activeItems = tab === "MINE" ? myItems : communityItems;
  const activeTotal = tab === "MINE" ? myTotal : communityTotal;
  const canLoadMore = activeItems.length < activeTotal;

  return (
    <main className="student-feed-shell">
      <header className="student-feed-header">
        <div>
          <p className="student-feed-kicker">Campus Alertas</p>
          <h1>Hola, {fullName.split(" ")[0]}</h1>
          <p>Consulta tus reportes o las incidencias compartidas por la comunidad.</p>
        </div>
        <div className="student-feed-actions">
          <Link href="/" className={buttonClasses("primary", "sm")}>
            Crear reporte
          </Link>
          <Button variant="secondary" size="sm" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <nav className="student-feed-tabs" aria-label="Panel de incidencias">
        <button type="button" className={tab === "MINE" ? "is-active" : ""} onClick={() => setTab("MINE")}>
          Mis reportes
        </button>
        <button type="button" className={tab === "COMMUNITY" ? "is-active" : ""} onClick={() => setTab("COMMUNITY")}>
          Comunidad
        </button>
      </nav>

      <section className="student-feed-toolbar" aria-label="Filtros">
        <select
          aria-label="Filtrar por categoría"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as IncidentCategory | "")}
        >
          <option value="">Todas las categorías</option>
          {categoryOrder.map((value) => (
            <option key={value} value={value}>
              {categoryLabels[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as IncidentStatus | "")}
        >
          <option value="">Todos los estados</option>
          {statusOrder.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => void loadFeed(true)} loading={loading}>
          Actualizar
        </Button>
      </section>

      {error ? <Alert tone="danger" className="mb-3">{error}</Alert> : null}

      <section className="student-feed-list" aria-live="polite">
        {/* El esqueleto ocupa el sitio de las tarjetas que van a llegar, para
            que la lista no dé un salto cuando lleguen. */}
        {loading ? <FeedSkeleton /> : null}
        {!loading && activeItems.length === 0 ? (
          <EmptyState
            title={tab === "MINE" ? "Aún no tienes reportes" : "Aún no hay reportes compartidos"}
            description={
              tab === "MINE"
                ? "Crea un reporte y podrás seguir su avance desde aquí."
                : "Vuelve pronto para ver incidencias validadas por la comunidad."
            }
            action={
              tab === "MINE" ? (
                <Link href="/" className={buttonClasses("primary", "sm")}>
                  Crear mi primer reporte
                </Link>
              ) : null
            }
          />
        ) : null}
        {!loading
          ? activeItems.map((item) => (
              <IncidentCard
                key={`${tab}-${item.id}`}
                item={item}
                tab={tab}
                onOpenImage={setLightboxUrl}
                onReact={handleReaction}
                reactingId={reactingId}
                onRevoke={handleRevoke}
                revokingId={revokingId}
              />
            ))
          : null}
      </section>

      {canLoadMore ? (
        <div className="mt-4 grid justify-items-center">
          <Button variant="secondary" onClick={() => void loadFeed(false)} loading={loadingMore}>
            Cargar más
          </Button>
        </div>
      ) : null}

      {lightboxUrl ? (
        <div className="feed-lightbox" role="dialog" aria-modal="true" aria-label="Vista ampliada de evidencia">
          <Button
            variant="secondary"
            className="feed-lightbox-close"
            onClick={() => setLightboxUrl(null)}
          >
            Cerrar
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Evidencia ampliada" />
        </div>
      ) : null}
    </main>
  );
}

/** Tres tarjetas fantasma con la forma real de una publicación del muro. */
function FeedSkeleton() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <article key={index} className="feed-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <Skeleton className="mt-4 h-40 w-full" />
        </article>
      ))}
    </>
  );
}
