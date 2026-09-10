/** Une clases ignorando `false`, `null` y `undefined`. */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
