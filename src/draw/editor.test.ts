import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { featureById } from "../doc/operations";
import { createMapDoc } from "../doc/operations";
import { parseMapDoc } from "../doc/schema";
import { initialEditor, reduce, type Action, type EditorState } from "./editor";

const S: Position = [-6.918, 39.882];
const T = 1_761_480_000_000;
let n = 0;
const id = () => `id${String(n++).padStart(20, "0")}`;

const run = (state: EditorState, ...actions: Action[]) => actions.reduce(reduce, state);
const fresh = () => initialEditor(createMapDoc("Herdade"));

/** Draws an armada east from S, 400 m long, and returns its id. */
function withArmada() {
  const armada = id();
  const state = run(
    fresh(),
    { type: "tool", tool: { kind: "line", type: "armada", points: [] } },
    { type: "tap", at: S, hit: null, id: id(), now: T },
    { type: "tap", at: destination(S, 90, 400), hit: null, id: id(), now: T },
    { type: "finish", id: armada, now: T },
  );
  return { state, armada };
}

const portaN = (s: EditorState, fid: string) => {
  const f = featureById(s.doc, fid);
  return f?.properties.kind === "pin" ? [f.properties.armada, f.properties.n] : null;
};

describe("the editor", () => {
  it("places a pin with one tap, selects it, and puts the tool down", () => {
    const pin = id();
    const s = run(fresh(), { type: "tool", tool: { kind: "pin", type: "gate" } }, { type: "tap", at: S, hit: null, id: pin, now: T });
    expect(featureById(s.doc, pin)?.properties).toMatchObject({ kind: "pin", type: "gate" });
    expect(s.selected).toBe(pin);
    expect(s.tool).toEqual({ kind: "idle" });
    expect(s.past).toHaveLength(1);
  });

  it("selects by tapping a feature when no tool is in hand, and deselects on empty ground", () => {
    const { state, armada } = withArmada();
    expect(run(state, { type: "select", id: null }, { type: "tap", at: S, hit: armada, id: id(), now: T }).selected).toBe(armada);
    expect(run(state, { type: "tap", at: S, hit: null, id: id(), now: T }).selected).toBeNull();
  });

  it("builds a line point by point, undoes a point, and needs two to finish", () => {
    let s = run(fresh(), { type: "tool", tool: { kind: "line", type: "walk", points: [] } }, { type: "tap", at: S, hit: null, id: id(), now: T });
    const before = s;
    s = run(s, { type: "finish", id: id(), now: T });
    expect(s).toBe(before);
    s = run(s, { type: "tap", at: destination(S, 0, 50), hit: null, id: id(), now: T }, { type: "undoPoint" });
    expect(s.tool).toMatchObject({ points: [S] });
  });

  it("closes an area of three or more points", () => {
    const zone = id();
    const s = run(
      fresh(),
      { type: "tool", tool: { kind: "area", type: "mancha", points: [] } },
      { type: "tap", at: S, hit: null, id: id(), now: T },
      { type: "tap", at: destination(S, 90, 100), hit: null, id: id(), now: T },
      { type: "tap", at: destination(S, 45, 140), hit: null, id: id(), now: T },
      { type: "finish", id: zone, now: T },
    );
    const coords = featureById(s.doc, zone)!.geometry.coordinates as Position[][];
    expect(coords[0]).toHaveLength(4);
    expect(parseMapDoc(s.doc)).not.toBeNull();
  });

  it("stands a porta placed near an armada on it, numbered along it", () => {
    let { state } = withArmada();
    const [a, b, c] = [id(), id(), id()];
    for (const [pid, m] of [
      [a, 300],
      [b, 50],
      [c, 180],
    ] as const) {
      state = run(state, { type: "tool", tool: { kind: "pin", type: "porta" } }, { type: "tap", at: destination(destination(S, 90, m), 0, 15), hit: null, id: pid, now: T });
    }
    const armada = (featureById(state.doc, b)!.properties as { armada?: string }).armada;
    expect(portaN(state, b)).toEqual([armada, 1]);
    expect(portaN(state, c)).toEqual([armada, 2]);
    expect(portaN(state, a)).toEqual([armada, 3]);
  });

  it("leaves a porta placed far from every armada on its own, unnumbered", () => {
    const { state } = withArmada();
    const far = id();
    const s = run(state, { type: "tool", tool: { kind: "pin", type: "porta" } }, { type: "tap", at: destination(S, 0, 500), hit: null, id: far, now: T });
    expect(portaN(s, far)).toEqual([undefined, undefined]);
    expect(portaN(run(s, { type: "number", id: far, n: 7, now: T }), far)).toEqual([undefined, 7]);
  });

  it("records a drag as one undo step", () => {
    const pin = id();
    let s = run(fresh(), { type: "tool", tool: { kind: "pin", type: "gate" } }, { type: "tap", at: S, hit: null, id: pin, now: T });
    const placed = s.past.length;
    s = run(
      s,
      { type: "move", id: pin, at: destination(S, 0, 5), now: T, record: true },
      { type: "move", id: pin, at: destination(S, 0, 10), now: T, record: false },
      { type: "move", id: pin, at: destination(S, 0, 15), now: T, record: false },
    );
    expect(s.past).toHaveLength(placed + 1);
    const undone = run(s, { type: "undo" });
    expect(featureById(undone.doc, pin)?.geometry.coordinates).toEqual([S[0], S[1]]);
  });

  it("undoes and redoes, and a new change clears what could be redone", () => {
    const { state } = withArmada();
    const undone = run(state, { type: "undo" });
    expect(undone.doc.features).toHaveLength(0);
    expect(undone.selected).toBeNull();
    const redone = run(undone, { type: "redo" });
    expect(redone.doc).toBe(state.doc);
    const branched = run(undone, { type: "rename", name: "Outra" });
    expect(branched.future).toEqual([]);
  });

  it("deselects what it deletes", () => {
    const { state, armada } = withArmada();
    const s = run(state, { type: "delete", id: armada, now: T });
    expect(s.selected).toBeNull();
    expect(s.doc.features).toHaveLength(0);
  });
});
