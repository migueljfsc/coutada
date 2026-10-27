import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { addPin, addRoute, addZone, createMapDoc, featureById, updateProps } from "../doc/operations";
import { dragShape, observationImage, pinImage, portaImage, render, withoutVertex } from "./drawing";

const S: Position = [-6.918, 39.882];
const T = 0;
const ID = (c: string) => c.repeat(22);

function doc() {
  let d = createMapDoc("m");
  d = addPin(d, { id: ID("a"), type: "gate", at: S }, T);
  d = addPin(d, { id: ID("b"), type: "porta", at: destination(S, 0, 50) }, T);
  d = addRoute(d, { id: ID("c"), type: "walk", line: [S, destination(S, 90, 200), destination(S, 45, 300)] }, T);
  d = addZone(d, { id: ID("d"), type: "mancha", ring: [S, destination(S, 90, 100), destination(S, 45, 140)] }, T);
  return updateProps(d, ID("c"), { name: "Caminho do açude", color: "magenta" }, T);
}

describe("render", () => {
  it("draws every feature, with its colour and the image a pin wears", () => {
    const { shapes } = render(doc());
    const byId = Object.fromEntries(shapes.features.map((f) => [f.properties.fid, f.properties]));
    expect(byId[ID("a")]).toMatchObject({ kind: "pin", icon: pinImage("gate", "yellow"), colour: "#ffd23f", sel: 0 });
    expect(byId[ID("b")].icon).toBe(portaImage(undefined));
    expect(byId[ID("c")]).toMatchObject({ kind: "route", colour: "#ff4fa3" });
    expect(byId[ID("d")].icon).toBeUndefined();
  });

  it("labels only what has a name", () => {
    const { labels } = render(doc());
    expect(labels.features.map((l) => l.properties.label)).toEqual(["label:Caminho do açude"]);
  });

  it("gives the selected route its vertices and midpoints, and marks it", () => {
    const { shapes, handles } = render(doc(), { selected: ID("c"), editing: true });
    expect(shapes.features.find((f) => f.properties.fid === ID("c"))?.properties.sel).toBe(1);
    expect(handles.features.filter((h) => h.properties.role === "vertex")).toHaveLength(3);
    expect(handles.features.filter((h) => h.properties.role === "mid")).toHaveLength(2);
  });

  it("shows no handles unless the shape is being edited", () => {
    expect(render(doc(), { selected: ID("c") }).handles.features).toEqual([]);
  });

  it("closes an area's midpoints round, and gives a pin no handles", () => {
    expect(render(doc(), { selected: ID("d"), editing: true }).handles.features.filter((h) => h.properties.role === "mid")).toHaveLength(3);
    expect(render(doc(), { selected: ID("a"), editing: true }).handles.features).toEqual([]);
  });

  it("draws the line in progress, and the area once it has three points", () => {
    const two = render(createMapDoc("m"), { tool: { kind: "area", type: "mancha", points: [S, destination(S, 0, 10)] } });
    expect(two.draft.features.map((f) => f.properties.role)).toEqual(["line", "vertex", "vertex"]);
    const three = render(createMapDoc("m"), { tool: { kind: "area", type: "mancha", points: [S, destination(S, 0, 10), destination(S, 90, 10)] } });
    expect(three.draft.features[0].properties.role).toBe("area");
  });

  it("draws the hunt's sightings, tappable by id, the chosen one marked", () => {
    const { observations } = render(createMapDoc("m"), {
      observations: [
        { id: ID("o"), type: "covey", at: S },
        { id: ID("p"), type: "dog", at: S },
      ],
      sighting: ID("p"),
    });
    expect(observations.features.map((f) => f.properties)).toEqual([
      { fid: ID("o"), icon: observationImage("covey"), sel: 0 },
      { fid: ID("p"), icon: observationImage("dog"), sel: 1 },
    ]);
  });
});

describe("editing a shape", () => {
  it("moves a vertex, and inserts one where a midpoint is dragged", () => {
    const route = featureById(doc(), ID("c"))!;
    const to: Position = [-6.9, 39.9];
    expect(dragShape(route, "vertex", 1, to)?.[1]).toEqual(to);
    const inserted = dragShape(route, "mid", 0, to)!;
    expect(inserted).toHaveLength(4);
    expect(inserted[1]).toEqual(to);
  });

  it("removes a vertex, but never below a line's two or an area's three", () => {
    const d = doc();
    expect(withoutVertex(featureById(d, ID("c"))!, 1)).toHaveLength(2);
    expect(withoutVertex(featureById(d, ID("d"))!, 0)).toBeNull();
  });
});
