"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AssignmentStatus,
  IncidentListItem,
  IncidentStatus,
  StaffAssignmentItem,
  StaffMember,
  assignIncidentToStaff,
  listIncidents,
  listStaff,
  listStaffAssignments,
  updateAssignmentStatus,
  updateIncidentStatusAdmin,
} from "@/lib/api-client";
import {
  assignmentStatusLabels,
  assignmentStatusTones,
  categoryLabels,
  priorityLabels,
  priorityTones,
  statusLabels,
  statusOrder,
  statusTones,
} from "@/lib/labels";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";

const ASSIGNMENT_STATUSES: AssignmentStatus[] = ["ASSIGNED", "ACKNOWLEDGED", "COMPLETED"];
/** Estados que aún admiten trabajo: son los que se pueden encomendar. */
const OPEN_STATUSES: IncidentStatus[] = ["REPORTED", "IN_REVIEW", "IN_PROGRESS"];

export function AssignmentsSection() {
  const { confirm, dialog } = useConfirm();

  const [pool, setPool] = useState<IncidentListItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [incidentId, setIncidentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const [manualStatus, setManualStatus] = useState<IncidentStatus>("IN_PROGRESS");
  const [statusSaving, setStatusSaving] = useState(false);

  const [assignments, setAssignments] = useState<StaffAssignmentItem[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [rowSaving, setRowSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [blocks, staffList] = await Promise.all([
        Promise.all(
          OPEN_STATUSES.map((status) =>
            listIncidents({ status_filter: status, limit: 100, offset: 0 }),
          ),
        ),
        listStaff({ limit: 300, offset: 0 }),
      ]);
      // Una incidencia puede aparecer en más de un bloque si cambia de estado
      // entre peticiones; el mapa la deja una sola vez.
      const unique = new Map<string, IncidentListItem>();
      for (const block of blocks) {
        for (const item of block.items) unique.set(item.id, item);
      }
      setPool(
        [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
      setStaff(staffList.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las incidencias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAssignments = useCallback(async (id: string) => {
    setAssignmentsLoading(true);
    try {
      const data = await listStaffAssignments(id, { limit: 200, offset: 0 });
      setAssignments(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las asignaciones");
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!staffId) {
      setAssignments([]);
      return;
    }
    void loadAssignments(staffId);
  }, [loadAssignments, staffId]);

  const selectedIncident = useMemo(
    () => pool.find((item) => item.id === incidentId) ?? null,
    [incidentId, pool],
  );

  useEffect(() => {
    if (selectedIncident) setManualStatus(selectedIncident.status);
  }, [selectedIncident]);

  const unassignedCount = pool.filter((item) => item.assignment_count === 0).length;
  const visible = onlyUnassigned
    ? pool.filter((item) => item.assignment_count === 0 || item.id === incidentId)
    : pool;
  const selectedStaff = staff.find((member) => member.id === staffId) ?? null;

  const assign = async () => {
    if (!incidentId || !staffId) return;
    const accepted = await confirm({
      title: "Asignar incidencia",
      message: `Se encomendará a ${selectedStaff?.full_name ?? "el responsable"}.`,
      warning: notify ? "Se enviará un correo real al responsable." : undefined,
      confirmLabel: "Asignar",
    });
    if (!accepted) return;

    setAssigning(true);
    setError(null);
    try {
      const response = await assignIncidentToStaff(incidentId, {
        responsible_id: staffId,
        notes: notes.trim() || undefined,
        notify,
      });
      setNotice(response.message);
      setNotes("");
      await Promise.all([load(), loadAssignments(staffId)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo asignar la incidencia");
    } finally {
      setAssigning(false);
    }
  };

  const changeIncidentStatus = async () => {
    if (!incidentId) return;
    const accepted = await confirm({
      title: "Cambiar el estado de la incidencia",
      message: `La incidencia pasará a «${statusLabels[manualStatus]}».`,
      danger: manualStatus === "REJECTED",
      confirmLabel: "Cambiar",
    });
    if (!accepted) return;

    setStatusSaving(true);
    setError(null);
    try {
      const response = await updateIncidentStatusAdmin(incidentId, { status: manualStatus });
      setNotice(response.message);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el estado");
    } finally {
      setStatusSaving(false);
    }
  };

  const changeAssignmentStatus = async (assignmentId: string, status: AssignmentStatus) => {
    setRowSaving(assignmentId);
    setError(null);
    try {
      const response = await updateAssignmentStatus(assignmentId, { status });
      setNotice(response.message);
      await Promise.all([load(), staffId ? loadAssignments(staffId) : Promise.resolve()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la asignación");
    } finally {
      setRowSaving(null);
    }
  };

  return (
    <div className="grid gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Paso 1 · Elegir la incidencia"
            description="Por defecto sólo se listan las que aún no tienen responsable."
            actions={
              <Button size="sm" variant="secondary" onClick={load} loading={loading}>
                Actualizar
              </Button>
            }
          />
          <CardBody className="grid gap-3.5">
            <Checkbox
              checked={onlyUnassigned}
              onChange={(event) => setOnlyUnassigned(event.target.checked)}
              label={`Sólo sin asignar (${unassignedCount} de ${pool.length})`}
            />

            {loading ? (
              <Skeleton className="h-10" />
            ) : (
              <Field label="Incidencia">
                {({ id }) => (
                  <Select
                    id={id}
                    value={incidentId}
                    onChange={(event) => setIncidentId(event.target.value)}
                  >
                    <option value="">Selecciona una incidencia</option>
                    {visible.map((incident) => (
                      <option key={incident.id} value={incident.id}>
                        {incident.id.slice(0, 8)} · {priorityLabels[incident.priority]} ·{" "}
                        {incident.location_zone_name ?? "Zona no definida"}
                        {incident.assignment_count > 0
                          ? ` · ya con ${incident.assigned_to.join(", ")}`
                          : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}

            {selectedIncident ? (
              <div className="grid gap-2 rounded-lg border border-line bg-sunken p-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={priorityTones[selectedIncident.priority]} dot>
                    {priorityLabels[selectedIncident.priority]}
                  </Badge>
                  <Badge tone="neutral">{categoryLabels[selectedIncident.category]}</Badge>
                  <Badge tone={statusTones[selectedIncident.status]}>
                    {statusLabels[selectedIncident.status]}
                  </Badge>
                </div>
                <p className="text-sm text-body">{selectedIncident.description}</p>
                {selectedIncident.assignment_count > 0 ? (
                  <Alert tone="warning">
                    Ya está asignada a {selectedIncident.assigned_to.join(", ")}. Volver a
                    asignarla al mismo responsable sólo actualiza la nota.
                  </Alert>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted">Selecciona una incidencia para ver su detalle.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Paso 2 · Asignar a un responsable"
            description="El plazo de atención se calcula según la prioridad de la incidencia."
          />
          <CardBody className="grid gap-3.5">
            <Field label="Responsable">
              {({ id }) => (
                <Select id={id} value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                  <option value="">Selecciona un responsable</option>
                  {staff
                    .filter((member) => member.is_active)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} · {member.area_name} (
                        {categoryLabels[member.category]}) · {member.pending_assignments} pend.
                      </option>
                    ))}
                </Select>
              )}
            </Field>

            <Field label="Nota para el responsable" optional>
              {({ id }) => (
                <Textarea
                  id={id}
                  className="min-h-20"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={300}
                  placeholder="Contexto útil para quien va a atenderla."
                />
              )}
            </Field>

            <Checkbox
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              label="Avisar por correo"
              description="Se envía un correo real a la dirección del responsable."
            />

            <Button onClick={assign} loading={assigning} disabled={!incidentId || !staffId}>
              Asignar incidencia
            </Button>
            {!incidentId || !staffId ? (
              <p className="text-xs text-muted" aria-live="polite">
                {!incidentId && !staffId
                  ? "Elige una incidencia y un responsable."
                  : !incidentId
                    ? "Falta elegir la incidencia en el paso 1."
                    : "Falta elegir el responsable."}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title="Cambiar el estado"
            description="Operación aparte de la asignación; se aplica a la incidencia del paso 1."
          />
          <CardBody className="grid gap-3.5">
            <Field label="Nuevo estado">
              {({ id }) => (
                <Select
                  id={id}
                  value={manualStatus}
                  onChange={(event) => setManualStatus(event.target.value as IncidentStatus)}
                >
                  {statusOrder.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button
              variant="secondary"
              onClick={changeIncidentStatus}
              loading={statusSaving}
              disabled={!incidentId}
            >
              Actualizar estado
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={selectedStaff ? `Carga de ${selectedStaff.full_name}` : "Carga del responsable"}
            description={
              selectedStaff ? selectedStaff.area_name : "Elige un responsable en el paso 2."
            }
          />
          <CardBody className="grid gap-2">
            {!staffId ? (
              <EmptyState
                title="Ningún responsable elegido"
                description="Al elegirlo verás aquí lo que ya tiene encomendado."
              />
            ) : assignmentsLoading ? (
              <>
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
              </>
            ) : assignments.length === 0 ? (
              <EmptyState title="Sin asignaciones registradas" />
            ) : (
              assignments.map((item) => (
                <article
                  key={item.assignment_id}
                  className="grid gap-2 rounded-lg border border-line p-2.5 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="text-body">
                      <span className="font-mono text-subtle">{item.incident_id.slice(0, 8)}</span>{" "}
                      · {categoryLabels[item.incident_category]} ·{" "}
                      {item.incident_zone_name ?? "Zona no definida"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={statusTones[item.incident_status]}>
                        {statusLabels[item.incident_status]}
                      </Badge>
                      <Badge tone={assignmentStatusTones[item.assignment_status]} dot>
                        {assignmentStatusLabels[item.assignment_status]}
                      </Badge>
                    </div>
                  </div>
                  {/* Los tres estados como botones: el que ya rige queda
                      deshabilitado, así que nunca se «cambia» a lo mismo. */}
                  <div className="flex flex-wrap gap-1">
                    {ASSIGNMENT_STATUSES.map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant="secondary"
                        onClick={() => changeAssignmentStatus(item.assignment_id, status)}
                        loading={rowSaving === item.assignment_id}
                        disabled={item.assignment_status === status}
                      >
                        {assignmentStatusLabels[status]}
                      </Button>
                    ))}
                  </div>
                </article>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {dialog}
    </div>
  );
}
