/**
 * Destino de retorno tras iniciar sesión, tomado de `?next=`.
 *
 * Se valida porque el parámetro llega de la URL, y por tanto de quien haya
 * escrito el enlace. Sin esta comprobación, `/login?next=https://sitio-falso`
 * convierte la pantalla de acceso en un trampolín hacia cualquier dominio: la
 * víctima ve la dirección legítima, se autentica, y acaba en el sitio del
 * atacante creyendo que sigue dentro. Es la redirección abierta clásica.
 *
 * Solo se acepta una ruta interna: empieza por `/` y no por `//`, que el
 * navegador interpretaría como otro servidor.
 */
export function rutaDeRetornoSegura(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  // `//evil.com` y `/\evil.com` son direcciones absolutas para el navegador
  // aunque empiecen por una barra.
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
