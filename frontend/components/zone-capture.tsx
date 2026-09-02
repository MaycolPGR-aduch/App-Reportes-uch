"use client";

import { useEffect, useRef, useState } from "react";
import { CampusZone } from "@/lib/api-client";
import {
  Vertice,
  distanciaM,
  geoJSONAVertices,
  proyectar,
  seAutointersecta,
  superficieM2,
  verticesAGeoJSON,
  zonasSolapadas,
} from "@/lib/geo";

/** Segundos que se promedian por vértice. Una sola lectura de GPS baila varios
 *  metros; promediar mientras se está quieto reduce bastante ese error. */
const SEGUNDOS_POR_VERTICE = 4;
/** Por encima de esta precisión el punto se avisa como poco fiable. */
const PRECISION_ACEPTABLE_M = 20;

type Props = {
  zonasExistentes: CampusZone[];
  /** Zona a recapturar; si se omite, se captura una nueva. */
  zonaEnEdicion?: CampusZone | null;
  onGuardar: (poligono: Record<string, unknown>) => Promise<void> | void;
  guardando?: boolean;
};

export function ZoneCapture({ zonasExistentes, zonaEnEdicion, onGuardar, guardando }: Props) {
  // Se inicializa una sola vez: el padre remonta el componente con `key` cuando
  // cambia la zona, en vez de sincronizar el estado desde un efecto.
  const [vertices, setVertices] = useState<Vertice[]>(() =>
    zonaEnEdicion ? geoJSONAVertices(zonaEnEdicion.polygon_geojson) : [],
  );
  const [capturando, setCapturando] = useState(false);
  const [restante, setRestante] = useState(0);
  const [muestras, setMuestras] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const capturarVertice = () => {
    if (!navigator.geolocation) {
      setError("Este navegador no permite leer la ubicación.");
      return;
    }
    setError(null);
    setCapturando(true);
    setMuestras(0);
    setRestante(SEGUNDOS_POR_VERTICE);

    const lecturas: Vertice[] = [];
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        lecturas.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
        setMuestras(lecturas.length);
      },
      (err) => {
        setError(`No se pudo leer la ubicación: ${err.message}`);
        detener(id);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
    watchRef.current = id;

    const cuenta = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);

    setTimeout(() => {
      clearInterval(cuenta);
      detener(id);
      if (lecturas.length === 0) {
        setError("No llegó ninguna lectura de ubicación. Comprueba el permiso y la señal.");
        return;
      }
      const promedio: Vertice = {
        lat: lecturas.reduce((s, l) => s + l.lat, 0) / lecturas.length,
        lng: lecturas.reduce((s, l) => s + l.lng, 0) / lecturas.length,
        accuracy:
          lecturas.reduce((s, l) => s + (l.accuracy ?? 0), 0) / lecturas.length || null,
      };
      setVertices((actuales) => [...actuales, promedio]);
    }, SEGUNDOS_POR_VERTICE * 1000);
  };

  const detener = (id: number) => {
    navigator.geolocation.clearWatch(id);
    watchRef.current = null;
    setCapturando(false);
    setRestante(0);
  };

  const zonasParaComparar = zonasExistentes
    .filter((z) => z.is_active && z.id !== zonaEnEdicion?.id)
    .map((z) => ({ name: z.name, vertices: geoJSONAVertices(z.polygon_geojson) }))
    .filter((z) => z.vertices.length >= 3);

  const superficie = superficieM2(vertices);
  const cruzado = seAutointersecta(vertices);
  const solapadas = zonasSolapadas(vertices, zonasParaComparar);
  const imprecisos = vertices.filter(
    (v) => v.accuracy !== null && v.accuracy > PRECISION_ACEPTABLE_M,
  ).length;
  const suficientes = vertices.length >= 3;

  const ANCHO = 460;
  const ALTO = 300;
  // El encuadre lo manda lo que se esta capturando, no las zonas ya guardadas.
  //
  // Antes entraban todas en el ajuste, y bastaba una zona a un kilometro para
  // que un recorrido de 74 m quedase reducido a 13 px; a tres kilometros, a
  // cinco. En pantalla se veian puntos sueltos sin poligono, y el fallo no se
  // noto mientras la base estuvo vacia: aparecio justo al arreglar el guardado.
  //
  // Las zonas existentes se siguen dibujando en esta misma proyeccion, asi que
  // las vecinas aparecen como contexto y lo que quede fuera lo recorta el SVG.
  const proyectarPunto = proyectar(
    vertices.length > 0 ? [vertices] : zonasParaComparar.map((z) => z.vertices),
    ANCHO,
    ALTO,
  );
  const aRuta = (vs: Vertice[]) =>
    vs.map((v, i) => `${i === 0 ? "M" : "L"} ${proyectarPunto(v).x.toFixed(1)} ${proyectarPunto(v).y.toFixed(1)}`).join(" ") + " Z";

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold">
          {zonaEnEdicion ? `Recapturar «${zonaEnEdicion.name}»` : "Capturar zona caminando"}
        </h3>
        <p className="text-xs text-slate-500">
          Colócate en cada esquina de la zona y pulsa el botón. Quédate quieto los{" "}
          {SEGUNDOS_POR_VERTICE} segundos que dura la lectura.
        </p>
      </div>

      <button
        type="button"
        onClick={capturarVertice}
        disabled={capturando}
        className="rounded-xl bg-emerald-700 px-4 py-4 text-base font-semibold text-white disabled:opacity-70"
      >
        {capturando
          ? `Midiendo... ${restante}s · ${muestras} lectura(s)`
          : `Capturar este vértice (${vertices.length} registrados)`}
      </button>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      {vertices.length > 0 ? (
        <div className="grid gap-1 rounded-lg border border-[var(--line)] p-2">
          {vertices.map((v, i) => (
            <div key={`${v.lat}-${v.lng}-${i}`} className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-600">
                {i + 1}. {v.lat.toFixed(6)}, {v.lng.toFixed(6)}
                {v.accuracy !== null ? (
                  <span className={v.accuracy > PRECISION_ACEPTABLE_M ? "text-red-600" : "text-slate-400"}>
                    {" "}· ±{Math.round(v.accuracy)} m
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setVertices((vs) => vs.filter((_, idx) => idx !== i))}
                className="rounded border border-[var(--line)] px-2 py-0.5 text-slate-600"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVertices([])}
            className="mt-1 w-fit rounded border border-[var(--line)] px-2 py-1 text-xs"
          >
            Empezar de nuevo
          </button>
        </div>
      ) : null}

      {suficientes ? (
        <div className="grid gap-2">
          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            className="w-full rounded-lg border border-[var(--line)] bg-slate-50"
            role="img"
            aria-label="Vista previa de la zona capturada"
          >
            {zonasParaComparar.map((z) => (
              <path
                key={z.name}
                d={aRuta(z.vertices)}
                fill="rgba(100,116,139,.12)"
                stroke="#94a3b8"
                strokeWidth={1}
              />
            ))}
            <path
              d={aRuta(vertices)}
              fill="rgba(5,150,105,.18)"
              stroke={cruzado ? "#dc2626" : "#047857"}
              strokeWidth={2}
            />
            {vertices.map((v, i) => {
              const p = proyectarPunto(v);
              return (
                <g key={`p-${i}`}>
                  <circle cx={p.x} cy={p.y} r={4} fill="#047857" />
                  <text x={p.x + 6} y={p.y - 5} fontSize={10} fill="#334155">
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="grid gap-1 text-xs">
            <p className="text-slate-700">
              Superficie aproximada: <strong>{Math.round(superficie).toLocaleString()} m²</strong> ·
              perímetro {Math.round(
                vertices.reduce(
                  (s, v, i) => s + distanciaM(v, vertices[(i + 1) % vertices.length]),
                  0,
                ),
              )} m
            </p>
            {cruzado ? (
              <p className="rounded bg-red-50 px-2 py-1 text-red-700">
                El polígono se cruza consigo mismo. Revisa el orden de los vértices: deben
                recorrerse siguiendo el perímetro, sin saltar de una esquina a la opuesta.
              </p>
            ) : null}
            {imprecisos > 0 ? (
              <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                {imprecisos} vértice(s) con precisión peor de {PRECISION_ACEPTABLE_M} m. Puedes
                quitarlos y volver a medirlos con mejor señal.
              </p>
            ) : null}
            {solapadas.length > 0 ? (
              <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                Se solapa con: <strong>{solapadas.join(", ")}</strong>. No impide guardar; el
                sistema resuelve el solape por prioridad y superficie.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void onGuardar(verticesAGeoJSON(vertices))}
            disabled={guardando || cruzado}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {guardando
              ? "Guardando..."
              : zonaEnEdicion
                ? "Guardar el polígono recapturado"
                : "Usar este polígono"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Se necesitan al menos 3 vértices para formar una zona.
        </p>
      )}
    </div>
  );
}
