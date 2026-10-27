/**
 * Every change to a map document. Pure (D2): ids and time are arguments, the input is never
 * mutated, and coordinates are rounded to 6 decimals on the way in (D7).
 */

import { nearestOnLine, roundCoord, type Position } from "../geo/geo";
import { LIMITS, type PaletteKey, type PinType, type RouteType, type Species, type ZoneType } from "./catalogue";
import {
  DOC_VERSION,
  type FeatureId,
  type MapDoc,
  type MapFeature,
  type PinFeature,
  type RouteFeature,
  type ZoneFeature,
} from "./types";

const COORD_PLACES = 6;

const round = (p: Position): Position => [roundCoord(p[0], COORD_PLACES), roundCoord(p[1], COORD_PLACES)];

function closeRing(ring: readonly Position[]): Position[] {
  const r = ring.map(round);
  const [f, l] = [r[0], r[r.length - 1]];
  return f[0] === l[0] && f[1] === l[1] ? r : [...r, f];
}

export function createMapDoc(name: string): MapDoc {
  return { type: "FeatureCollection", coutada: { v: DOC_VERSION, name }, features: [] };
}

export const featureById = (doc: MapDoc, id: FeatureId): MapFeature | undefined =>
  doc.features.find((f) => f.id === id);

const withFeatures = (doc: MapDoc, features: MapFeature[]): MapDoc => ({ ...doc, features });

/** Room for one more feature under the cap. */
export const canAdd = (doc: MapDoc): boolean => doc.features.length < LIMITS.features;

export function addPin(
  doc: MapDoc,
  pin: { id: FeatureId; type: PinType; at: Position; name?: string; species?: Species },
  now: number,
): MapDoc {
  const feature: PinFeature = {
    type: "Feature",
    id: pin.id,
    geometry: { type: "Point", coordinates: round(pin.at) },
    properties: {
      kind: "pin",
      type: pin.type,
      updatedAt: now,
      createdAt: now,
      ...(pin.name ? { name: pin.name } : {}),
      ...(pin.type === "game" && pin.species ? { species: pin.species } : {}),
    },
  };
  return withFeatures(doc, [...doc.features, feature]);
}

export function addRoute(
  doc: MapDoc,
  route: { id: FeatureId; type: RouteType; line: readonly Position[]; name?: string },
  now: number,
): MapDoc {
  const feature: RouteFeature = {
    type: "Feature",
    id: route.id,
    geometry: { type: "LineString", coordinates: route.line.map(round) },
    properties: { kind: "route", type: route.type, updatedAt: now, createdAt: now, ...(route.name ? { name: route.name } : {}) },
  };
  return withFeatures(doc, [...doc.features, feature]);
}

export function addZone(
  doc: MapDoc,
  zone: { id: FeatureId; type: ZoneType; ring: readonly Position[]; name?: string },
  now: number,
): MapDoc {
  const feature: ZoneFeature = {
    type: "Feature",
    id: zone.id,
    geometry: { type: "Polygon", coordinates: [closeRing(zone.ring)] },
    properties: { kind: "zone", type: zone.type, updatedAt: now, createdAt: now, ...(zone.name ? { name: zone.name } : {}) },
  };
  return withFeatures(doc, [...doc.features, feature]);
}

export type PropsPatch = {
  name?: string | null;
  note?: string | null;
  color?: PaletteKey | null;
  /** A game pin's only. */
  species?: Species | null;
};

/** Sets or clears (null, or an empty string) a feature's name, note, colour and a game pin's species. */
export function updateProps(doc: MapDoc, id: FeatureId, patch: PropsPatch, now: number): MapDoc {
  return withFeatures(
    doc,
    doc.features.map((f) => {
      if (f.id !== id) return f;
      const props: Record<string, unknown> = { ...f.properties, updatedAt: now };
      for (const key of ["name", "note", "color", "species"] as const) {
        if (!(key in patch)) continue;
        if (key === "species" && f.properties.type !== "game") continue;
        const value = patch[key];
        if (value === null || value === "") delete props[key];
        else props[key] = value;
      }
      return { ...f, properties: props } as MapFeature;
    }),
  );
}

/** Replaces a pin's position. */
export function movePin(doc: MapDoc, id: FeatureId, at: Position, now: number): MapDoc {
  return withFeatures(
    doc,
    doc.features.map((f): MapFeature => {
      if (f.id !== id || f.geometry.type !== "Point") return f;
      const pin = f as PinFeature;
      return { ...pin, geometry: { type: "Point", coordinates: round(at) }, properties: { ...pin.properties, updatedAt: now } };
    }),
  );
}

/** Replaces a route's line, or a zone's ring, as an edit hands it back. */
export function setShape(doc: MapDoc, id: FeatureId, positions: readonly Position[], now: number): MapDoc {
  return withFeatures(
    doc,
    doc.features.map((f): MapFeature => {
      if (f.id !== id) return f;
      if (f.geometry.type === "LineString") {
        return { ...(f as RouteFeature), geometry: { type: "LineString", coordinates: positions.map(round) }, properties: { ...(f as RouteFeature).properties, updatedAt: now } };
      }
      if (f.geometry.type === "Polygon") {
        return { ...(f as ZoneFeature), geometry: { type: "Polygon", coordinates: [closeRing(positions)] }, properties: { ...(f as ZoneFeature).properties, updatedAt: now } };
      }
      return f;
    }),
  );
}

/** A pin's properties with its armada set, or removed when `armada` is null. */
function onArmada(props: PinFeature["properties"], armada: FeatureId | null, now: number): PinFeature["properties"] {
  const next = { ...props, updatedAt: now };
  if (armada) next.armada = armada;
  else delete next.armada;
  return next;
}

/** Deletes a feature; deleting an armada frees the portas that stood on it. */
export function deleteFeature(doc: MapDoc, id: FeatureId, now: number): MapDoc {
  return withFeatures(
    doc,
    doc.features
      .filter((f) => f.id !== id)
      .map((f) =>
        f.properties.kind === "pin" && f.properties.armada === id
          ? { ...(f as PinFeature), properties: onArmada(f.properties, null, now) }
          : f,
      ),
  );
}

/** Puts a porta on an armada, or takes it off one (null). Anything else is left as it was. */
export function setArmada(doc: MapDoc, portaId: FeatureId, armadaId: FeatureId | null, now: number): MapDoc {
  const armada = armadaId ? featureById(doc, armadaId) : null;
  if (armadaId && (armada?.properties.kind !== "route" || armada.properties.type !== "armada")) return doc;

  return withFeatures(
    doc,
    doc.features.map((f) =>
      f.id === portaId && f.properties.kind === "pin" && f.properties.type === "porta"
        ? { ...(f as PinFeature), properties: onArmada(f.properties, armadaId, now) }
        : f,
    ),
  );
}

/**
 * Numbers the portas standing on an armada in order along it, starting at `from`. Numbering is an
 * operation, never inferred at render time (D7).
 */
export function numberPortas(doc: MapDoc, armadaId: FeatureId, now: number, from = 1): MapDoc {
  const armada = featureById(doc, armadaId);
  if (armada?.geometry.type !== "LineString") return doc;
  const line = armada.geometry.coordinates;

  const order = doc.features
    .filter((f): f is PinFeature => f.properties.kind === "pin" && f.properties.armada === armadaId)
    .map((f) => ({ id: f.id, along: nearestOnLine(line, f.geometry.coordinates).along }))
    .sort((a, b) => a.along - b.along);

  const numbers = new Map(order.map((o, i) => [o.id, Math.min(from + i, LIMITS.portaNumber)]));

  return withFeatures(
    doc,
    doc.features.map((f): MapFeature => {
      const n = numbers.get(f.id);
      if (n === undefined || f.properties.kind !== "pin") return f;
      const pin = f as PinFeature;
      return { ...pin, properties: { ...pin.properties, n, updatedAt: now } };
    }),
  );
}

/** Sets a porta's number by hand, or clears it (null). */
export function setPortaNumber(doc: MapDoc, portaId: FeatureId, n: number | null, now: number): MapDoc {
  return withFeatures(
    doc,
    doc.features.map((f): MapFeature => {
      if (f.id !== portaId || f.properties.kind !== "pin" || f.properties.type !== "porta") return f;
      const props = { ...(f as PinFeature).properties, updatedAt: now };
      if (n === null) delete props.n;
      else props.n = Math.max(1, Math.min(LIMITS.portaNumber, Math.round(n)));
      return { ...(f as PinFeature), properties: props };
    }),
  );
}

/** The armada nearest to `at` within `withinM`, or null. */
export function nearestArmada(doc: MapDoc, at: Position, withinM: number): FeatureId | null {
  let best: { id: FeatureId; d: number } | null = null;
  for (const f of doc.features) {
    if (f.properties.kind !== "route" || f.properties.type !== "armada") continue;
    const d = Math.abs(nearestOnLine((f as RouteFeature).geometry.coordinates, at).cross);
    if (d <= withinM && (!best || d < best.d)) best = { id: f.id, d };
  }
  return best?.id ?? null;
}

/** The lowest number among an armada's portas, which renumbering keeps as its start. */
export function firstPortaNumber(doc: MapDoc, armadaId: FeatureId): number {
  let first = Infinity;
  for (const f of doc.features) {
    if (f.properties.kind === "pin" && f.properties.armada === armadaId && f.properties.n !== undefined) {
      first = Math.min(first, f.properties.n);
    }
  }
  return first === Infinity ? 1 : first;
}

export function renameMap(doc: MapDoc, name: string): MapDoc {
  return { ...doc, coutada: { ...doc.coutada, name } };
}
