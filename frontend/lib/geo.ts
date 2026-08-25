/** Utilidades geométricas para capturar y previsualizar zonas del campus.
 *
 * Reflejan la convención del backend: GeoJSON almacena [longitud, latitud], en
 * ese orden. Invertirlos es el error clásico y silencioso de este formato, así
 * que aquí se usa el tipo `Vertice` con nombres explícitos y la conversión
 * ocurre en un único sitio.
 */

export type Vertice = {
  lat: number;
  lng: number;
  /** Precisión declarada por el dispositivo, en metros. */
  accuracy: number | null;
};

const METROS_POR_GRADO_LAT = 111_320;

function metrosPorGradoLng(lat: number): number {
  return METROS_POR_GRADO_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Convierte los vértices al anillo GeoJSON que espera el backend, cerrándolo. */
export function verticesAGeoJSON(vertices: Vertice[]): Record<string, unknown> {
  const anillo = vertices.map((v) => [v.lng, v.lat]);
  const primero = anillo[0];
  const ultimo = anillo[anillo.length - 1];
  if (primero && ultimo && (primero[0] !== ultimo[0] || primero[1] !== ultimo[1])) {
    anillo.push([primero[0], primero[1]]);
  }
  return { type: "Polygon", coordinates: [anillo] };
}

/** Lee el anillo exterior de un polígono GeoJSON, sin el vértice de cierre. */
export function geoJSONAVertices(poligono: unknown): Vertice[] {
  const obj = poligono as { type?: string; coordinates?: unknown };
  const coords = obj?.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const anillo = obj.type === "MultiPolygon" ? (coords[0] as number[][][])?.[0] : (coords[0] as number[][]);
  if (!Array.isArray(anillo)) return [];

  const vertices: Vertice[] = anillo
    .filter((p): p is number[] => Array.isArray(p) && p.length >= 2)
    .map((p) => ({ lng: Number(p[0]), lat: Number(p[1]), accuracy: null }));

  // El anillo repite el primer punto al final; se descarta para editar.
  if (vertices.length > 1) {
    const a = vertices[0];
    const b = vertices[vertices.length - 1];
    if (a.lat === b.lat && a.lng === b.lng) vertices.pop();
  }
  return vertices;
}

/** Superficie aproximada en metros cuadrados, por la fórmula del agrimensor. */
export function superficieM2(vertices: Vertice[]): number {
  if (vertices.length < 3) return 0;
  const latRef = vertices.reduce((suma, v) => suma + v.lat, 0) / vertices.length;
  const escalaLng = metrosPorGradoLng(latRef);

  let area = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.lng * escalaLng * (b.lat * METROS_POR_GRADO_LAT)
          - b.lng * escalaLng * (a.lat * METROS_POR_GRADO_LAT);
  }
  return Math.abs(area) / 2;
}

/** Distancia en metros entre dos puntos. */
export function distanciaM(a: Vertice, b: Vertice): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Punto dentro de polígono por proyección de rayos, igual que el backend. */
export function puntoEnPoligono(punto: Vertice, poligono: Vertice[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const a = poligono[i];
    const b = poligono[j];
    const cruza = a.lat > punto.lat !== b.lat > punto.lat;
    if (!cruza) continue;
    const x = ((b.lng - a.lng) * (punto.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (x >= punto.lng) dentro = !dentro;
  }
  return dentro;
}

function segmentosSeCruzan(p1: Vertice, p2: Vertice, p3: Vertice, p4: Vertice): boolean {
  const orientacion = (a: Vertice, b: Vertice, c: Vertice) => {
    const valor = (b.lat - a.lat) * (c.lng - b.lng) - (b.lng - a.lng) * (c.lat - b.lat);
    if (Math.abs(valor) < 1e-12) return 0;
    return valor > 0 ? 1 : 2;
  };
  const o1 = orientacion(p1, p2, p3);
  const o2 = orientacion(p1, p2, p4);
  const o3 = orientacion(p3, p4, p1);
  const o4 = orientacion(p3, p4, p2);
  return o1 !== o2 && o3 !== o4;
}

/** Detecta un polígono que se cruza consigo mismo (esquinas en orden erróneo). */
export function seAutointersecta(vertices: Vertice[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      // Los lados contiguos comparten vértice: no cuentan como cruce.
      if (i === 0 && j === n - 1) continue;
      if (segmentosSeCruzan(vertices[i], vertices[(i + 1) % n], vertices[j], vertices[(j + 1) % n])) {
        return true;
      }
    }
  }
  return false;
}

/** Nombres de las zonas existentes que se solapan con el polígono dado. */
export function zonasSolapadas(
  vertices: Vertice[],
  zonas: Array<{ name: string; vertices: Vertice[] }>,
): string[] {
  if (vertices.length < 3) return [];
  const solapadas: string[] = [];
  for (const zona of zonas) {
    if (zona.vertices.length < 3) continue;
    const hayCruce =
      vertices.some((v) => puntoEnPoligono(v, zona.vertices)) ||
      zona.vertices.some((v) => puntoEnPoligono(v, vertices));
    if (hayCruce) solapadas.push(zona.name);
  }
  return solapadas;
}

/** Proyecta coordenadas a un lienzo SVG conservando la proporción real. */
export function proyectar(
  grupos: Vertice[][],
  ancho: number,
  alto: number,
  margen = 12,
): (v: Vertice) => { x: number; y: number } {
  const todos = grupos.flat();
  if (todos.length === 0) return () => ({ x: ancho / 2, y: alto / 2 });

  const latRef = todos.reduce((s, v) => s + v.lat, 0) / todos.length;
  const escalaLng = Math.cos((latRef * Math.PI) / 180);

  const xs = todos.map((v) => v.lng * escalaLng);
  const ys = todos.map((v) => v.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const anchoUtil = ancho - margen * 2;
  const altoUtil = alto - margen * 2;
  // Una sola escala para ambos ejes: si no, el polígono saldría deformado.
  const escala = Math.min(
    anchoUtil / Math.max(maxX - minX, 1e-9),
    altoUtil / Math.max(maxY - minY, 1e-9),
  );
  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;

  return (v: Vertice) => ({
    x: ancho / 2 + (v.lng * escalaLng - centroX) * escala,
    // La latitud crece hacia el norte; el eje Y del SVG crece hacia abajo.
    y: alto / 2 - (v.lat - centroY) * escala,
  });
}
