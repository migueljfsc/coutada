import { describe, expect, it } from "vitest";
import { addPin, createMapDoc, deleteFeature, movePin, updateProps } from "../doc/operations";
import type { MapDoc, MapFeature } from "../doc/types";
import type { Position } from "../geo/geo";
import { changes, moved, rebase, same } from "./docSync";

const S: Position = [-6.918, 39.882];
const N: Position = [-6.918, 39.892];
const ID = (c: string) => c.repeat(22);

/** The same feature as the hunt sends it back: its keys in another order. */
const reordered = (f: MapFeature): MapFeature => JSON.parse(JSON.stringify({ properties: f.properties, geometry: f.geometry, id: f.id, type: f.type }));
const echoed = (doc: MapDoc, f: MapFeature): MapDoc => ({ ...doc, features: doc.features.map((x) => (x.id === f.id ? reordered(f) : x)) });

const base = (): MapDoc => addPin(addPin(createMapDoc("Herdade"), { id: ID("a"), type: "gate", at: S }, 1), { id: ID("b"), type: "landmark", at: N }, 1);

describe("the host's drawings during a hunt", () => {
  it("compares features as values, whatever the key order", () => {
    const f = base().features[0];
    expect(same(f, reordered(f))).toBe(true);
    expect(same({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(same(f, { ...f, properties: { ...f.properties, name: "x" } })).toBe(false);
  });

  it("sends what the host added, changed and deleted, based on the revision it saw", () => {
    const server = base();
    let local = addPin(server, { id: ID("c"), type: "meeting", at: S }, 2);
    local = updateProps(local, ID("a"), { name: "Cancela" }, 2);
    local = deleteFeature(local, ID("b"), 2);
    const out = changes(server, local, 7);
    expect(out.map((m) => [m.t, m.t === "feature.put" ? m.f.id : m.id, m.base])).toEqual([
      ["feature.put", ID("a"), 7],
      ["feature.put", ID("c"), 7],
      ["feature.del", ID("b"), 7],
    ]);
  });

  it("sends nothing once the hunt echoes the change back in its own key order", () => {
    const server = base();
    const local = updateProps(server, ID("a"), { name: "Cancela" }, 2);
    const after = echoed(server, local.features[0]);
    expect(rebase(local, server, after)).toBe(local);
    expect(changes(after, local, 8)).toEqual([]);
  });

  it("takes the hunt's version of what the host has not touched, and keeps what the host has", () => {
    const server = base();
    const local = movePin(server, ID("a"), N, 2);
    const after = updateProps(updateProps(server, ID("b"), { name: "Marco" }, 3), ID("a"), { name: "Other" }, 3);
    const next = rebase(local, server, after);
    expect(next.features.find((f) => f.id === ID("b"))?.properties.name).toBe("Marco");
    expect(next.features.find((f) => f.id === ID("a"))?.geometry.coordinates).toEqual(N);
    expect(next.features.find((f) => f.id === ID("a"))?.properties.name).toBeUndefined();
  });

  it("gives way where the hunt overrules the host, and follows the hunt's additions and deletions", () => {
    const server = base();
    const local = movePin(server, ID("a"), N, 2);
    const rejected = { ...server, features: server.features.map((f) => (f.id === ID("a") ? reordered(f) : f)) };
    expect(rebase(local, server, rejected, new Set([ID("a")])).features[0].geometry.coordinates).toEqual(S);

    const after = addPin(deleteFeature(server, ID("b"), 3), { id: ID("d"), type: "water", at: S }, 3);
    expect(moved(server, after).sort()).toEqual([ID("b"), ID("d")]);
    expect(rebase(local, server, after).features.map((f) => f.id)).toEqual([ID("a"), ID("d")]);
  });
});
