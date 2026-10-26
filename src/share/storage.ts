/**
 * The localStorage layer, and the only place localStorage is touched.
 *
 * **Nothing here throws.** Private modes throw on write, blocked site data throws on read, and some
 * embedded contexts throw on the property access itself.
 *
 * **Everything read back is untrusted.** Every read takes a parser and returns null rather than
 * an unvalidated value; bad data is discarded, never repaired.
 */

/** The slice of the Storage API used here — injectable, so tests need no DOM. */
export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const NAMESPACE = "coutada";

export const keyFor = (name: string): string => `${NAMESPACE}:${name}`;

/** The browser's store, or null where there is none. Resolved per call: the access itself can throw. */
export function browserStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function read<T>(
  store: Store | null,
  key: string,
  parse: (raw: unknown) => T | null,
): T | null {
  if (!store) return null;
  let text: string | null;
  try {
    text = store.getItem(key);
  } catch {
    return null;
  }
  if (text === null) return null;

  try {
    return parse(JSON.parse(text));
  } catch {
    return null;
  }
}

/** True if the value was stored. False covers a full quota as well as no store. */
export function write(store: Store | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(store: Store | null, key: string): void {
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Nothing depends on it having happened.
  }
}

/** An in-memory Store, for tests and anywhere without a browser. */
export function memoryStore(seed: Record<string, string> = {}): Store {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
