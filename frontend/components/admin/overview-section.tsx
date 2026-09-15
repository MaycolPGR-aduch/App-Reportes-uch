"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IncidentListItem,
  StaffMember,
  SystemStatusResponse,
  getSystemStatus,
  listIncidents,
  listStaff,
} from "@/lib/api-client";
import {
  categoryLabels,
  categoryOrder,
  priorityLabels,
  priorityOrder,
  priorityTones,
  shortDate,
  statusLabels,
  statusOrder,
  statusTones,
} from "@/lib/labels";
import { Alert, Button, Card, CardBody, CardHeader, Skeleton, StatCard } from "@/components/ui";
import { BarList, ChartFrame, ColumnChart, CompositionBar } from "@/components/charts";
import type { BarItem, ColumnPoint, Serie } from "@/components/charts";

/** Tope de incidencias que se traen para los gráficos: 5 páginas de la API. */
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const TREND_DAYS = 14;

/** Descarga páginas hasta cubrir el total o agotar el tope. */
async function fetchIncidentSample(): Promise<{ items: IncidentListItem[]; total: number }> {
  const first = await listIncidents({ limit: PAGE_SIZE, offset: 0 });
  const items = [...first.items];
  for (let page = 1; page < MAX_PAGES && items.length < first.total; page += 1) {
    const next = await listIncidents({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (next.items.length === 0) break;
    items.push(...next.items);
  }
  return { items, total: first.total };
}

/** Serie diaria de los últimos días, incluidos los días sin incidencias. */
function dailyTrend(items: IncidentListItem[]): ColumnPoint[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const day = item.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const points: ColumnPoint[] = [];
  const today = new Date();
  for (let back = TREND_DAYS - 1; back >= 0; back -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - back);
    // Un día sin reportes vale cero y ocupa su hueco: saltárselo comprimiría
    // el eje y haría parecer continuo lo que tuvo una pausa.
    const key = date.toISOString().slice(0, 10);
    points.push({ key, label: shortDate(date), value: counts.get(key) ?? 0 });
  }
  return points;
}

function countBy<T extends string>(items: IncidentListItem[], pick: (item: IncidentListItem) => T) {
  const result = new Map<T, number>();
  for (const item of items) {
    const key = pick(item);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

export function OverviewSection() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [system, setSystem] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sample, staffList, status] = await Promise.all([
        fetchIncidentSample(),
        listStaff({ limit: 300, offset: 0 }),
        getSystemStatus(),
      ]);
      setIncidents(sample.items);
      setTotal(sample.total);
      setStaff(staffList.items);
      setSystem(status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trend = useMemo(() => dailyTrend(incidents), [incidents]);

  const statusSeries = useMemo<Serie[]>(() => {
    const counts = countBy(incidents, (item) => item.status);
    return statusOrder.map((status) => ({
      key: status,
      label: statusLabels[status],
      value: counts.get(status) ?? 0,
      tone: statusTones[status],
      // «No publicado» es el único estado de tono gris, y un gris plano no se
      // separa del fondo del propio gráfico: se dibuja con trama diagonal.
      textured: status === "REJECTED",
    }));
  }, [incidents]);

  const prioritySeries = useMemo<BarItem[]>(() => {
    const counts = countBy(incidents, (item) => item.priority);
    return priorityOrder
      .slice()
      .reverse()
      .map((priority) => ({
        key: priority,
        label: priorityLabels[priority],
        value: counts.get(priority) ?? 0,
        tone: priorityTones[priority],
      }));
  }, [incidents]);

  const categorySeries = useMemo<BarItem[]>(() => {
    const counts = countBy(incidents, (item) => item.category);
    return categoryOrder.map((category) => ({
      key: category,
      label: categoryLabels[category],
      value: counts.get(category) ?? 0,
    }));
  }, [incidents]);

  const zoneSeries = useMemo<BarItem[]>(() => {
    const counts = countBy(incidents, (item) => item.location_zone_name ?? "Zona no definida");
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([zone, value]) => ({ key: zone, label: zone, value }));
  }, [incidents]);

  const workloadSeries = useMemo<BarItem[]>(() => {
    return staff
      .filter((member) => member.is_active)
      .sort((a, b) => b.pending_assignments - a.pending_assignments)
      .slice(0, 6)
      .map((member) => ({
        key: member.id,
        label: member.full_name,
        detail: member.area_name,
        value: member.pending_assignments,
      }));
  }, [staff]);

  const unassigned = incidents.filter((item) => item.assignment_count === 0).length;
  const resolved = incidents.filter((item) => item.status === "RESOLVED").length;
  const overdue = system?.overdue_assignments ?? 0;
  const truncated = total > incidents.length;

  if (error) {
    return (
      <Alert
        tone="danger"
        action={
          <Button size="sm" variant="secondary" onClick={load}>
            Reintentar
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Incidencias" value={total} loading={loading} />
        <StatCard
          label="Sin asignar"
          value={unassigned}
          tone={unassigned > 0 ? "warning" : "success"}
          hint={unassigned > 0 ? "Esperan responsable" : "Todas tienen responsable"}
          loading={loading}
        />
        <StatCard
          label="Plazo vencido"
          value={overdue}
          tone={overdue > 0 ? "danger" : "success"}
          hint={overdue > 0 ? "Asignaciones fuera de plazo" : "Nada fuera de plazo"}
          loading={loading}
        />
        <StatCard label="Resueltas" value={resolved} tone="success" loading={loading} />
      </section>

      {/* Decir sobre cuántos datos está hecho el gráfico evita leerlo como si
          fuese el histórico completo cuando no lo es. */}
      {truncated ? (
        <Alert tone="info">
          Los gráficos resumen las {incidents.length} incidencias más recientes de {total}.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Actividad"
            actions={
              <Button size="sm" variant="secondary" onClick={load} loading={loading}>
                Actualizar
              </Button>
            }
          />
          <CardBody>
            {loading ? (
              <Skeleton className="h-44" />
            ) : (
              <ChartFrame
                title={`Incidencias por día · últimos ${TREND_DAYS} días`}
                description="Pasa el cursor por una columna para ver el recuento del día."
              >
                <ColumnChart points={trend} />
              </ChartFrame>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Estado del ciclo" />
          <CardBody>
            {loading ? (
              <Skeleton className="h-44" />
            ) : (
              <ChartFrame
                title="Reparto por estado"
                description="Proporción de incidencias en cada fase de atención."
                series={statusSeries}
                total={incidents.length}
                unit="Incidencias"
              >
                <CompositionBar series={statusSeries} total={incidents.length} />
              </ChartFrame>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Prioridad y categoría" />
          <CardBody className="grid gap-6">
            {loading ? (
              <Skeleton className="h-44" />
            ) : (
              <>
                <ChartFrame title="Por prioridad" description="De más urgente a menos.">
                  <BarList items={prioritySeries} />
                </ChartFrame>
                <ChartFrame title="Por categoría">
                  <BarList items={categorySeries} tone="brand" />
                </ChartFrame>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Dónde y quién" />
          <CardBody className="grid gap-6">
            {loading ? (
              <Skeleton className="h-44" />
            ) : (
              <>
                <ChartFrame title="Zonas con más incidencias" description="Las seis primeras.">
                  <BarList items={zoneSeries} tone="brand" emptyLabel="Ninguna zona resuelta aún." />
                </ChartFrame>
                <ChartFrame
                  title="Carga pendiente por responsable"
                  description="Asignaciones abiertas de cada persona activa."
                >
                  <BarList
                    items={workloadSeries}
                    tone="teal"
                    emptyLabel="Nadie tiene asignaciones pendientes."
                  />
                </ChartFrame>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
