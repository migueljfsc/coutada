import { describe, expect, it } from "vitest";
import { addPin, addRoute, addZone, createMapDoc, updateProps } from "../doc/operations";
import { destination, type Position } from "../geo/geo";
import { parseKml, toKml } from "./kml";

const S: Position = [-6.918, 39.882];
let n = 0;
const ids = () => `kml${String(n++).padStart(19, "0")}`;

/** As Google Earth writes it: folders, styles, a polygon with a hole, a multi-geometry, a gx:Track. */
const earth = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>Herdade</name>
 <Style id="s"><LineStyle><color>ff0000ff</color></LineStyle></Style>
 <Folder><name>Sítios</name>
  <Placemark><name>Fonte &amp; bebedouro</name><styleUrl>#s</styleUrl><Point><coordinates>-6.918,39.882,0</coordinates></Point></Placemark>
  <Placemark><name>Estrema</name><Polygon>
   <outerBoundaryIs><LinearRing><coordinates>-6.92,39.88,0 -6.91,39.88,0 -6.91,39.89,0 -6.92,39.88,0</coordinates></LinearRing></outerBoundaryIs>
   <innerBoundaryIs><LinearRing><coordinates>-6.915,39.882 -6.914,39.882 -6.914,39.883 -6.915,39.882</coordinates></LinearRing></innerBoundaryIs>
  </Polygon></Placemark>
 </Folder>
 <Placemark><name>Caminhos</name><MultiGeometry>
  <LineString><coordinates>
    -6.92,39.88 -6.919,39.881
  </coordinates></LineString>
  <LineString><coordinates>-6.91,39.88 -6.911,39.881</coordinates></LineString>
 </MultiGeometry></Placemark>
 <Placemark><name>Gravado</name><gx:Track><when>2026-10-24T07:00:00Z</when><gx:coord>-6.918 39.882 300</gx:coord><gx:coord>-6.917 39.883 301</gx:coord></gx:Track></Placemark>
</Document></kml>`;

describe("reading KML", () => {
  it("takes points, lines, outer rings and tracks, also from multi-geometries", () => {
    const k = parseKml(earth)!;
    expect(k.places).toEqual([{ name: "Fonte & bebedouro", at: [-6.918, 39.882] }]);
    expect(k.areas).toEqual([
      {
        name: "Estrema",
        ring: [
          [-6.92, 39.88],
          [-6.91, 39.88],
          [-6.91, 39.89],
          [-6.92, 39.88],
        ],
      },
    ]);
    expect(k.lines.map((l) => [l.name, l.points.length])).toEqual([
      ["Caminhos", 2],
      ["Caminhos", 2],
      ["Gravado", 2],
    ]);
  });

  it("refuses what is not KML", () => {
    expect(parseKml("<gpx></gpx>")).toBeNull();
  });
});

describe("writing KML", () => {
  it("writes every feature in its colour, and reads it back", () => {
    let doc = createMapDoc("Herdade");
    doc = addPin(doc, { id: ids(), type: "gate", at: S, name: "Cancela" }, 1);
    const walk = ids();
    doc = updateProps(addRoute(doc, { id: walk, type: "walk", line: [S, destination(S, 0, 100)] }, 1), walk, { color: "magenta" }, 1);
    doc = addZone(doc, { id: ids(), type: "no_shoot", ring: [S, destination(S, 90, 100), destination(S, 0, 100)], name: "Casa" }, 1);
    const kml = toKml(doc);
    expect(kml).toContain("<color>ffa34fff</color>");
    expect(kml).toContain("<color>403b3bff</color>");
    const back = parseKml(kml)!;
    expect(back.places).toEqual([{ name: "Cancela", at: S }]);
    expect(back.lines).toHaveLength(1);
    expect(back.areas[0].name).toBe("Casa");
  });
});
