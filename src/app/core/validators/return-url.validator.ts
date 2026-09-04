/**
 * Validador puro anti open-redirect para la `Return_URL`.
 *
 * Estas funciones no dependen de Angular para poder probarse de forma aislada.
 * Sólo se consideran seguras las rutas internas relativas: comienzan con `/`,
 * no con `//` (URL relativa al protocolo), no contienen esquema ni host, y no
 * usan `\` como separador que ciertos navegadores normalizan a `/`.
 */

/**
 * Determina si una URL candidata es una ruta interna relativa segura.
 *
 * Acepta únicamente cadenas que:
 * - No son nulas ni vacías (ni sólo espacios en blanco).
 * - Comienzan con un único `/` (ruta absoluta interna).
 * - No comienzan con `//` ni `/\` (URL relativa al protocolo / host externo).
 * - No contienen un esquema (`javascript:`, `http:`, `data:`, etc.).
 * - No contienen caracteres de control ni saltos de línea.
 *
 * @param url La URL candidata a validar.
 * @returns `true` si es una ruta interna relativa segura; `false` en cualquier otro caso.
 */
export function isInternalReturnUrl(url: string | null): boolean {
  if (url === null || url === undefined) {
    return false;
  }

  // Sin recorte previo: los espacios/tabuladores al inicio invalidan la ruta.
  if (url.length === 0) {
    return false;
  }

  // Debe comenzar por una barra (ruta absoluta interna).
  if (url.charAt(0) !== '/') {
    return false;
  }

  // Rechazar URL relativas al protocolo o host externo: '//host', '/\host'.
  const second = url.charAt(1);
  if (second === '/' || second === '\\') {
    return false;
  }

  // Rechazar caracteres de control (incluye \n, \r, \t y NUL) que podrían
  // usarse para evadir la validación o inyectar cabeceras/navegación.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) {
    return false;
  }

  // Rechazar cualquier esquema explícito (p. ej. 'javascript:', 'http:').
  // Un esquema válido nunca puede aparecer tras una barra inicial, pero se
  // comprueba de forma defensiva por si la cadena contuviera 'scheme:' embebido
  // antes de un separador de ruta.
  const schemeIndex = url.indexOf(':');
  if (schemeIndex !== -1) {
    const beforeScheme = url.slice(0, schemeIndex);
    // Si el fragmento previo a los dos puntos parece un esquema (sin '/'),
    // se rechaza. Como la cadena empieza por '/', esto sólo bloquea casos
    // anómalos como '/foo:bar' cuando 'foo' no contiene barra.
    if (!beforeScheme.includes('/')) {
      return false;
    }
  }

  return true;
}

/**
 * Resuelve la `Return_URL` a una ruta de navegación segura.
 *
 * @param url La `Return_URL` candidata (puede ser nula, externa o inválida).
 * @param fallback La ruta interna por defecto a usar cuando `url` no es válida (p. ej. `/feed`).
 * @returns La ruta interna validada, o `fallback` en cualquier otro caso.
 */
export function resolveReturnUrl(url: string | null, fallback: string): string {
  return isInternalReturnUrl(url) ? (url as string) : fallback;
}
