/**
 * Place search (D28): a name in, places in Portugal and Spain out, from OpenStreetMap's Nominatim.
 *
 * Through the Worker rather than from the phone, so Nominatim sees Coutada and never the person's
 * address, and so a search asked twice is answered from the cache. Nominatim's policy is one
 * request a second and no search-as-you-type: the browser searches on submit, `SEARCH_LIMIT`
 * holds each address to a pace, and answers are cached for a week.
 */

import { clientIp, fail, json } from "./http";
import { bump } from "./usage";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Coutada/1.0 (+https://coutada.migueljfsc.dev)";
export const MAX_QUERY = 100;
const CACHE_S = 7 * 24 * 60 * 60;
const LANGUAGES = new Set(["pt", "en"]);

export type Place = {
  name: string;
  /** What OpenStreetMap calls it: village, hamlet, farm, peak… */
  kind: string;
  /** Where it is: its municipality and district, and the country when it is not Portugal. */
  area: string;
  at: [number, number];
  /** West, south, east, north. */
  bbox: [number, number, number, number] | null;
};

type Row = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  boundingbox?: string[];
  address?: Record<string, string>;
};

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

/** Nominatim's rows as places, dropping any that do not hold together. Pure. */
export function toPlaces(rows: unknown): Place[] {
  if (!Array.isArray(rows)) return [];
  const out: Place[] = [];
  for (const r of rows as Row[]) {
    const at: [number, number] = [num(r.lon), num(r.lat)];
    if (!at.every(Number.isFinite)) continue;
    const name = (r.name || r.display_name?.split(",")[0] || "").trim();
    if (!name) continue;
    const a = r.address ?? {};
    const parts = [a.town ?? a.city ?? a.municipality ?? a.village, a.county ?? a.state_district ?? a.state];
    if (a.country_code && a.country_code !== "pt" && a.country) parts.push(a.country);
    const area = [...new Set(parts.filter((p): p is string => !!p && p !== name))].join(", ");
    const [s, n, w, e] = (r.boundingbox ?? []).map(Number);
    const bbox: Place["bbox"] = [w, s, e, n].every(Number.isFinite) ? [w, s, e, n] : null;
    out.push({ name, kind: r.addresstype ?? "", area, at, bbox });
  }
  return out;
}

export async function searchPlaces(env: Env, request: Request, url: URL, now: number): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  if (!q || q.length > MAX_QUERY) return fail("invalid_query", 400);
  await bump(env, "search.place", now);
  const lang = LANGUAGES.has(url.searchParams.get("lang") ?? "") ? url.searchParams.get("lang")! : "pt";

  const key = new Request(`https://places.coutada.cache/?q=${encodeURIComponent(q.toLowerCase())}&lang=${lang}`);
  const cached = await caches.default.match(key);
  if (cached) return json(await cached.json());

  const { success } = await env.SEARCH_LIMIT.limit({ key: clientIp(request) });
  if (!success) return fail("rate_limited", 429);

  const upstream = new URL(NOMINATIM);
  upstream.search = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "pt,es",
    limit: "8",
    addressdetails: "1",
    "accept-language": lang,
  }).toString();
  let rows: unknown;
  try {
    const r = await fetch(upstream, { headers: { "user-agent": USER_AGENT, referer: "https://coutada.migueljfsc.dev/" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return fail("search_unavailable", 502);
    rows = await r.json();
  } catch {
    return fail("search_unavailable", 502);
  }
  const body = { places: toPlaces(rows) };
  await caches.default.put(key, new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": `max-age=${CACHE_S}` } }));
  return json(body);
}
