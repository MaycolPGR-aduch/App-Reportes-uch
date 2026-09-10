"use client";

import { useMemo, useState } from "react";
import type { CampusZone } from "@/lib/api-client";
import { geoJSONAVertices, type Vertice } from "@/lib/geo";
import { cx } from "@/components/ui";

/*
 * Plano del campus dibujado desde los propios polígonos de zona.
 *
 * No lleva mapa base ni servidor de teselas: el encuadre sale de las zonas
 * registradas, así que funciona sin conexión —la aplicación es una PWA— y no
 * manda la posición del campus a ningún tercero. A cambio no hay calles ni
 * fotografía aérea; para eso haría falta Leaflet y un proveedor de teselas.
 */

const VIEW = { width: 720, height: 440, pad: 26 };

type Punto = { x: number; y: number };

/**
 * Proyección equirectangular con corrección por latitud.
 *
 * A escala de campus —cientos de metros— la Tierra es plana a todos los
 * efectos; lo único que hay que corregir es que un grado de longitud mide
 * menos que uno de latitud, y ese factor es el coseno de la latitud media.
 * Sin la corrección el campus sale estirado en horizontal.
 */
function crearProyeccion(vertices: Vertice[]) {
  const lats = vertices.map((v) => v.lat);
  const lngs = vertices.map((v) => v.lng);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  const latMedia = (latMin + latMax) / 2;
  const factorLng = Math.cos((latMedia * Math.PI) / 180);

  const anchoGeo = Math.max((lngMax - lngMin) * factorLng, 1e-9);
  const altoGeo = Math.max(latMax - latMin, 1e-9);

  const anchoUtil = VIEW.width - VIEW.pad * 2;
  const altoUtil = VIEW.height - VIEW.pad * 2;
  // Una sola escala para los dos ejes: escalarlos por separado deformaría las
  // zonas y un patio cuadrado dejaría de parecerlo.
  const escala = Math.min(anchoUtil / anchoGeo, altoUtil / altoGeo);

  const sobranteX = anchoUtil - anchoGeo * escala;
  const sobranteY = altoUtil - altoGeo * escala;

  const proyectar = (vertice: Vertice): Punto => ({
    x: VIEW.pad + sobranteX / 2 + (vertice.lng - lngMin) * factorLng * escala,
    // La latitud crece hacia el norte y la Y de SVG hacia abajo: se invierte.
    y: VIEW.pad + sobranteY / 2 + (latMax - vertice.lat) * escala,
  });

  const desproyectar = (punto: Punto): Vertice => ({
    lat: latMax - (punto.y - VIEW.pad - sobranteY / 2) / escala,
    lng: lngMin + (punto.x - VIEW.pad - sobranteX / 2) / (factorLng * escala),
    accuracy: null,
  });

  return { proyectar, desproyectar };
}

function centroide(puntos: Punto[]): Punto {
  const suma = puntos.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: suma.x / puntos.length, y: suma.y / puntos.length };
}

/** Área en píxeles del plano; decide si cabe la etiqueta dentro de la zona. */
function areaAproximada(puntos: Punto[]): number {
  let total = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    total += a.x * b.y - b.x * a.y;
  }
  return Math.abs(total / 2);
}

/** Cinco peldaños de la rampa secuencial, más el cero. */
function pasoDeRampa(valor: number, maximo: number): number {
  if (valor <= 0) return 0;
  if (maximo <= 0) return 1;
  return Math.min(5, Math.max(1, Math.ceil((valor / maximo) * 5)));
}

export function CampusMap({
  zones,
  /** Recuento por nombre de zona; activa el sombreado por intensidad. */
  counts,
  selectedId,
  onSelect,
  /** Vértices en construcción. Con esta prop el plano acepta clics. */
  draft,
  onDraftPoint,
  className,
}: {
  zones: CampusZone[];
  counts?: Map<string, number>;
  selectedId?: string | null;
  onSelect?: (zone: CampusZone) => void;
  draft?: Vertice[];
  onDraftPoint?: (vertice: Vertice) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const dibujadas = useMemo(
    () =>
      zones
        .map((zone) => ({ ...zone, vertices: geoJSONAVertices(zone.polygon_geojson) }))
        .filter((zone) => zone.vertices.length >= 3),
    [zones],
  );

  const todos = useMemo(() => {
    const vertices = dibujadas.flatMap((zone) => zone.vertices);
    return draft && draft.length > 0 ? [...vertices, ...draft] : vertices;
  }, [dibujadas, draft]);

  const proyeccion = useMemo(() => (todos.length > 0 ? crearProyeccion(todos) : null), [todos]);

  const maximo = useMemo(() => {
    if (!counts) return 0;
    return Math.max(0, ...dibujadas.map((zone) => counts.get(zone.name) ?? 0));
  }, [counts, dibujadas]);

  if (!proyeccion) {
    return (
      <div
        className={cx(
          "grid place-items-center rounded-lg border border-dashed border-line bg-sunken px-6 py-12 text-center",
          className,
        )}
      >
        <p className="text-sm font-medium text-ink">Todavía no hay zonas dibujadas</p>
        <p className="mt-1 max-w-sm text-xs text-muted">
          El plano se construye con los polígonos registrados. Crea una zona para verla aquí.
        </p>
      </div>
    );
  }

  const { proyectar, desproyectar } = proyeccion;
  const draftPuntos = (draft ?? []).map(proyectar);

  const manejarClic = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!onDraftPoint) return;
    const caja = event.currentTarget.getBoundingClientRect();
    // Del píxel de pantalla al sistema del viewBox, y de ahí a coordenadas.
    const x = ((event.clientX - caja.left) / caja.width) * VIEW.width;
    const y = ((event.clientY - caja.top) / caja.height) * VIEW.height;
    onDraftPoint(desproyectar({ x, y }));
  };

  return (
    <div className={cx("grid gap-2", className)}>
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className={cx(
          "w-full rounded-lg border border-line bg-sunken",
          onDraftPoint && "cursor-crosshair",
        )}
        role="img"
        aria-label={`Plano del campus con ${dibujadas.length} zonas${
          counts ? "; el sombreado indica cuántas incidencias tiene cada una" : ""
        }.`}
        onClick={manejarClic}
        onMouseLeave={() => setHovered(null)}
      >
        {dibujadas.map((zone) => {
          const puntos = zone.vertices.map(proyectar);
          const d = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";
          const recuento = counts?.get(zone.name) ?? 0;
          const paso = counts ? pasoDeRampa(recuento, maximo) : 0;
          const activa = selectedId === zone.id;
          const resaltada = hovered === zone.id;
          const centro = centroide(puntos);
          const cabeEtiqueta = areaAproximada(puntos) > 2600;
          const titulo =
            zone.name +
            (counts ? ` · ${recuento} incidencia${recuento === 1 ? "" : "s"}` : "") +
            (zone.is_active ? "" : " · inactiva");

          return (
            <g key={zone.id}>
              <path
                d={d}
                fill={counts ? `var(--choro-${paso})` : "var(--brand-soft)"}
                fillOpacity={zone.is_active ? 1 : 0.35}
                stroke={activa ? "var(--brand)" : "var(--border-strong)"}
                strokeWidth={activa ? 3 : resaltada ? 2 : 1.25}
                // Una zona desactivada se dibuja a trazos: sigue estando, pero
                // no recibe incidencias, y eso debe verse sin leer la tabla.
                strokeDasharray={zone.is_active ? undefined : "6 4"}
                vectorEffect="non-scaling-stroke"
                className={cx(onSelect && "cursor-pointer")}
                onMouseEnter={() => setHovered(zone.id)}
                onClick={(event) => {
                  if (!onSelect) return;
                  event.stopPropagation();
                  onSelect(zone);
                }}
              >
                {/* Una sola cadena, no varios hijos: el analizador de SVG
                    del navegador funde los nodos de texto contiguos en uno y
                    el HTML del servidor deja de coincidir con el del cliente. */}
                <title>{titulo}</title>
              </path>

              {cabeEtiqueta ? (
                <text
                  x={centro.x}
                  y={centro.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none text-[11px] font-semibold"
                  // El texto va sobre el relleno: en los peldaños oscuros de la
                  // rampa el color de tinta normal no tendría contraste.
                  fill={paso >= 3 ? "var(--choro-ink)" : "var(--text-strong)"}
                >
                  {zone.code ?? zone.name}
                </text>
              ) : null}
            </g>
          );
        })}

        {draftPuntos.length > 0 ? (
          <g>
            <path
              d={
                draftPuntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") +
                (draftPuntos.length > 2 ? " Z" : "")
              }
              fill="var(--tone-warning-bg)"
              fillOpacity={0.65}
              stroke="var(--tone-warning-solid)"
              strokeWidth="2.5"
              strokeDasharray="7 4"
              vectorEffect="non-scaling-stroke"
            />
            {draftPuntos.map((punto, index) => (
              <circle
                key={index}
                cx={punto.x}
                cy={punto.y}
                r="4.5"
                fill="var(--tone-warning-solid)"
                stroke="var(--surface-raised)"
                strokeWidth="2"
              />
            ))}
          </g>
        ) : null}
      </svg>

      {counts && maximo > 0 ? (
        <div className="flex items-center justify-end gap-2 text-[0.68rem] text-muted">
          <span>Menos</span>
          <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((paso) => (
              <span
                key={paso}
                className="size-3 rounded-[2px]"
                style={{ backgroundColor: `var(--choro-${paso})` }}
              />
            ))}
          </span>
          <span>Más ({maximo} incidencias)</span>
        </div>
      ) : null}
    </div>
  );
}
