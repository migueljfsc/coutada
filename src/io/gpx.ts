/**
 * GPX into the map (D21): tracks and routes become routes, waypoints become places. Read from the
 * file's text, so it runs anywhere and needs no DOM. A track from a watch holds thousands of
 * points; each line is thinned until it fits the map's vertex cap. Pure.
 */

import { LIMITS } from "../doc/catalogue";
import { addPin, addRoute, canAdd } from "../doc/operations";
import { docBytes, isFeatureName } from "../doc/schema";
import type { FeatureId, MapDoc } from "../doc/types";
import { simplifyLine, type Position } from "../geo/geo";

/** The largest file read: a long day's track with heart rate and cadence. */
export const MAX_GPX_BYTES = 20 * 1024 * 1024;

export type Gpx = {
  lines: { name: string | null; points: Position[] }[];
  places: { name: string | null; at: Position }[];
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  if (cdata) return cdata[1];
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ref: string) => {
    if (ref[0] !== "#") return ENTITIES[ref] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? Number.parseInt(ref.slice(2), 16) : Number.parseInt(ref.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/** Elements named `tag`, with or without a namespace prefix: their attributes and their content. */
function elements(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}\\s*>)`, "g");
  return [...xml.matchAll(re)].map((m) => ({ attrs: m[1], body: m[2] ?? "" }));
}

function position(attrs: string): Position | null {
  const value = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attrs)?.[1];
  const lat = Number(value("lat"));
  const lon = Number(value("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}

/** The element's own `<name>`, ignoring those of the `inner` points inside it. */
function nameOf(body: string, inner?: string): string | null {
  const own = inner ? body.split(new RegExp(`<(?:[\\w-]+:)?${inner}\\b`))[0] : body;
  const m = /<(?:[\w-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?name\s*>/.exec(own);
  return m ? decode(m[1]).trim() || null : null;
}

const points = (body: string, tag: string) =>
  elements(body, tag)
    .map((e) => position(e.attrs))
    .filter((p): p is Position => p !== null);

/** The GPX file's tracks, routes and waypoints, or null when it is not GPX. */
export function parseGpx(text: string): Gpx | null {
  const xml = text.replace(/<!--[\s\S]*?-->/g, "");
  if (!/<(?:[\w-]+:)?gpx\b/.test(xml)) return null;
  const lines: Gpx["lines"] = [];
  for (const trk of elements(xml, "trk")) {
    const name = nameOf(trk.body, "trkseg");
    for (const seg of elements(trk.body, "trkseg")) lines.push({ name, points: points(seg.body, "trkpt") });
  }
  for (const rte of elements(xml, "rte")) lines.push({ name: nameOf(rte.body, "rtept"), points: points(rte.body, "rtept") });
  const places = elements(xml, "wpt").flatMap((w) => {
    const at = position(w.attrs);
    return at ? [{ name: nameOf(w.body), at }] : [];
  });
  return { lines: lines.filter((l) => l.points.length >= 2), places };
}

/** What a name from a file can be on the map: the label rule, or nothing. */
function label(name: string | null): string | undefined {
  if (!name) return undefined;
  const cleaned = name.replace(/[^\x20-\x7e\xa0-ǿ]/g, "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name).trim();
  return isFeatureName(cleaned) ? cleaned : undefined;
}

/** A line thinned until it fits the vertex cap: from 2 m, doubling. */
function fit(line: readonly Position[]): Position[] {
  let tolerance = 2;
  let out = simplifyLine(line, tolerance);
  while (out.length > LIMITS.vertices) {
    tolerance *= 2;
    out = simplifyLine(line, tolerance);
  }
  return out;
}

export type Imported = { doc: MapDoc; added: FeatureId[]; left: number };

/**
 * The map with the file's lines as walk routes and its waypoints as places, each line named by the
 * file or by `fallback`. What would not fit, by count or by size, is left out and counted.
 */
export function importGpx(doc: MapDoc, gpx: Gpx, ids: () => FeatureId, now: number, fallback: string): Imported {
  let next = doc;
  const added: FeatureId[] = [];
  let left = 0;
  const tryAdd = (build: (id: FeatureId) => MapDoc) => {
    if (!canAdd(next)) return left++;
    const id = ids();
    const candidate = build(id);
    if (docBytes(candidate) > LIMITS.docBytes) return left++;
    next = candidate;
    added.push(id);
  };
  for (const line of gpx.lines) {
    tryAdd((id) => addRoute(next, { id, type: "walk", line: fit(line.points), name: label(line.name) ?? label(fallback) }, now));
  }
  for (const place of gpx.places) {
    tryAdd((id) => addPin(next, { id, type: "landmark", at: place.at, name: label(place.name) }, now));
  }
  return { doc: next, added, left };
}
