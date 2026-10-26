/** Reading and writing the app's cookies: HttpOnly, Secure, SameSite=Lax, always. */

/** One cookie out of a Cookie header; only the first `=` splits, as a value may contain more. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * `SameSite=Lax` rather than `Strict`: the cookie must survive a link opened from elsewhere, a
 * top-level navigation, and it is still withheld from cross-site POSTs.
 */
export function cookie(name: string, value: string, maxAgeS: number, path = "/"): string {
  return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`;
}

export const clearedCookie = (name: string, path = "/"): string => cookie(name, "", 0, path);
