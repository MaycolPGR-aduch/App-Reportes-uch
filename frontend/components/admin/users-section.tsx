"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  IncidentCategory,
  PriorityLevel,
  StaffMember,
  UserRole,
  UserStatus,
  banAdminUser,
  createAdminUser,
  listAdminUsers,
  listStaff,
  unbanAdminUser,
  updateAdminUser,
} from "@/lib/api-client";
import {
  categoryLabels,
  categoryOrder,
  priorityLabels,
  priorityOrder,
  roleLabels,
  roleTones,
  userStatusLabels,
  userStatusTones,
} from "@/lib/labels";
import { PasswordInput } from "@/components/password-input";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Field,
  Input,
  Select,
  SkeletonRows,
} from "@/components/ui";
import type { Column } from "@/components/ui";

const ROLES: UserRole[] = ["STUDENT", "STAFF", "ADMIN"];
const STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE"];

/** Campos que sólo existen cuando la cuenta es de personal. */
type StaffFields = {
  area: string;
  phone: string;
  category: IncidentCategory;
  minPriority: PriorityLevel;
};

const EMPTY_STAFF: StaffFields = {
  area: "",
  phone: "",
  category: "INFRASTRUCTURE",
  minPriority: "MEDIUM",
};

export function UsersSection() {
  const { confirm, dialog } = useConfirm();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("STUDENT");
  const [editStatus, setEditStatus] = useState<UserStatus>("ACTIVE");
  const [editPassword, setEditPassword] = useState("");
  const [editStaff, setEditStaff] = useState<StaffFields>(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);

  const [newCampusId, setNewCampusId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("STUDENT");
  const [newStaff, setNewStaff] = useState<StaffFields>(EMPTY_STAFF);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (searchValue?: string) => {
      setLoading(true);
      setError(null);
      try {
        const [userList, staffList] = await Promise.all([
          listAdminUsers({ search: (searchValue ?? "").trim() || undefined, limit: 200, offset: 0 }),
          listStaff({ limit: 300, offset: 0 }),
        ]);
        setUsers(userList.items);
        setTotal(userList.total);
        setStaff(staffList.items);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo cargar usuarios");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // El perfil de personal se enlaza por correo: es lo único que comparten la
  // cuenta y su ficha operativa.
  const staffByEmail = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const item of staff) {
      const key = item.email.trim().toLowerCase();
      if (!map.has(key)) map.set(key, item);
    }
    return map;
  }, [staff]);

  const selectForEdit = (user: AdminUser) => {
    setSelected(user);
    setNotice(null);
    setEditName(user.full_name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword("");
    const linked = staffByEmail.get(user.email.trim().toLowerCase());
    setEditStaff(
      linked
        ? {
            area: linked.area_name,
            phone: linked.phone_number ?? "",
            category: linked.category,
            minPriority: linked.min_priority,
          }
        : EMPTY_STAFF,
    );
  };

  const staffPayload = (fields: StaffFields) => ({
    staff_area_name: fields.area.trim() || undefined,
    staff_phone_number: fields.phone.trim() || null,
    staff_category: fields.category,
    staff_min_priority: fields.minPriority,
  });

  const saveEdit = async () => {
    if (!selected) return;
    const accepted = await confirm({
      title: "Guardar cambios del usuario",
      message: `Se actualizarán los datos de ${selected.full_name}.`,
      warning: editPassword ? "Se establecerá una contraseña nueva para esta cuenta." : undefined,
      confirmLabel: "Guardar",
    });
    if (!accepted) return;

    setSaving(true);
    setError(null);
    try {
      await updateAdminUser(selected.id, {
        full_name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword.trim() || undefined,
        ...(editRole === "STAFF" ? staffPayload(editStaff) : {}),
      });
      setNotice(`Cuenta de ${editName.trim()} actualizada.`);
      setEditPassword("");
      await load(search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar usuario");
    } finally {
      setSaving(false);
    }
  };

  const toggleBan = async (user: AdminUser) => {
    const suspending = user.status === "ACTIVE";
    const accepted = await confirm({
      title: suspending ? "Suspender cuenta" : "Reactivar cuenta",
      message: suspending
        ? `${user.full_name} dejará de poder entrar al sistema.`
        : `${user.full_name} volverá a tener acceso.`,
      danger: suspending,
      confirmLabel: suspending ? "Suspender" : "Reactivar",
    });
    if (!accepted) return;

    setError(null);
    try {
      if (suspending) await banAdminUser(user.id);
      else await unbanAdminUser(user.id);
      setNotice(`Cuenta de ${user.full_name} ${suspending ? "suspendida" : "reactivada"}.`);
      await load(search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar el estado");
    }
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accepted = await confirm({
      title: "Crear usuario",
      message: `Se creará la cuenta ${newCampusId || "nueva"} con perfil ${roleLabels[newRole]}.`,
      confirmLabel: "Crear",
    });
    if (!accepted) return;

    setCreating(true);
    setError(null);
    try {
      await createAdminUser({
        campus_id: newCampusId.trim(),
        full_name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        ...(newRole === "STAFF" ? staffPayload(newStaff) : {}),
      });
      setNotice(`Cuenta ${newCampusId.trim()} creada.`);
      setNewCampusId("");
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("STUDENT");
      setNewStaff(EMPTY_STAFF);
      await load(search);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear usuario");
    } finally {
      setCreating(false);
    }
  };

  const columns: Array<Column<AdminUser>> = [
    {
      key: "campus",
      header: "Campus",
      cell: (user) => (
        <span className="grid">
          <span className="font-mono text-xs">{user.campus_id}</span>
          <span className="text-xs text-muted">{user.full_name}</span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (user) => <Badge tone={roleTones[user.role]}>{roleLabels[user.role]}</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (user) => (
        <Badge tone={userStatusTones[user.status]} dot>
          {userStatusLabels[user.status]}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      cell: (user) => (
        <span className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => selectForEdit(user)}>
            Editar
          </Button>
          <Button
            size="sm"
            variant={user.status === "ACTIVE" ? "danger" : "secondary"}
            onClick={() => toggleBan(user)}
          >
            {user.status === "ACTIVE" ? "Suspender" : "Reactivar"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <Card>
        <CardHeader
          title={`Usuarios (${total})`}
          actions={
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void load(search);
              }}
            >
              <Input
                className="h-8 w-40 text-xs"
                placeholder="Buscar…"
                aria-label="Buscar usuarios"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button size="sm" type="submit" loading={loading}>
                Buscar
              </Button>
            </form>
          }
        />
        <CardBody className="grid gap-3 p-0 pb-3">
          {error ? (
            <Alert tone="danger" className="mx-4 mt-3">
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert tone="success" className="mx-4 mt-3">
              {notice}
            </Alert>
          ) : null}
          <DataTable
            caption="Cuentas del sistema"
            columns={columns}
            rows={users}
            rowKey={(user) => user.id}
            onSelect={selectForEdit}
            selectedKey={selected?.id ?? null}
            rowLabel={(user) => `Editar a ${user.full_name}`}
            loading={loading ? <SkeletonRows rows={6} columns={columns.length} /> : null}
            empty="Ninguna cuenta coincide con la búsqueda."
          />
        </CardBody>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader title="Crear usuario" />
          <CardBody>
            <form className="grid gap-3.5" onSubmit={createUser}>
              <Field label="Código campus">
                {({ id }) => (
                  <Input
                    id={id}
                    value={newCampusId}
                    onChange={(event) => setNewCampusId(event.target.value)}
                    placeholder="u20260001"
                    required
                  />
                )}
              </Field>
              <Field label="Nombre completo">
                {({ id }) => (
                  <Input
                    id={id}
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    required
                  />
                )}
              </Field>
              <Field label="Correo">
                {({ id }) => (
                  <Input
                    id={id}
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    required
                  />
                )}
              </Field>
              <Field label="Contraseña" hint="Al menos 8 caracteres.">
                {({ id }) => (
                  <PasswordInput
                    id={id}
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                )}
              </Field>
              <Field label="Rol">
                {({ id }) => (
                  <Select
                    id={id}
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value as UserRole)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {/* Los datos operativos sólo aparecen cuando la cuenta es de
                  personal: antes había que saber que existían. */}
              {newRole === "STAFF" ? (
                <StaffFieldset value={newStaff} onChange={setNewStaff} />
              ) : null}

              <Button type="submit" loading={creating}>
                Crear cuenta
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Editar usuario"
            description={selected ? selected.campus_id : "Elige una fila del listado."}
          />
          <CardBody>
            {!selected ? (
              <p className="text-sm text-muted">Ninguna cuenta seleccionada.</p>
            ) : (
              <div className="grid gap-3.5">
                <Field label="Nombre completo">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Correo">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Rol">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={editRole}
                      onChange={(event) => setEditRole(event.target.value as UserRole)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Estado de la cuenta">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={editStatus}
                      onChange={(event) => setEditStatus(event.target.value as UserStatus)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {userStatusLabels[status]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {editRole === "STAFF" ? (
                  <StaffFieldset value={editStaff} onChange={setEditStaff} />
                ) : null}
                <Field label="Nueva contraseña" optional hint="Déjalo vacío para no cambiarla.">
                  {({ id, describedBy }) => (
                    <PasswordInput
                      id={id}
                      aria-describedby={describedBy}
                      minLength={8}
                      value={editPassword}
                      onChange={(event) => setEditPassword(event.target.value)}
                    />
                  )}
                </Field>
                <Button onClick={saveEdit} loading={saving}>
                  Guardar cambios
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {dialog}
    </div>
  );
}

/** Datos que sólo tiene sentido pedir cuando la cuenta es de personal. */
function StaffFieldset({
  value,
  onChange,
}: {
  value: StaffFields;
  onChange: (next: StaffFields) => void;
}) {
  return (
    <fieldset className="grid gap-3.5 rounded-lg border border-line bg-sunken p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
        Perfil operativo
      </legend>
      <Field label="Área">
        {({ id }) => (
          <Input
            id={id}
            value={value.area}
            onChange={(event) => onChange({ ...value, area: event.target.value })}
            placeholder="Seguridad UCH"
            required
          />
        )}
      </Field>
      <Field label="Teléfono" optional>
        {({ id }) => (
          <Input
            id={id}
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
          />
        )}
      </Field>
      <Field label="Categoría que atiende">
        {({ id }) => (
          <Select
            id={id}
            value={value.category}
            onChange={(event) =>
              onChange({ ...value, category: event.target.value as IncidentCategory })
            }
          >
            {categoryOrder.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Prioridad mínima" hint="No recibirá incidencias por debajo de este nivel.">
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={value.minPriority}
            onChange={(event) =>
              onChange({ ...value, minPriority: event.target.value as PriorityLevel })
            }
          >
            {priorityOrder.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </fieldset>
  );
}
