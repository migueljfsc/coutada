/**
 * A file onto the map, whatever it is (D21): GPX, KML or GeoJSON, told apart by what is inside,
 * not by its name. Pure: the text in, the map with what it brought, or why nothing came.
 */

import type { FeatureId, MapDoc } from "../doc/types";
import { importMap, parseGeoJson } from "./geojson";
import { parseGpx } from "./gpx";
import { type Imported, importInto, isEmpty } from "./incoming";
import { parseKml } from "./kml";

export type ReadError = "kmz" | "unknown" | "empty" | "full";
export type Read = { ok: true; imported: Imported } | { ok: false; error: ReadError };

export function readInto(doc: MapDoc, fileName: string, text: string, ids: () => FeatureId, now: number): Read {
  if (/\.kmz$/i.test(fileName) || text.startsWith("PK")) return { ok: false, error: "kmz" };
  const fallback = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const trimmed = text.trimStart();

  let imported: Imported;
  if (trimmed.startsWith("{")) {
    const read = parseGeoJson(text);
    if (!read) return { ok: false, error: "unknown" };
    if (read.kind === "coutada") {
      if (read.doc.features.length === 0) return { ok: false, error: "empty" };
      imported = importMap(doc, read.doc, ids);
    } else {
      if (isEmpty(read.incoming)) return { ok: false, error: "empty" };
      imported = importInto(doc, read.incoming, ids, now, fallback);
    }
  } else {
    const incoming = parseGpx(text) ?? parseKml(text);
    if (!incoming) return { ok: false, error: "unknown" };
    if (isEmpty(incoming)) return { ok: false, error: "empty" };
    imported = importInto(doc, incoming, ids, now, fallback);
  }
  return imported.added.length === 0 ? { ok: false, error: "full" } : { ok: true, imported };
}
