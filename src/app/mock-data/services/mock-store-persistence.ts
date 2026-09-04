/**
 * Small, SSR-safe localStorage helper for the signal-backed mock stores.
 *
 * The mock services (`MockItemService`, `MockTaskService`) keep their state in
 * Angular signals that live only in memory, so a full page reload (F5) wipes
 * everything. This helper lets those services hydrate their signals on
 * construction and persist on every mutation, mirroring the try/catch,
 * `typeof localStorage` guarded pattern already used by `TokenStorageService`
 * and `ThemeService`.
 *
 * It is intentionally generic: it reads/writes JSON arrays and never throws,
 * so a corrupted or unavailable store degrades gracefully to an empty array.
 */

/** True when the browser localStorage API is usable (guards SSR / prerender). */
function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/**
 * Read a JSON array from localStorage. Returns `[]` when the key is absent, the
 * storage is unavailable, or the stored value is missing / malformed / not an
 * array — the store can never crash on bad data.
 */
export function readArray<T>(key: string): T[] {
  if (!hasLocalStorage()) {
    return [];
  }
  const raw = localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist a JSON array to localStorage. A quota / serialization failure is
 * swallowed: persistence is best-effort for these mock stores and must never
 * break the in-memory flow.
 */
export function writeArray<T>(key: string, value: T[]): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort: ignore quota or serialization errors.
  }
}

/**
 * Derive the next monotonic id counter from a set of existing ids that follow
 * the `${prefix}${n}` convention (e.g. `item-3`, `task-12`). Returns the max
 * numeric suffix found + 1, or 1 when none match — so ids stay unique after a
 * reload hydrates pre-existing records.
 */
export function nextIdFrom(ids: string[], prefix: string): number {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) {
      continue;
    }
    const suffix = Number(id.slice(prefix.length));
    if (Number.isInteger(suffix) && suffix > max) {
      max = suffix;
    }
  }
  return max + 1;
}
