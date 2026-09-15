"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { SystemStatusResponse, getSystemStatus } from "@/lib/api-client";
import {
  aiStateLabels,
  aiStateTones,
  jobStatusLabels,
  jobStatusTones,
  jobTypeLabels,
  labelOf,
  toneOf,
  workerStateLabels,
  workerStateTones,
} from "@/lib/labels";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  StatCard,
} from "@/components/ui";

/**
 * Estado del sistema.
 *
 * Era una lista de párrafos con los valores en crudo —`MISSING_CONFIGURATION`,
 * `STALE`— donde todo pesaba igual. Ahora lo que puede estar mal se ve primero
 * y con su color, y los códigos internos se traducen.
 */
export function SystemSection() {
  const [system, setSystem] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSystem(await getSystemStatus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar el estado del sistema");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const aiState = system?.ai.state ?? null;
  const aiTone = toneOf(aiStateTones, aiState);

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="API"
          value={system?.api_ok ? "Operativa" : "Caída"}
          tone={system?.api_ok ? "success" : "danger"}
          loading={loading}
        />
        <StatCard
          label="Router de IA"
          value={labelOf(aiStateLabels, aiState)}
          hint={system?.ai.model}
          tone={aiTone}
          loading={loading}
        />
        <StatCard
          label="Plazos vencidos"
          value={system?.overdue_assignments ?? 0}
          tone={(system?.overdue_assignments ?? 0) > 0 ? "danger" : "success"}
          loading={loading}
        />
        <StatCard
          label="Clasificaciones fallidas"
          value={system?.ai.failed_classifications_24h ?? 0}
          hint="Últimas 24 h"
          tone={(system?.ai.failed_classifications_24h ?? 0) > 0 ? "warning" : "success"}
          loading={loading}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Capa de IA"
            actions={
              <Button size="sm" variant="secondary" onClick={load} loading={loading}>
                Actualizar
              </Button>
            }
          />
          <CardBody className="grid gap-3">
            {loading || !system ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <dl className="grid gap-2 text-sm">
                  <Row label="Estado">
                    <Badge tone={aiTone} dot size="md">
                      {labelOf(aiStateLabels, system.ai.state)}
                    </Badge>
                  </Row>
                  <Row label="Modelo">
                    <span className="font-mono text-xs">{system.ai.model}</span>
                  </Row>
                  <Row label="Clave configurada">
                    <Badge tone={system.ai.api_key_configured ? "success" : "danger"}>
                      {system.ai.api_key_configured ? "Sí" : "No"}
                    </Badge>
                  </Row>
                  <Row label="Respaldos en 24 h">{system.ai.fallback_count_24h}</Row>
                  <Row label="Cuota agotada">
                    <Badge tone={system.ai.quota_exhausted_detected ? "danger" : "success"}>
                      {system.ai.quota_exhausted_detected ? "Sí" : "No"}
                    </Badge>
                  </Row>
                </dl>

                {system.ai.latest_failure_reason ? (
                  <Alert tone="danger" title="Último fallo del router">
                    {system.ai.latest_failure_reason}
                  </Alert>
                ) : null}
                {system.ai.latest_fallback_reason ? (
                  <Alert tone="warning" title="Último respaldo usado">
                    {system.ai.latest_fallback_reason}
                  </Alert>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Procesos y cola" />
          <CardBody className="grid gap-4">
            {loading || !system ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <div className="grid gap-2">
                  {system.workers.map((worker) => (
                    <div
                      key={worker.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <span className="font-mono text-xs text-ink">{worker.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted">
                          {worker.pending_jobs} en cola · {worker.processing_jobs} en curso
                        </span>
                        <Badge tone={toneOf(workerStateTones, worker.state)} dot>
                          {labelOf(workerStateLabels, worker.state)}
                        </Badge>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                    Cola de trabajos
                  </p>
                  {system.queue_summary.length === 0 ? (
                    <p className="text-xs text-muted">Sin trabajos recientes.</p>
                  ) : (
                    system.queue_summary.map((item, index) => (
                      <div
                        key={`${item.job_type}-${item.job_status}-${index}`}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-body">{labelOf(jobTypeLabels, item.job_type)}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={toneOf(jobStatusTones, item.job_status)}>
                            {labelOf(jobStatusLabels, item.job_status)}
                          </Badge>
                          <span className="w-8 text-right font-semibold tabular-nums text-ink">
                            {item.count}
                          </span>
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {system.notes.length > 0 ? (
                  <div className="grid gap-1.5">
                    {system.notes.map((note, index) => (
                      <Alert key={index} tone="neutral">
                        {note}
                      </Alert>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-subtle pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
