/**
 * Anonymous usage counters (D26, pb-D119): one number per UTC day and event, for the operator's
 * view. Most use has no account behind it, so anyone may bump one: the Worker's one
 * unauthenticated write, kept from spending the free tier by a fixed event list, a rate limit
 * keyed by the caller's address (read for the limit, never stored), and a cap on every row.
 */

import { clientIp, fail, json, readJson } from "./http";

/** Every event there is; the browser's list in src/share/usage.ts mirrors it. */
export const USAGE_EVENTS = [
  "page.map",
  "page.shared",
  "page.hunt",
  "hunt.montaria",
  "hunt.salto",
  "hunt.join",
  "share.live",
  "offline.download",
  "import.gpx",
  "import.kml",
  "import.geojson",
  "export.gpx",
  "export.kml",
  "export.geojson",
] as const;

export type UsageEvent = (typeof USAGE_EVENTS)[number];

/** Far past a real day's traffic; a bound on what a loop can inflate. */
export const USAGE_DAILY_CAP = 10_000;

const KNOWN = new Set<string>(USAGE_EVENTS);

export const usageEvent = (raw: unknown): UsageEvent | null => (typeof raw === "string" && KNOWN.has(raw) ? (raw as UsageEvent) : null);

export const usageDay = (now: number): string => new Date(now * 1000).toISOString().slice(0, 10);

/** Adds one to today's count of `event`, unless the row is at its cap. */
export async function bump(env: Env, event: UsageEvent, now: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO usage_daily (day, event, n) VALUES (?1, ?2, 1)
       ON CONFLICT (day, event) DO UPDATE SET n = n + 1 WHERE n < ?3`,
  )
    .bind(usageDay(now), event, USAGE_DAILY_CAP)
    .run();
}

export async function countUsage(env: Env, request: Request, now: number): Promise<Response> {
  const event = usageEvent((await readJson(request))?.event);
  if (!event) return fail("unknown_event", 400);
  const { success } = await env.USAGE_LIMIT.limit({ key: clientIp(request) });
  if (!success) return fail("rate_limited", 429);
  await bump(env, event, now);
  return json({ ok: true });
}
