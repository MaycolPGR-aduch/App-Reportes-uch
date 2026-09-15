"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CampusZone,
  createCampusZone,
  listCampusZones,
  listIncidents,
  updateCampusZone,
} from "@/lib/api-client";
import { geoJSONAVertices, verticesAGeoJSON, type Vertice } from "@/lib/geo";
import { readableDate } from "@/lib/labels";
import { ZoneCapture } from "@/components/zone-capture";
import { CampusMap } from "@/components/admin/campus-map";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  Field,
  Input,
  Select,
  SkeletonRows,
  Textarea,
  cx,
} from "@/components/ui";
import type { Column } from "@/components/ui";

type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";
/** Cómo se define el polígono. Antes sólo existían las dos últimas. */
type Metodo = "PLANO" | "CAMINANDO" | "GEOJSON";

const GEOJSON_EJEMPLO = `{
  "type": "Polygon",
  "coordinates": [[
    [-77.084900, -12.056000],
    [-77.084500, -12.056000],
    [-77.084500, -12.055700],
    [-77.084900, -12.055700],
    [-77.084900, -12.056000]
  ]]
}`;

function parsearGeoJSON(bruto: string): Record<string, unknown> {
  const parsed = JSON.parse(bruto) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("El GeoJSON debe ser un objeto JSON válido.");
  }
  return parsed as Record<string, unknown>;
}

/** Lee el textarea sin lanzar: sirve para precargar el plano a media edición. */
function parsearSeguro(bruto: string): unknown {
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

export function ZonesSection() {
  const { confirm, dialog } = useConfirm();

  const [zones, setZones] = useState<CampusZone[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [selected, setSelected] = useState<CampusZone | null>(null);

  const [modo, setModo] = useState<"CREAR" | "EDITAR">("CREAR");
  const [metodo, setMetodo] = useState<Metodo>("PLANO");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [priority, setPriority] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [geojson, setGeojson] = useState(GEOJSON_EJEMPLO);
  const [draft, setDraft] = useState<Vertice[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [zoneList, incidentList] = await Promise.all([
        listCampusZones({
          search: search.trim() || undefined,
          active: activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE",
          limit: 500,
          offset: 0,
        }),
        // Sirve para sombrear el plano: cuántas incidencias caen en cada zona.
        listIncidents({ limit: 100, offset: 0 }),
      ]);
      setZones(zoneList.items);
      setTotal(zoneList.total);
      const recuento = new Map<string, number>();
      for (const item of incidentList.items) {
        if (!item.location_zone_name) continue;
        recuento.set(item.location_zone_name, (recuento.get(item.location_zone_name) ?? 0) + 1);
      }
      setCounts(recuento);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las zonas");
    } finally {
      setLoading(false);
    }
    // Los filtros de texto se aplican al pulsar «Buscar», no en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const empezarCreacion = () => {
    setModo("CREAR");
    setSelected(null);
    setName("");
    setCode("");
    setPriority(100);
    setIsActive(true);
    setGeojson(GEOJSON_EJEMPLO);
    setDraft([]);
    setNotice(null);
  };

  const seleccionar = (zone: CampusZone) => {
    setModo("EDITAR");
    setSelected(zone);
    setName(zone.name);
    setCode(zone.code ?? "");
    setPriority(zone.priority);
    setIsActive(zone.is_active);
    setGeojson(JSON.stringify(zone.polygon_geojson, null, 2));
    setDraft([]);
    setNotice(null);
  };

  /* El plano y el área de texto son dos vistas del mismo polígono: al añadir
     un punto se reescribe el GeoJSON, que es lo único que viaja al servidor. */
  const anadirPunto = (vertice: Vertice) => {
    const siguiente = [...draft, vertice];
    setDraft(siguiente);
    if (siguiente.length >= 3) setGeojson(JSON.stringify(verticesAGeoJSON(siguiente), null, 2));
  };

  const deshacerPunto = () => {
    const siguiente = draft.slice(0, -1);
    setDraft(siguiente);
    if (siguiente.length >= 3) setGeojson(JSON.stringify(verticesAGeoJSON(siguiente), null, 2));
  };

  // Al editar, el polígono guardado se precarga como borrador para retocarlo
  // sobre el plano en vez de tener que redibujarlo entero.
  const cargarEnPlano = () => {
    setDraft(geoJSONAVertices(parsearSeguro(geojson)));
    setMetodo("PLANO");
  };

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const creando = modo === "CREAR";
    const accepted = await confirm({
      title: creando ? "Crear zona del campus" : "Guardar cambios de la zona",
      message: creando
        ? `Se creará la zona ${name || "nueva"} con el polígono indicado.`
        : `Se actualizará ${selected?.name ?? "la zona"}.`,
      warning: "Un polígono incorrecto hace que los reportes se ubiquen mal.",
      confirmLabel: creando ? "Crear" : "Guardar",
    });
    if (!accepted) return;

    setSaving(true);
    setError(null);
    try {
      const polygon = parsearGeoJSON(geojson);
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        priority: Number(priority),
        polygon_geojson: polygon,
        is_active: isActive,
      };
      if (creando) {
        await createCampusZone(payload);
        setNotice(`Zona ${payload.name} creada.`);
        empezarCreacion();
      } else if (selected) {
        await updateCampusZone(selected.id, payload);
        setNotice(`Zona ${payload.name} actualizada.`);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la zona");
    } finally {
      setSaving(false);
    }
  };

  const columns: Array<Column<CampusZone>> = useMemo(
    () => [
      {
        key: "name",
        header: "Zona",
        cell: (zone) => (
          <span className="grid">
            <span>{zone.name}</span>
            <span className="font-mono text-xs text-muted">{zone.code ?? "sin código"}</span>
          </span>
        ),
      },
      {
        key: "incidents",
        header: "Incid.",
        numeric: true,
        cell: (zone) => counts.get(zone.name) ?? 0,
      },
      { key: "priority", header: "Prioridad", numeric: true, cell: (zone) => zone.priority },
      {
        key: "state",
        header: "Estado",
        cell: (zone) => (
          <Badge tone={zone.is_active ? "success" : "neutral"} dot>
            {zone.is_active ? "Activa" : "Inactiva"}
          </Badge>
        ),
      },
      {
        key: "updated",
        header: "Actualizada",
        cell: (zone) => <span className="text-xs text-muted">{readableDate(zone.updated_at)}</span>,
      },
    ],
    [counts],
  );

  return (
    <div className="grid gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardHeader
          title="Plano del campus"
          description="Sombreado según cuántas incidencias recientes cayeron en cada zona. Pulsa una para editarla."
        />
        <CardBody>
          <CampusMap
            zones={zones}
            counts={counts}
            selectedId={selected?.id ?? null}
            onSelect={seleccionar}
            draft={metodo === "PLANO" ? draft : undefined}
            onDraftPoint={metodo === "PLANO" ? anadirPunto : undefined}
          />
          {metodo === "PLANO" ? (
            <p className="mt-2 text-xs text-muted">
              Pulsa sobre el plano para ir marcando los vértices del polígono.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={`Zonas del campus (${total})`}
            actions={
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void load();
                }}
              >
                <Input
                  className="h-8 w-32 text-xs"
                  placeholder="Buscar…"
                  aria-label="Buscar zonas"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Select
                  className="h-8 w-auto text-xs"
                  aria-label="Filtrar por estado"
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
                >
                  <option value="ALL">Todas</option>
                  <option value="ACTIVE">Activas</option>
                  <option value="INACTIVE">Inactivas</option>
                </Select>
                <Button size="sm" type="submit" loading={loading}>
                  Buscar
                </Button>
              </form>
            }
          />
          <CardBody className="p-0 pb-3">
            <DataTable
              caption="Zonas registradas"
              columns={columns}
              rows={zones}
              rowKey={(zone) => zone.id}
              onSelect={seleccionar}
              selectedKey={selected?.id ?? null}
              rowLabel={(zone) => `Editar la zona ${zone.name}`}
              loading={loading ? <SkeletonRows rows={6} columns={columns.length} /> : null}
              empty="Ninguna zona coincide con estos filtros."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={modo === "CREAR" ? "Crear zona" : `Editar ${selected?.name ?? "zona"}`}
            actions={
              modo === "EDITAR" ? (
                <Button size="sm" variant="secondary" onClick={empezarCreacion}>
                  Crear una nueva
                </Button>
              ) : null
            }
          />
          <CardBody>
            <form className="grid gap-3.5" onSubmit={guardar}>
              <Field label="Nombre">
                {({ id }) => (
                  <Input
                    id={id}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Pabellón A"
                    required
                  />
                )}
              </Field>
              <Field label="Código" optional hint="Es lo que se rotula en el plano.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="PAB_A"
                  />
                )}
              </Field>
              <Field label="Prioridad" hint="Con zonas superpuestas gana la de número más alto.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="number"
                    min={0}
                    max={1000}
                    value={priority}
                    onChange={(event) => setPriority(Number(event.target.value))}
                  />
                )}
              </Field>
              <Checkbox
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                label="Zona activa"
                description="Una zona inactiva no se usa para ubicar reportes nuevos."
              />

              <fieldset className="grid gap-2.5 rounded-lg border border-line bg-sunken p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                  Polígono
                </legend>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Método">
                  {(
                    [
                      ["PLANO", "Dibujar en el plano"],
                      ["CAMINANDO", "Capturar caminando"],
                      ["GEOJSON", "Pegar GeoJSON"],
                    ] as Array<[Metodo, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={metodo === value}
                      onClick={() => (value === "PLANO" ? cargarEnPlano() : setMetodo(value))}
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
                        metodo === value
                          ? "border-brand bg-brand-soft text-brand-text"
                          : "border-line bg-card text-muted hover:text-ink",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {metodo === "PLANO" ? (
                  <div className="grid gap-2">
                    <p className="text-xs text-muted">
                      {draft.length === 0
                        ? "Pulsa sobre el plano de arriba para marcar el primer vértice."
                        : `${draft.length} vértice${draft.length === 1 ? "" : "s"} marcado${
                            draft.length === 1 ? "" : "s"
                          }. Hacen falta al menos 3.`}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={deshacerPunto}
                        disabled={draft.length === 0}
                      >
                        Deshacer punto
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setDraft([])}
                        disabled={draft.length === 0}
                      >
                        Empezar de cero
                      </Button>
                    </div>
                  </div>
                ) : null}

                {metodo === "CAMINANDO" ? (
                  <ZoneCapture
                    key={selected?.id ?? "nueva"}
                    zonasExistentes={zones}
                    zonaEnEdicion={selected ?? undefined}
                    onGuardar={(poligono) => {
                      setGeojson(JSON.stringify(poligono, null, 2));
                      setDraft([]);
                      setNotice("Polígono capturado. Revisa el nombre y guarda la zona.");
                    }}
                  />
                ) : null}

                {metodo === "GEOJSON" ? (
                  <Textarea
                    aria-label="Polígono en formato GeoJSON"
                    className="min-h-40 font-mono text-xs"
                    value={geojson}
                    onChange={(event) => setGeojson(event.target.value)}
                    spellCheck={false}
                    required
                  />
                ) : null}
              </fieldset>

              <Button type="submit" loading={saving}>
                {modo === "CREAR" ? "Crear zona" : "Guardar cambios"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {dialog}
    </div>
  );
}
