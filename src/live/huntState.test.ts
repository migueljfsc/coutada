import { describe, expect, it } from "vitest";
import { addPin, createMapDoc } from "../doc/operations";
import { destination, type Position } from "../geo/geo";
import { ageMs, applyServer, emptyView, type HuntView } from "./huntState";
import type { ServerMessage } from "./protocol";

const S: Position = [-6.918, 39.882];
const ID = (c: string) => c.repeat(22);
const member = (id: string, role: "member" | "porta" | "batedor" = "member") => ({ id, name: id.slice(0, 3), role, host: false, verified: false, online: true, away: false });

function welcomed(type: "salto" | "montaria" = "salto"): HuntView {
  const msg: ServerMessage = {
    t: "welcome",
    you: { id: ID("a"), role: "member", host: false },
    now: 10_000,
    hunt: { type, code: "BCDF", locked: false, endsAt: 99_999_999, mapId: ID("m") },
    members: [member(ID("a")), member(ID("b"), type === "montaria" ? "porta" : "member")],
    positions: {},
    doc: createMapDoc("Herdade"),
    rev: 0,
    obs: [],
    trails: {},
  };
  return applyServer(emptyView(), msg, 7_000);
}

describe("a phone's view of the hunt", () => {
  it("takes the server's clock offset from the welcome, and asks for the phone's trail", () => {
    const v = welcomed();
    expect(v.offset).toBe(3_000);
    expect(v.trailRequested).toBe(1);
    expect(ageMs({ c: S, acc: 5, at: 0, rt: 12_000 }, v.offset, 10_000)).toBe(1_000);
  });

  it("grows another member's trail from their positions in a salto, not at a porta", () => {
    let v = welcomed();
    v = applyServer(v, { t: "pos", m: ID("b"), c: S, acc: 5, at: 1000, rt: 1000 }, 0);
    v = applyServer(v, { t: "pos", m: ID("b"), c: destination(S, 0, 30), acc: 5, at: 2000, rt: 2000 }, 0);
    expect(v.trails[ID("b")]).toHaveLength(2);
    let m = welcomed("montaria");
    m = applyServer(m, { t: "pos", m: ID("b"), c: S, acc: 5, at: 1000, rt: 1000 }, 0);
    expect(m.trails[ID("b")]).toBeUndefined();
    expect(m.positions[ID("b")]).toBeDefined();
  });

  it("forgets a member who is removed", () => {
    let v = applyServer(welcomed(), { t: "pos", m: ID("b"), c: S, acc: 5, at: 1, rt: 1 }, 0);
    v = applyServer(v, { t: "member.gone", id: ID("b") }, 0);
    expect(v.members[ID("b")]).toBeUndefined();
    expect(v.positions[ID("b")]).toBeUndefined();
  });

  it("applies map edits and a rejected edit's server copy", () => {
    const pin = addPin(createMapDoc("m"), { id: ID("p"), type: "gate", at: S }, 1).features[0];
    let v = applyServer(welcomed(), { t: "feature.put", f: pin, rev: 4 }, 0);
    expect(v.doc?.features).toHaveLength(1);
    expect(v.rev).toBe(4);
    v = applyServer(v, { t: "feature.reject", id: ID("p"), f: null, rev: 5 }, 0);
    expect(v.doc?.features).toHaveLength(0);
    expect(v.rejected).toEqual([ID("p")]);
    v = applyServer(applyServer(v, { t: "error", code: "too_many" }, 0), { t: "error", code: "too_many" }, 0);
    expect(v.errors).toBe(2);
  });

  it("follows the code, the lock and the end", () => {
    let v = applyServer(welcomed(), { t: "hunt", code: "GHJK", locked: true, endsAt: 5 }, 0);
    expect(v.hunt).toMatchObject({ code: "GHJK", locked: true });
    v = applyServer(v, { t: "ended", reason: "host" }, 0);
    expect(v.ended).toBe("host");
  });
});
