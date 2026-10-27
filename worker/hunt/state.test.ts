import { describe, expect, it } from "vitest";
import { addPin, createMapDoc } from "../../src/doc/operations";
import { destination, type Position } from "../../src/geo/geo";
import type { MapFeature } from "../../src/doc/types";
import type { ClientMessage } from "../../src/live/protocol";
import { connected, emptyLive, join, reduce, welcome, type Out, type State } from "./state";

const S: Position = [-6.918, 39.882];
const T = 1_800_000_000_000;
const ID = (c: string) => c.repeat(22);

function hunt(type: "salto" | "montaria" = "salto"): State {
  const base: State = {
    meta: { type, code: "BCDF", locked: false, endsAt: T + 18 * 3600_000, mapId: ID("m") },
    members: [],
    doc: createMapDoc("Herdade"),
    rev: 0,
    revs: {},
    obs: [],
    ...emptyLive(),
  };
  let s = base;
  for (const [id, name, host] of [
    [ID("h"), "Pai", true],
    [ID("a"), "João", false],
  ] as const) {
    const r = join(s, { id, name, verified: false, token: id, host });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

const run = (s: State, who: string, msg: ClientMessage) => reduce(s, who, msg, T);
const sent = (out: Out[]) => out.flatMap((o) => ("msg" in o ? [o] : []));

describe("joining", () => {
  it("gives a taken name a number instead of refusing it", () => {
    const r = join(hunt(), { id: ID("b"), name: "joão", verified: false, token: "x" });
    expect(r.ok && r.member.name).toBe("joão (2)");
  });

  it("is refused when locked, but not for the host", () => {
    const locked = run(hunt(), ID("h"), { t: "hunt.lock", on: true }).state;
    expect(join(locked, { id: ID("b"), name: "B", verified: false, token: "x" })).toEqual({ ok: false, error: "locked" });
  });

  it("starts a montaria member at a porta and a salto member walking", () => {
    const r = join(hunt("montaria"), { id: ID("b"), name: "B", verified: false, token: "x" });
    expect(r.ok && r.member.role).toBe("porta");
    expect(hunt("salto").members[1].role).toBe("member");
  });
});

describe("positions and trails", () => {
  it("relay a position to the others with the time it was received, and grow the trail in a salto", () => {
    const { state, out } = run(hunt(), ID("a"), { t: "pos", c: S, acc: 5, at: T - 1000 });
    expect(sent(out)).toEqual([{ to: "others", msg: { t: "pos", m: ID("a"), c: S, acc: 5, at: T - 1000, rt: T } }]);
    expect(state.trails[ID("a")]).toHaveLength(1);
    expect(out.some((o) => "persist" in o)).toBe(false);
  });

  it("draw no trail for a porta in a montaria", () => {
    const { state } = run(hunt("montaria"), ID("a"), { t: "pos", c: S, acc: 5, at: T });
    expect(state.trails[ID("a")]).toBeUndefined();
    const batedor = run(run(hunt("montaria"), ID("a"), { t: "role", role: "batedor" }).state, ID("a"), { t: "pos", c: S, acc: 5, at: T });
    expect(batedor.state.trails[ID("a")]).toHaveLength(1);
  });

  it("take a member's own trail whole when they send it", () => {
    const pts: [number, number, number][] = [
      [S[0], S[1], 1],
      [...destination(S, 0, 50), 2] as [number, number, number],
    ];
    const { state, out } = run(hunt(), ID("a"), { t: "trail.sync", pts });
    expect(state.trails[ID("a")]).toEqual(pts);
    expect(sent(out)[0]).toEqual({ to: "others", msg: { t: "trail", m: ID("a"), pts } });
  });
});

describe("the map, live", () => {
  const pin = addPin(createMapDoc("m"), { id: ID("p"), type: "gate", at: S }, 1).features[0];

  it("takes the host's edits, bumps the revision and asks for a write-back", () => {
    const { state, out } = run(hunt(), ID("h"), { t: "feature.put", f: pin, base: 0 });
    expect(state.rev).toBe(1);
    expect(state.doc.features).toHaveLength(1);
    expect(out).toContainEqual({ writeBack: true });
    expect(sent(out)[0]).toEqual({ to: "all", msg: { t: "feature.put", f: pin, rev: 1 } });
  });

  it("refuses a member's edit, and an edit based on a stale revision of the same feature", () => {
    expect(sent(run(hunt(), ID("a"), { t: "feature.put", f: pin, base: 0 }).out)[0].msg).toEqual({ t: "error", code: "forbidden" });
    const once = run(hunt(), ID("h"), { t: "feature.put", f: pin, base: 0 }).state;
    const renamed = { ...pin, properties: { ...pin.properties, name: "x" } } as MapFeature;
    const stale = run(once, ID("h"), { t: "feature.put", f: renamed, base: 0 });
    expect(stale.state).toBe(once);
    expect(sent(stale.out)[0].msg).toMatchObject({ t: "feature.reject", id: ID("p"), rev: 1 });
  });
});

describe("observations", () => {
  const obs = { id: ID("o"), subject: "partridge" as const, event: "flushed" as const, c: S };

  it("are anybody's to add and their own to remove, and any to the host", () => {
    const added = run(hunt(), ID("a"), { t: "obs.put", obs }).state;
    expect(added.obs[0]).toMatchObject({ by: ID("a"), at: T });
    const b = join(added, { id: ID("b"), name: "B", verified: false, token: "x" });
    if (!b.ok) throw new Error();
    expect(sent(run(b.state, ID("b"), { t: "obs.del", id: ID("o") }).out)[0].msg).toEqual({ t: "error", code: "forbidden" });
    expect(run(b.state, ID("h"), { t: "obs.del", id: ID("o") }).state.obs).toEqual([]);
  });
});

describe("the host's controls", () => {
  it("kick a member: their sockets close, their trace goes, and the others are told", () => {
    let s = run(hunt(), ID("a"), { t: "pos", c: S, acc: 5, at: T }).state;
    const { state, out } = run(s, ID("h"), { t: "hunt.kick", member: ID("a") });
    expect(out).toContainEqual({ close: ID("a"), code: 4003 });
    expect(state.positions[ID("a")]).toBeUndefined();
    expect(sent(out).map((o) => o.msg)).toContainEqual({ t: "member.gone", id: ID("a") });
    s = state;
    expect(run(s, ID("a"), { t: "pos", c: S, acc: 5, at: T }).state).toBe(s);
    expect(connected(s, ID("a"), -1).out).toEqual([]);
  });

  it("are the host's alone", () => {
    for (const msg of [{ t: "hunt.end" }, { t: "hunt.rotate" }, { t: "hunt.lock", on: true }, { t: "hunt.kick", member: ID("h") }] as ClientMessage[]) {
      expect(sent(run(hunt(), ID("a"), msg).out)[0].msg).toEqual({ t: "error", code: "forbidden" });
    }
    expect(run(hunt(), ID("h"), { t: "hunt.end" }).out).toEqual([{ end: "host" }]);
  });
});

describe("welcome and presence", () => {
  it("tells a member who they are and everything live", () => {
    const s = connected(run(hunt(), ID("a"), { t: "pos", c: S, acc: 5, at: T }).state, ID("a"), 1).state;
    const w = welcome(s, ID("a"), T);
    expect(w).toMatchObject({ t: "welcome", you: { id: ID("a"), host: false }, hunt: { code: "BCDF" } });
    if (w.t !== "welcome") throw new Error();
    expect(w.members.find((m) => m.id === ID("a"))?.online).toBe(true);
    expect(w.positions[ID("a")].rt).toBe(T);
    expect(JSON.stringify(w)).not.toContain('"token"');
  });
});
