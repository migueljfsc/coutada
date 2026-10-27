/**
 * What a file brings onto a map, whatever its format (D21): lines, places and areas, each with
 * the name the file gave it. Lines become walk routes, places landmarks, areas boundaries. Each
 * shape is thinned until it fits the vertex cap, and names are cleaned to what a label can draw.
 * Pure.
 */

import { LIMITS } from "../doc/catalogue";
import { addPin, addRoute, addZone, canAdd } from "../doc/operations";
import { docBytes, isFeatureName } from "../doc/schema";
import type { FeatureId, MapDoc } from "../doc/types";
import { simplifyLine, type Position } from "../geo/geo";

/** The largest file read: a long day's track with heart rate and cadence. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export type Incoming = {
  lines: { name: string | null; points: Position[] }[];
  places: { name: string | null; at: Position }[];
  /** Outer rings, open: the first point is not repeated at the end. */
  areas: { name: string | null; ring: Position[] }[];
};

export const nothing = (): Incoming => ({ lines: [], places: [], areas: [] });

export const isEmpty = (i: Incoming) => i.lines.length === 0 && i.places.length === 0 && i.areas.length === 0;

/** A `[lon, lat]` from numbers in range, or null. */
export function lonLat(lon: number, lat: number): Position | null {
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? [lon, lat] : null;
}

/** A ring without its closing point, when the file repeats the first point at the end. */
export function openRing(ring: Position[]): Position[] {
  const [first, last] = [ring[0], ring[ring.length - 1]];
  return ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
}

/** What a name from a file can be on the map: the label rule, or nothing. */
function label(name: string | null): string | undefined {
  if (!name) return undefined;
  const cleaned = name.replace(/[^\x20-\x7e\xa0-ǿ]/g, "").replace(/\s+/g, " ").trim().slice(0, LIMITS.name).trim();
  return isFeatureName(cleaned) ? cleaned : undefined;
}

/** A shape thinned until it fits the vertex cap: from 2 m, doubling. */
function fit(points: readonly Position[], closed: boolean): Position[] {
  const cap = closed ? LIMITS.vertices - 1 : LIMITS.vertices;
  const line = closed ? [...points, points[0]] : points;
  let tolerance = 2;
  let out = simplifyLine(line, tolerance);
  while (out.length > cap) {
    tolerance *= 2;
    out = simplifyLine(line, tolerance);
  }
  return closed ? out.slice(0, -1) : out;
}

export type Imported = { doc: MapDoc; added: FeatureId[]; left: number };

/**
 * The map with what the file brings, each line named by the file or by `fallback`. What would not
 * fit, by count or by size, is left out and counted.
 */
export function importInto(doc: MapDoc, incoming: Incoming, ids: () => FeatureId, now: number, fallback: string): Imported {
  let next = doc;
  const added: FeatureId[] = [];
  let left = 0;
  const tryAdd = (build: (id: FeatureId) => MapDoc | null) => {
    if (!canAdd(next)) return left++;
    const id = ids();
    const candidate = build(id);
    if (!candidate || docBytes(candidate) > LIMITS.docBytes) return left++;
    next = candidate;
    added.push(id);
  };
  for (const line of incoming.lines) {
    tryAdd((id) => addRoute(next, { id, type: "walk", line: fit(line.points, false), name: label(line.name) ?? label(fallback) }, now));
  }
  for (const area of incoming.areas) {
    tryAdd((id) => {
      const ring = fit(openRing(area.ring), true);
      return ring.length >= 3 ? addZone(next, { id, type: "boundary", ring, name: label(area.name) ?? label(fallback) }, now) : null;
    });
  }
  for (const place of incoming.places) {
    tryAdd((id) => addPin(next, { id, type: "landmark", at: place.at, name: label(place.name) }, now));
  }
  return { doc: next, added, left };
}
