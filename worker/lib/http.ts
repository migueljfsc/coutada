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
