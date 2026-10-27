import { describe, expect, it } from "vitest";
import { addPin, addRoute, createMapDoc, featureById, numberPortas, setArmada } from "../doc/operations";
import { parseMapDoc } from "../doc/schema";
import { destination, type Position } from "../geo/geo";
import { toGeoJson } from "./geojson";
import { toGpx } from "./gpx";
import { toKml } from "./kml";
import { readInto } from "./read";

const S: Position = [-6.918, 39.882];
let n = 0;
const ids = () => `rd${String(n++).padStart(20, "0")}`;

function montaria() {
  const armada = ids();
  const porta = ids();
  let doc = createMapDoc("Montaria do Vale");
  doc = addRoute(doc, { id: armada, type: "armada", line: [S, destination(S, 90, 400)] }, 1);
  doc = addPin(doc, { id: porta, type: "porta", at: destination(S, 90, 100) }, 1);
  doc = numberPortas(setArmada(doc, porta, armada, 1), armada, 1);
  return doc;
}

describe("reading a file onto the map", () => {
  it("tells the format by what is inside, whatever the file is called", () => {
    const source = montaria();
    for (const text of [toGpx(source), toKml(source)]) {
      const read = readInto(createMapDoc("m"), "export.txt", text, ids, 1);
      expect(read.ok && read.imported.added).toHaveLength(2);
    }
  });

  it("brings a Coutada map whole, under new ids, its portas still on their armada", () => {
    const source = montaria();
    const read = readInto(createMapDoc("m"), "vale.geojson", toGeoJson(source), ids, 1);
    if (!read.ok) throw new Error(read.error);
    const { doc, added } = read.imported;
    expect(added.some((id) => source.features.some((f) => f.id === id))).toBe(false);
    const [armada, porta] = added.map((id) => featureById(doc, id)!);
    expect(armada.properties).toMatchObject({ kind: "route", type: "armada" });
    expect(porta.properties).toMatchObject({ kind: "pin", type: "porta", n: 1, armada: armada.id });
    expect(parseMapDoc(JSON.parse(JSON.stringify(doc)))).not.toBeNull();
  });

  it("brings plain GeoJSON: points, lines, polygons and their multi forms, named from properties", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "Fonte" }, geometry: { type: "Point", coordinates: [-6.918, 39.882, 310] } },
        { type: "Feature", properties: { title: "Caminho" }, geometry: { type: "MultiLineString", coordinates: [[[-6.92, 39.88], [-6.91, 39.88]], [[-6.9, 39.88], [-6.89, 39.88]]] } },
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-6.92, 39.88], [-6.91, 39.88], [-6.91, 39.89], [-6.92, 39.88]]] } },
        { type: "Feature", properties: null, geometry: null },
      ],
    });
    const read = readInto(createMapDoc("m"), "herdade_norte.json", text, ids, 1);
    if (!read.ok) throw new Error(read.error);
    const props = read.imported.added.map((id) => featureById(read.imported.doc, id)!.properties);
    expect(props.map((p) => [p.kind, p.type, p.name])).toEqual([
      ["route", "walk", "Caminho"],
      ["route", "walk", "Caminho"],
      ["zone", "boundary", "herdade norte"],
      ["pin", "landmark", "Fonte"],
    ]);
  });

  it("says why nothing came", () => {
    const m = createMapDoc("m");
    expect(readInto(m, "x.kmz", "PK\x03\x04", ids, 1)).toEqual({ ok: false, error: "kmz" });
    expect(readInto(m, "x.txt", "hello", ids, 1)).toEqual({ ok: false, error: "unknown" });
    expect(readInto(m, "x.json", "{not json", ids, 1)).toEqual({ ok: false, error: "unknown" });
    expect(readInto(m, "x.gpx", "<gpx></gpx>", ids, 1)).toEqual({ ok: false, error: "empty" });
    expect(readInto(m, "x.geojson", JSON.stringify({ type: "FeatureCollection", features: [] }), ids, 1)).toEqual({ ok: false, error: "empty" });
  });
});
