/**
 * GeoJSON in and out (D21). A Coutada map comes in whole, its features keeping their types,
 * colours and portas; any other GeoJSON brings its points, lines and polygons (outer rings) as an
 * `Incoming`. Out, the map is its own document (D7). Pure.
 */

import { canAdd } from "../doc/operations";
import { loadMapDoc } from "../doc/migrate";
import { docBytes } from "../doc/schema";
import { LIMITS } from "../doc/catalogue";
import type { FeatureId, MapDoc, MapFeature } from "../doc/types";
import type { Position } from "../geo/geo";
import { type Imported, type Incoming, lonLat, nothing } from "./incoming";

export type GeoJsonRead = { kind: "coutada"; doc: MapDoc } | { kind: "plain"; incoming: Incoming };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function position(v: unknown): Position | null {
  return Array.isArray(v) ? lonLat(Number(v[0]), Number(v[1])) : null;
}
const positions = (v: unknown): Position[] => (Array.isArray(v) ? v.map(position).filter((p): p is Position => p !== null) : []);

function nameOf(properties: unknown): string | null {
  if (!isObject(properties)) return null;
  for (const key of ["name", "Name", "title", "NAME"]) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function collect(geometry: unknown, name: string | null, out: Incoming) {
  if (!isObject(geometry)) return;
  const c = geometry.coordinates;
  switch (geometry.type) {
    case "Point": {
      const at = position(c);
      if (at) out.places.push({ name, at });
      break;
    }
    case "MultiPoint":
      for (const at of positions(c)) out.places.push({ name, at });
      break;
    case "LineString": {
      const points = positions(c);
      if (points.length >= 2) out.lines.push({ name, points });
      break;
    }
    case "MultiLineString":
      if (Array.isArray(c)) for (const l of c) collect({ type: "LineString", coordinates: l }, name, out);
      break;
    case "Polygon": {
      const ring = Array.isArray(c) ? positions(c[0]) : [];
      if (ring.length >= 4) out.areas.push({ name, ring });
      break;
    }
    case "MultiPolygon":
      if (Array.isArray(c)) for (const p of c) collect({ type: "Polygon", coordinates: p }, name, out);
      break;
    case "GeometryCollection":
      if (Array.isArray(geometry.geometries)) for (const g of geometry.geometries) collect(g, name, out);
      break;
  }
}

/** The file as a Coutada map or as plain GeoJSON, or null when it is neither. */
export function parseGeoJson(text: string): GeoJsonRead | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  if ("coutada" in raw) {
    const loaded = loadMapDoc(raw);
    return loaded.ok ? { kind: "coutada", doc: loaded.doc } : null;
  }
  const out = nothing();
  if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) {
    for (const f of raw.features) if (isObject(f)) collect(f.geometry, nameOf(f.properties), out);
  } else if (raw.type === "Feature") {
    collect(raw.geometry, nameOf(raw.properties), out);
  } else if (typeof raw.type === "string") {
    collect(raw, null, out);
  } else {
    return null;
  }
  return { kind: "plain", incoming: out };
}

/**
 * Another Coutada map's features added to this one under new ids, a porta keeping its armada when
 * that came too. What would not fit is left out and counted.
 */
export function importMap(doc: MapDoc, other: MapDoc, ids: () => FeatureId): Imported {
  const renamed = new Map(other.features.map((f) => [f.id, ids()]));
  let next = doc;
  const added: FeatureId[] = [];
  let left = 0;
  for (const f of other.features) {
    if (!canAdd(next)) {
      left++;
      continue;
    }
    const id = renamed.get(f.id)!;
    let properties = f.properties;
    if (properties.kind === "pin" && properties.armada) {
      const { armada, ...rest } = properties;
      const moved = renamed.get(armada);
      properties = moved ? { ...rest, armada: moved } : rest;
    }
    const candidate = { ...next, features: [...next.features, { ...f, id, properties } as MapFeature] };
    if (docBytes(candidate) > LIMITS.docBytes) {
      left++;
      continue;
    }
    next = candidate;
    added.push(id);
  }
  return { doc: next, added, left };
}

/** The map as GeoJSON: the document itself. */
export const toGeoJson = (doc: MapDoc): string => `${JSON.stringify(doc, null, 2)}\n`;
