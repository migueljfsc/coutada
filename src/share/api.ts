/**
 * The Worker's API from the browser. JSON in and out, same-origin cookies; a failure is a code the
 * UI turns into words, never a thrown error. No connection is `network`.
 */

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: Record<string, unknown> };

export async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok) return { ok: true, status: response.status, data: (data ?? {}) as T };
  return { ok: false, status: response.status, error: typeof data?.error === "string" ? data.error : "unknown", data: data ?? undefined };
}

export type Me = {
  user: { id: string; email: string; displayName: string | null; admin?: boolean } | null;
  device: { username: string } | null;
  claimable: { maps: number } | null;
};

export type MapSummary = { id: string; name: string; version: number; share_slug: string | null; updated_at: number };
