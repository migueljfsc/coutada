/**
 * What MapLibre draws for a map document: shapes, labels, edit handles and the line or area being
 * drawn. Pure — the document, the selection and the tool in, GeoJSON out. Image ids name the
 * pictures `images.ts` draws on demand (D24).
 */

import { lineLength, pointAlong, ringCentroid, type Position } from "../geo/geo";
import { DEFAULT_COLOR, PALETTE } from "../doc/catalogue";
import type { FeatureId, MapDoc, MapFeature } from "../doc/types";
import type { Tool } from "../draw/editor";
import type { SightingEvent, Subject } from "../live/protocol";

type Geometry =
  | { type: "Point"; coordinates: number[] }
  | { type: "LineString"; coordinates: number[][] }
  | { type: "Polygon"; coordinates: number[][][] };

export type RenderFeature = { type: "Feature"; properties: Record<string, string | number>; geometry: Geometry };
export type Collection = { type: "FeatureCollection"; features: RenderFeature[] };

const collection = (features: RenderFeature[]): Collection => ({ type: "FeatureCollection", features });
const pos = (p: Position): number[] => [p[0], p[1]];

export const pinImage = (type: string, colour: string) => `pin:${type}:${colour}`;
export const gameImage = (species: string, colour: string) => `game:${species}:${colour}`;
export const portaImage = (n: number | undefined) => `porta:${n ?? ""}`;
export const labelImage = (text: string) => `label:${text}`;
export const observationImage = (subject: string, event: string) => `obs:${subject}:${event}`;

const colourKey = (f: MapFeature) => f.properties.color ?? DEFAULT_COLOR[f.properties.type];

function shape(f: MapFeature, selected: boolean): RenderFeature {
  const key = colourKey(f);
  const p = f.properties;
  const properties: Record<string, string | number> = {
    fid: f.id,
    kind: p.kind,
    type: p.type,
    colour: PALETTE[key],
    sel: selected ? 1 : 0,
  };
  if (p.kind === "pin") {
    properties.icon = p.type === "porta" ? portaImage(p.n) : p.species ? gameImage(p.species, key) : pinImage(p.type, key);
  }
  const g = f.geometry;
  const geometry: Geometry =
    g.type === "Point"
      ? { type: "Point", coordinates: pos(g.coordinates) }
      : g.type === "LineString"
        ? { type: "LineString", coordinates: g.coordinates.map(pos) }
        : { type: "Polygon", coordinates: [g.coordinates[0].map(pos)] };
  return { type: "Feature", properties, geometry };
}

/** Where a feature's name is drawn: under a pin, halfway along a route, at an area's centre. */
function labelAt(f: MapFeature): Position {
  const g = f.geometry;
  if (g.type === "Point") return g.coordinates;
  if (g.type === "LineString") return pointAlong(g.coordinates, lineLength(g.coordinates) / 2);
  return ringCentroid(g.coordinates[0]);
}

function label(f: MapFeature): RenderFeature | null {
  const name = f.properties.name;
  if (!name) return null;
  return {
    type: "Feature",
    properties: { fid: f.id, kind: f.properties.kind, label: labelImage(name) },
    geometry: { type: "Point", coordinates: pos(labelAt(f)) },
  };
}

/** Vertices of the selected route or area, and the midpoints a drag turns into new vertices. */
function handles(f: MapFeature | undefined, chosen: number | null): RenderFeature[] {
  if (!f) return [];
  const g = f.geometry;
  if (g.type === "Point") return [];
  const points = g.type === "LineString" ? g.coordinates : g.coordinates[0].slice(0, -1);
  const closed = g.type === "Polygon";
  const out: RenderFeature[] = points.map((p, i) => ({
    type: "Feature",
    properties: { role: "vertex", i, chosen: i === chosen ? 1 : 0 },
    geometry: { type: "Point", coordinates: pos(p) },
  }));
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push({
      type: "Feature",
      properties: { role: "mid", i },
      geometry: { type: "Point", coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] },
    });
  }
  return out;
}

function draft(tool: Tool): RenderFeature[] {
  if (tool.kind !== "line" && tool.kind !== "area") return [];
  const pts = tool.points.map(pos);
  const out: RenderFeature[] = pts.map((p) => ({
    type: "Feature",
    properties: { role: "vertex" },
    geometry: { type: "Point", coordinates: p },
  }));
  if (tool.kind === "area" && pts.length >= 3) {
    out.unshift({ type: "Feature", properties: { role: "area" }, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
  } else if (pts.length >= 2) {
    out.unshift({ type: "Feature", properties: { role: "line" }, geometry: { type: "LineString", coordinates: pts } });
  }
  return out;
}

export type Rendered = {
  shapes: Collection;
  labels: Collection;
  handles: Collection;
  draft: Collection;
  guide: Collection;
  people: Collection;
  trails: Collection;
  observations: Collection;
};

/** Another hunter on the map: where, who, and how fresh the position is (D15). */
export type Person = { id: string; name: string; at: Position; state: "fresh" | "stale" | "lost"; away: boolean };
export type Trail = { id: string; points: readonly Position[] };
/** Something a hunter marked during the hunt: a covey flushed, game seen or down, a dog (D11). */
export type Sighting = { id: string; subject: Subject; event: SightingEvent; at: Position };

/** The line from the person to what they navigate to. */
function guide(points: readonly Position[] | null): RenderFeature[] {
  if (!points || points.length < 2) return [];
  return [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(pos) } }];
}

export type RenderOptions = {
  selected?: FeatureId | null;
  tool?: Tool;
  /** The selected shape shows its handles: only while editing it. */
  editing?: boolean;
  /** The vertex chosen for deletion. */
  vertex?: number | null;
  /** From the person to what they navigate to. */
  guide?: readonly Position[] | null;
  /** The other hunters, in a live hunt. */
  people?: readonly Person[];
  trails?: readonly Trail[];
  observations?: readonly Sighting[];
  /** The observation chosen on the map. */
  sighting?: string | null;
};

const IDLE: Tool = { kind: "idle" };

export function render(doc: MapDoc, options: RenderOptions = {}): Rendered {
  const {
    selected = null,
    tool = IDLE,
    editing = false,
    vertex = null,
    guide: guideLine = null,
    people = [],
    trails = [],
    observations = [],
    sighting = null,
  } = options;
  const chosen = editing && selected ? doc.features.find((f) => f.id === selected) : undefined;
  return {
    shapes: collection(doc.features.map((f) => shape(f, f.id === selected))),
    labels: collection(doc.features.map(label).filter((l): l is RenderFeature => l !== null)),
    handles: collection(handles(chosen, vertex)),
    draft: collection(draft(tool)),
    guide: collection(guide(guideLine)),
    people: collection(
      people.map((p) => ({
        type: "Feature",
        properties: { pid: p.id, label: labelImage(p.name), state: p.state, away: p.away ? 1 : 0 },
        geometry: { type: "Point", coordinates: pos(p.at) },
      })),
    ),
    trails: collection(
      trails
        .filter((t) => t.points.length >= 2)
        .map((t) => ({ type: "Feature", properties: { pid: t.id }, geometry: { type: "LineString", coordinates: t.points.map(pos) } })),
    ),
    observations: collection(
      observations.map((o) => ({
        type: "Feature",
        properties: { fid: o.id, icon: observationImage(o.subject, o.event), sel: o.id === sighting ? 1 : 0 },
        geometry: { type: "Point", coordinates: pos(o.at) },
      })),
    ),
  };
}

/** The positions a drag of handle `role`/`i` produces from the selected feature's shape. */
export function dragShape(
  f: MapFeature,
  role: "vertex" | "mid",
  i: number,
  to: Position,
): Position[] | null {
  const g = f.geometry;
  if (g.type === "Point") return null;
  const points = g.type === "LineString" ? [...g.coordinates] : g.coordinates[0].slice(0, -1);
  if (role === "vertex") points[i] = to;
  else points.splice(i + 1, 0, to);
  return points;
}

/** The selected shape with vertex `i` removed, or null when that would leave too few. */
export function withoutVertex(f: MapFeature, i: number): Position[] | null {
  const g = f.geometry;
  if (g.type === "Point") return null;
  const points = g.type === "LineString" ? [...g.coordinates] : g.coordinates[0].slice(0, -1);
  if (points.length <= (g.type === "LineString" ? 2 : 3)) return null;
  points.splice(i, 1);
  return points;
}
