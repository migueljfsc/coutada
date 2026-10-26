import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { LIMITS } from "./catalogue";
import { newFeatureId } from "./ids";
import { loadMapDoc } from "./migrate";
import {
  addPin,
  addRoute,
  addZone,
  createMapDoc,
  deleteFeature,
  featureById,
  movePin,
  numberPortas,
  setArmada,
  setShape,
  updateProps,
} from "./operations";
import { docBytes, parseMapDoc } from "./schema";
import type { MapDoc } from "./types";

const S: Position = [-6.918, 39.882];
const T0 = 1_761_480_000_000;

const id = () => newFeatureId();

/** An armada running east 400 m, with three portas placed out of order along it. */
function montaria() {
  const armada = id();
  const [p1, p2, p3] = [id(), id(), id()];
  let doc = createMapDoc("Herdade do Vale");
  doc = addRoute(doc, { id: armada, type: "armada", line: [S, destination(S, 90, 400)] }, T0);
  doc = addPin(doc, { id: p1, type: "porta", at: destination(S, 90, 300) }, T0);
  doc = addPin(doc, { id: p2, type: "porta", at: destination(S, 90, 50) }, T0);
  doc = addPin(doc, { id: p3, type: "porta", at: destination(S, 90, 180) }, T0);
  for (const p of [p1, p2, p3]) doc = setArmada(doc, p, armada, T0);
  return { doc, armada, p1, p2, p3 };
}

const nOf = (doc: MapDoc, fid: string) => {
  const f = featureById(doc, fid);
  return f?.properties.kind === "pin" ? f.properties.n : undefined;
};

describe("ids", () => {
  it("are 22 base64url characters, from the random source given", () => {
    expect(newFeatureId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newFeatureId()).not.toBe(newFeatureId());
    expect(newFeatureId((b) => b.fill(255))).toBe("_____________________w");
  });
});

describe("operations", () => {
  it("never mutate their input", () => {
    const before = createMapDoc("m");
    const frozen = JSON.stringify(before);
    addPin(before, { id: id(), type: "gate", at: S }, T0);
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it("round coordinates to 6 decimals", () => {
    const pid = id();
    const doc = addPin(createMapDoc("m"), { id: pid, type: "gate", at: [-6.918123456, 39.882987654] }, T0);
    expect(featureById(doc, pid)?.geometry.coordinates).toEqual([-6.918123, 39.882988]);
  });

  it("close a zone's ring, also when it is reshaped", () => {
    const zid = id();
    const ring: Position[] = [S, destination(S, 90, 100), destination(S, 45, 140)];
    const doc = addZone(createMapDoc("m"), { id: zid, type: "mancha", ring }, T0);
    const coords = featureById(doc, zid)!.geometry.coordinates as Position[][];
    expect(coords[0]).toHaveLength(4);
    expect(coords[0][0]).toEqual(coords[0][3]);
    const reshaped = setShape(doc, zid, ring, T0 + 1);
    expect((featureById(reshaped, zid)!.geometry.coordinates as Position[][])[0]).toHaveLength(4);
  });

  it("set and clear properties, stamping updatedAt", () => {
    const pid = id();
    let doc = addPin(createMapDoc("m"), { id: pid, type: "landmark", at: S }, T0);
    doc = updateProps(doc, pid, { name: "Sobreiro da barragem", note: "Junto ao muro", color: "yellow" }, T0 + 5);
    expect(featureById(doc, pid)?.properties).toMatchObject({
      name: "Sobreiro da barragem",
      note: "Junto ao muro",
      color: "yellow",
      updatedAt: T0 + 5,
    });
    doc = updateProps(doc, pid, { note: "", color: null }, T0 + 6);
    const props = featureById(doc, pid)!.properties;
    expect(props).not.toHaveProperty("note");
    expect(props).not.toHaveProperty("color");
    expect(props.name).toBe("Sobreiro da barragem");
  });

  it("move a pin, and only a pin", () => {
    const pid = id();
    const rid = id();
    let doc = addPin(createMapDoc("m"), { id: pid, type: "gate", at: S }, T0);
    doc = addRoute(doc, { id: rid, type: "walk", line: [S, destination(S, 0, 50)] }, T0);
    const moved = movePin(doc, pid, [-6.9, 39.9], T0 + 1);
    expect(featureById(moved, pid)?.geometry.coordinates).toEqual([-6.9, 39.9]);
    expect(movePin(doc, rid, [-6.9, 39.9], T0 + 1).features[1]).toEqual(doc.features[1]);
  });
});

describe("portas and armadas", () => {
  it("number portas in order along the armada, not in the order they were placed", () => {
    const { doc, armada, p1, p2, p3 } = montaria();
    const numbered = numberPortas(doc, armada, T0 + 1);
    expect([nOf(numbered, p2), nOf(numbered, p3), nOf(numbered, p1)]).toEqual([1, 2, 3]);
    const from10 = numberPortas(doc, armada, T0 + 1, 10);
    expect([nOf(from10, p2), nOf(from10, p3), nOf(from10, p1)]).toEqual([10, 11, 12]);
  });

  it("put only a porta on an armada, and only on an armada", () => {
    const { doc, armada } = montaria();
    const gate = id();
    const walk = id();
    let d = addPin(doc, { id: gate, type: "gate", at: S }, T0);
    d = addRoute(d, { id: walk, type: "walk", line: [S, destination(S, 0, 100)] }, T0);
    expect(setArmada(d, gate, armada, T0)).toEqual(d);
    const porta = id();
    d = addPin(d, { id: porta, type: "porta", at: S }, T0);
    expect(setArmada(d, porta, walk, T0)).toBe(d);
  });

  it("free the portas when their armada is deleted", () => {
    const { doc, armada, p1 } = montaria();
    const after = deleteFeature(doc, armada, T0 + 1);
    expect(featureById(after, armada)).toBeUndefined();
    const porta = featureById(after, p1)!;
    expect(porta.properties).not.toHaveProperty("armada");
    expect(porta.properties.updatedAt).toBe(T0 + 1);
  });
});

describe("the schema", () => {
  it("accepts what the operations build", () => {
    const { doc, armada } = montaria();
    const numbered = numberPortas(doc, armada, T0 + 1);
    expect(parseMapDoc(JSON.parse(JSON.stringify(numbered)))).not.toBeNull();
  });

  it("drops unknown keys rather than keeping them", () => {
    const doc = { ...createMapDoc("m"), extra: 1, coutada: { v: 1, name: "m", secret: "x" } };
    const parsed = parseMapDoc(doc)!;
    expect(parsed).not.toHaveProperty("extra");
    expect(parsed.coutada).not.toHaveProperty("secret");
  });

  it("rejects what a map cannot hold", () => {
    const base = addPin(createMapDoc("m"), { id: id(), type: "gate", at: S }, T0);
    const gate = base.features[0];
    const bad: unknown[] = [
      { ...base, features: [{ ...gate, id: "short" }] },
      { ...base, features: [gate, gate] },
      { ...base, features: [{ ...gate, geometry: { type: "Point", coordinates: [200, 0] } }] },
      { ...base, features: [{ ...gate, properties: { ...gate.properties, n: 3 } }] },
      { ...base, features: [{ ...gate, properties: { ...gate.properties, name: "line\nbreak" } }] },
      { ...base, features: [{ ...gate, properties: { ...gate.properties, name: "日本" } }] },
      { ...base, coutada: { v: 1, name: "" } },
    ];
    for (const raw of bad) expect(parseMapDoc(raw)).toBeNull();
  });

  it("accepts every Portuguese accent in a label", () => {
    const pid = id();
    const doc = updateProps(
      addPin(createMapDoc("Caçada à perdiz"), { id: pid, type: "landmark", at: S }, T0),
      pid,
      { name: "Açude do João ãõçéêíóúàâô" },
      T0,
    );
    expect(parseMapDoc(doc)).not.toBeNull();
  });

  it("caps features and bytes", () => {
    let doc = createMapDoc("m");
    for (let i = 0; i <= LIMITS.features; i++) doc = addPin(doc, { id: id(), type: "gate", at: S }, T0);
    expect(parseMapDoc(doc)).toBeNull();

    const long = "x".repeat(LIMITS.note);
    let big = createMapDoc("m");
    while (docBytes(big) <= LIMITS.docBytes) {
      const fid = id();
      big = updateProps(addPin(big, { id: fid, type: "gate", at: S }, T0), fid, { note: long }, T0);
    }
    expect(big.features.length).toBeLessThanOrEqual(LIMITS.features);
    expect(parseMapDoc(big)).toBeNull();
  });
});

describe("loading", () => {
  it("loads a current map", () => {
    expect(loadMapDoc(createMapDoc("m")).ok).toBe(true);
  });

  it("refuses a newer version by name, and anything else as not a map", () => {
    const newer = loadMapDoc({ ...createMapDoc("m"), coutada: { v: 2, name: "m" } });
    expect(newer).toEqual({ ok: false, error: { key: "doc.tooNew", vars: { version: 2 } } });
    for (const raw of [null, 3, "map", {}, { coutada: {} }]) {
      expect(loadMapDoc(raw)).toEqual({ ok: false, error: { key: "doc.notAMap", vars: undefined } });
    }
    expect(loadMapDoc({ coutada: { v: 1 } })).toEqual({ ok: false, error: { key: "doc.invalid", vars: undefined } });
  });
});
