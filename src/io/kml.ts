/**
 * KML in and out (D21), as Google Earth and My Maps write it. In: each Placemark's points, lines,
 * polygons (the outer ring) and `gx:Track`s, also inside MultiGeometry. Out: one Placemark per
 * feature, in its colour. KMZ is a zip, which the reader does not open. Pure.
 */

import { DEFAULT_COLOR, PALETTE } from "../doc/catalogue";
import type { MapDoc, MapFeature } from "../doc/types";
import type { Position } from "../geo/geo";
import { type Incoming, lonLat } from "./incoming";
import { elements, escape, has, ownName, text, uncommented } from "./xml";

/** `lon,lat[,alt]` tuples separated by whitespace. */
function tuples(coordinates: string | null): Position[] {
  if (!coordinates) return [];
  return coordinates
    .trim()
    .split(/\s+/)
    .map((t) => {
      const [lon, lat] = t.split(",").map(Number);
      return lonLat(lon, lat);
    })
    .filter((p): p is Position => p !== null);
}

/** A `gx:coord`: `lon lat alt`, separated by spaces. */
function gxCoord(coord: string): Position | null {
  const [lon, lat] = coord.trim().split(/\s+/).map(Number);
  return lonLat(lon, lat);
}

/** The KML file's placemarks, or null when it is not KML. */
export function parseKml(source: string): Incoming | null {
  const xml = uncommented(source);
  if (!has(xml, "kml")) return null;
  const out: Incoming = { lines: [], places: [], areas: [] };
  for (const pm of elements(xml, "Placemark")) {
    const name = ownName(pm.body);
    for (const p of elements(pm.body, "Point")) {
      const [at] = tuples(text(p.body, "coordinates"));
      if (at) out.places.push({ name, at });
    }
    for (const l of elements(pm.body, "LineString")) {
      const points = tuples(text(l.body, "coordinates"));
      if (points.length >= 2) out.lines.push({ name, points });
    }
    for (const poly of elements(pm.body, "Polygon")) {
      const outer = elements(poly.body, "outerBoundaryIs")[0]?.body ?? "";
      const ring = tuples(text(outer, "coordinates"));
      if (ring.length >= 4) out.areas.push({ name, ring });
    }
    for (const track of elements(pm.body, "Track")) {
      const points = elements(track.body, "coord")
        .map((c) => gxCoord(c.body))
        .filter((p): p is Position => p !== null);
      if (points.length >= 2) out.lines.push({ name, points });
    }
  }
  return out;
}

/** `#rrggbb` as KML's `aabbggrr`. */
function kmlColour(hex: string, alpha: string): string {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)];
  return `${alpha}${b}${g}${r}`;
}

const coords = (line: readonly Position[]) => line.map((p) => `${p[0]},${p[1]}`).join(" ");

function placemark(f: MapFeature): string {
  const p = f.properties;
  const g = f.geometry;
  const hex = PALETTE[p.color ?? DEFAULT_COLOR[p.type]];
  const head = (p.name ? `<name>${escape(p.name)}</name>` : "") + (p.note ? `<description>${escape(p.note)}</description>` : "");
  if (g.type === "Point") {
    const style = `<Style><IconStyle><color>${kmlColour(hex, "ff")}</color></IconStyle></Style>`;
    return `<Placemark>${head}${style}<Point><coordinates>${g.coordinates[0]},${g.coordinates[1]}</coordinates></Point></Placemark>`;
  }
  const line = `<LineStyle><color>${kmlColour(hex, "ff")}</color><width>3</width></LineStyle>`;
  if (g.type === "LineString") {
    return `<Placemark>${head}<Style>${line}</Style><LineString><tessellate>1</tessellate><coordinates>${coords(g.coordinates)}</coordinates></LineString></Placemark>`;
  }
  const fill = `<PolyStyle><color>${kmlColour(hex, "40")}</color></PolyStyle>`;
  return (
    `<Placemark>${head}<Style>${line}${fill}</Style><Polygon><outerBoundaryIs><LinearRing>` +
    `<coordinates>${coords(g.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
  );
}

/** The map as KML 2.2. */
export function toKml(doc: MapDoc): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escape(doc.coutada.name)}</name>\n` +
    doc.features.map(placemark).join("\n") +
    `\n</Document></kml>\n`
  );
}
