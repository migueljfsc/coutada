import { describe, expect, it } from "vitest";
import { LIMITS } from "../doc/catalogue";
import { addPin, addRoute, addZone, createMapDoc, featureById } from "../doc/operations";
import { parseMapDoc } from "../doc/schema";
import { destination, type Position } from "../geo/geo";
import { parseGpx, toGpx } from "./gpx";
import { importInto } from "./incoming";

const S: Position = [-6.918, 39.882];
let n = 0;
const ids = () => `gpx${String(n++).padStart(19, "0")}`;

/** As Strava writes it: a namespaced root, metadata, one track, extensions on every point. */
const strava = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <metadata><name>Not this one</name><time>2026-10-24T07:12:00Z</time></metadata>
 <trk>
  <name>Caça de salto &amp; perdizes</name>
  <type>hiking</type>
  <trkseg>
   <trkpt lat="39.882000" lon="-6.918000"><ele>310.2</ele><time>2026-10-24T07:12:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>98</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
   <trkpt lat="39.882900" lon="-6.918000"><ele>311.0</ele><name>not the track's</name></trkpt>
   <trkpt lon='-6.916800' lat='39.882900'/>
  </trkseg>
 </trk>
</gpx>`;

describe("reading GPX", () => {
  it("takes a track's points and its own name, whatever the attribute order or quotes", () => {
    const gpx = parseGpx(strava)!;
    expect(gpx.lines).toHaveLength(1);
    expect(gpx.lines[0].name).toBe("Caça de salto & perdizes");
    expect(gpx.lines[0].points).toEqual([
      [-6.918, 39.882],
      [-6.918, 39.8829],
      [-6.9168, 39.8829],
    ]);
  });

  it("takes routes and waypoints, with prefixed tags, CDATA names and comments", () => {
    const gpx = parseGpx(`<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">
      <!-- <wpt lat="1" lon="1"><name>commented out</name></wpt> -->
      <gpx:wpt lat="39.88" lon="-6.91"><gpx:name><![CDATA[Sobreiro <grande>]]></gpx:name></gpx:wpt>
      <gpx:wpt lat="39.881" lon="-6.912"/>
      <gpx:rte><gpx:name>Volta</gpx:name><gpx:rtept lat="39.88" lon="-6.91"/><gpx:rtept lat="39.89" lon="-6.91"/></gpx:rte>
    </gpx:gpx>`)!;
    expect(gpx.places).toEqual([
      { name: "Sobreiro <grande>", at: [-6.91, 39.88] },
      { name: null, at: [-6.912, 39.881] },
    ]);
    expect(gpx.lines).toEqual([
      {
        name: "Volta",
        points: [
          [-6.91, 39.88],
          [-6.91, 39.89],
        ],
      },
    ]);
  });

  it("refuses what is not GPX, and drops points out of range and lines of one point", () => {
    expect(parseGpx("<kml></kml>")).toBeNull();
    expect(parseGpx("not xml at all")).toBeNull();
    const gpx = parseGpx(`<gpx><trk><trkseg><trkpt lat="95" lon="0"/><trkpt lat="39" lon="-6"/></trkseg></trk></gpx>`)!;
    expect(gpx.lines).toEqual([]);
  });
});

describe("importing what a file brings", () => {
  it("adds tracks as walk routes and waypoints as places, in one valid document", () => {
    const gpx = parseGpx(strava)!;
    gpx.places.push({ name: "Fonte", at: S });
    const { doc, added, left } = importInto(createMapDoc("Herdade"), gpx, ids, 1, "walk");
    expect(left).toBe(0);
    expect(added).toHaveLength(2);
    expect(featureById(doc, added[0])?.properties).toMatchObject({ kind: "route", type: "walk", name: "Caça de salto & perdizes" });
    expect(featureById(doc, added[1])?.properties).toMatchObject({ kind: "pin", type: "landmark", name: "Fonte" });
    expect(parseMapDoc(JSON.parse(JSON.stringify(doc)))).not.toBeNull();
  });

  it("thins a long track to fit, keeps the file's name for an unnamed one, and cleans names", () => {
    const points: Position[] = [];
    for (let i = 0; i < 12_000; i++) points.push(destination(S, (i * 7) % 360, 50 + (i % 400)));
    const { doc, added } = importInto(
      createMapDoc("m"),
      { lines: [{ name: null, points }], places: [{ name: "日本 Fonte\n velha", at: S }], areas: [] },
      ids,
      1,
      "Volta de sábado",
    );
    const route = featureById(doc, added[0])!;
    expect((route.geometry.coordinates as Position[]).length).toBeLessThanOrEqual(LIMITS.vertices);
    expect(route.properties.name).toBe("Volta de sábado");
    expect(featureById(doc, added[1])?.properties.name).toBe("Fonte velha");
  });

  it("leaves out what does not fit, and counts it", () => {
    const places = Array.from({ length: LIMITS.features + 3 }, () => ({ name: null, at: S }));
    const { doc, left } = importInto(createMapDoc("m"), { lines: [], places, areas: [] }, ids, 1, "x");
    expect(doc.features).toHaveLength(LIMITS.features);
    expect(left).toBe(3);
  });
});

describe("writing GPX", () => {
  it("writes pins as waypoints, routes and areas as tracks, escaped, and reads them back", () => {
    let doc = createMapDoc("Herdade & Vale");
    doc = addPin(doc, { id: ids(), type: "gate", at: S, name: "Cancela <norte>" }, 1);
    doc = addRoute(doc, { id: ids(), type: "walk", line: [S, destination(S, 0, 100)], name: "Volta" }, 1);
    doc = addZone(doc, { id: ids(), type: "mancha", ring: [S, destination(S, 90, 100), destination(S, 0, 100)] }, 1);
    const back = parseGpx(toGpx(doc))!;
    expect(back.places).toEqual([{ name: "Cancela <norte>", at: S }]);
    expect(back.lines.map((l) => [l.name, l.points.length])).toEqual([
      ["Volta", 2],
      [null, 4],
    ]);
  });
});
