/**
 * JSON responses for the API surface. Every response is `no-store`: these are per-user answers,
 * and Cloudflare's cache sits in front of the Worker.
 */

import { SECURITY_HEADERS } from "./headers";

const NO_STORE = { "cache-control": "no-store" } as const;

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** A machine-readable code, never a sentence: the Worker has no locale (D3). */
export function fail(code: string, status: number, headers: HeadersInit = {}): Response {
  return json({ error: code }, status, headers);
}

/** A response with the security headers set, whatever produced it. */
export function secured(response: Response): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(name, value);
  return out;
}

/**
 * A request's JSON object, or null when it is not one. JSON by content type, not only by parse:
 * a cross-site form can POST a JSON-shaped `text/plain` body without a preflight, and every write
 * here acts on a cookie (pb-D109).
 */
export async function readJson(request: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown> | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return null;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) return null;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > maxBytes) return null;
    const body: unknown = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const clientIp = (request: Request): string => request.headers.get("cf-connecting-ip") ?? "unknown";

/** True when any key is over its limit. The limiter is per location and eventually consistent. */
export async function limited(limiter: RateLimit, keys: string[]): Promise<boolean> {
  for (const key of keys) {
    const { success } = await limiter.limit({ key });
    if (!success) return true;
  }
  return false;
}
