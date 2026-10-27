/**
 * GPX in and out (D21). In: tracks and routes are lines, waypoints places. Out: pins as
 * waypoints, routes and areas as tracks (GPX has no areas; a closed track keeps the outline). Pure.
 */

import type { MapDoc } from "../doc/types";
import type { Position } from "../geo/geo";
import { type Incoming, lonLat } from "./incoming";
import { attr, elements, escape, has, ownName, uncommented } from "./xml";

const points = (body: string, tag: string) =>
  elements(body, tag)
    .map((e) => lonLat(Number(attr(e.attrs, "lon")), Number(attr(e.attrs, "lat"))))
    .filter((p): p is Position => p !== null);

/** The GPX file's tracks, routes and waypoints, or null when it is not GPX. */
export function parseGpx(text: string): Incoming | null {
  const xml = uncommented(text);
  if (!has(xml, "gpx")) return null;
  const lines: Incoming["lines"] = [];
  for (const trk of elements(xml, "trk")) {
    const name = ownName(trk.body, "trkseg");
    for (const seg of elements(trk.body, "trkseg")) lines.push({ name, points: points(seg.body, "trkpt") });
  }
  for (const rte of elements(xml, "rte")) lines.push({ name: ownName(rte.body, "rtept"), points: points(rte.body, "rtept") });
  const places = elements(xml, "wpt").flatMap((w) => {
    const at = lonLat(Number(attr(w.attrs, "lon")), Number(attr(w.attrs, "lat")));
    return at ? [{ name: ownName(w.body), at }] : [];
  });
  return { lines: lines.filter((l) => l.points.length >= 2), places, areas: [] };
}

const pt = (tag: string, p: Position, inner = "") => `<${tag} lat="${p[1]}" lon="${p[0]}">${inner}</${tag}>`;
const named = (name: string | undefined) => (name ? `<name>${escape(name)}</name>` : "");
const described = (note: string | undefined) => (note ? `<desc>${escape(note)}</desc>` : "");

/** The map as GPX 1.1. */
export function toGpx(doc: MapDoc): string {
  const wpts: string[] = [];
  const trks: string[] = [];
  for (const f of doc.features) {
    const p = f.properties;
    const g = f.geometry;
    if (g.type === "Point") {
      wpts.push(pt("wpt", g.coordinates, named(p.name) + described(p.note) + `<type>${p.type}</type>`));
      continue;
    }
    const line = g.type === "LineString" ? g.coordinates : g.coordinates[0];
    trks.push(`<trk>${named(p.name)}${described(p.note)}<type>${p.type}</type><trkseg>${line.map((c) => pt("trkpt", c)).join("")}</trkseg></trk>`);
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Coutada" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `<metadata><name>${escape(doc.coutada.name)}</name></metadata>\n` +
    [...wpts, ...trks].join("\n") +
    `\n</gpx>\n`
  );
}
