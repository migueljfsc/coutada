import { env as testEnv, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addPin, createMapDoc } from "../src/doc/operations";
import { PROTOCOL, type ServerMessage } from "../src/live/protocol";

const env = testEnv as unknown as Env;
const ORIGIN = "https://coutada.migueljfsc.dev";
let nextIp = 0;

function browser() {
  const ip = `192.0.2.${++nextIp}`;
  const jar = new Map<string, string>();
  return {
    async call(method: string, path: string, body?: unknown) {
      const headers = new Headers({ "cf-connecting-ip": ip });
      if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      if (body !== undefined) headers.set("content-type", "application/json");
      const r = await exports.default.fetch(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const set of r.headers.getSetCookie()) {
        const [pair] = set.split(";");
        const eq = pair.indexOf("=");
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      return { status: r.status, body: (await r.json().catch(() => null)) as any };
    },
  };
}

/** A live socket that records every message it receives. */
async function socket(huntId: string, token: string, origin = ORIGIN) {
  const r = await exports.default.fetch(`${ORIGIN}/api/hunts/${huntId}/ws`, {
    headers: { upgrade: "websocket", origin, "sec-websocket-protocol": `${PROTOCOL}, ${token}` },
  });
  if (!r.webSocket) return { status: r.status, ws: null, got: [] as ServerMessage[] };
  const ws = r.webSocket;
  const got: ServerMessage[] = [];
  ws.accept();
  ws.addEventListener("message", (e) => got.push(JSON.parse(String(e.data))));
  return { status: r.status, ws, got };
}

const until = async (check: () => boolean) => vi.waitFor(() => expect(check()).toBe(true), { timeout: 2000 });

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input instanceof Request ? input.url : input).includes("challenges.cloudflare.com")) return Response.json({ success: true });
    throw new Error("unexpected fetch");
  });
});
afterEach(() => vi.restoreAllMocks());

/** A host with a saved map and a running hunt, and a second person who joined it. */
async function started(type: "salto" | "montaria" = "salto") {
  const host = browser();
  await host.call("POST", "/api/device", { username: "Pai", turnstile: "t" });
  const doc = addPin(createMapDoc("Herdade"), { id: "g".repeat(22), type: "gate", at: [-6.918, 39.882] }, 1);
  const mapId = (await host.call("POST", "/api/maps", { doc })).body.map.id;
  const created = await host.call("POST", "/api/hunts", { mapId, type });
  expect(created.status).toBe(201);
  const { hunt, member: hostMember } = created.body;

  const guest = browser();
  const joined = await guest.call("POST", "/api/hunts/join", { code: hunt.code.toLowerCase(), username: "Filho", turnstile: "t" });
  expect(joined.status).toBe(200);
  return { host, guest, mapId, hunt, hostMember, guestMember: joined.body.member };
}

describe("starting and joining", () => {
  it("gives a four-character code from the alphabet without look-alikes", async () => {
    const { hunt } = await started();
    expect(hunt.code).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXZ]{4}$/);
  });

  it("answers an unknown code like a locked one: 404", async () => {
    expect((await browser().call("POST", "/api/hunts/join", { code: "ZZZZ", username: "X", turnstile: "t" })).status).toBe(404);
  });

  it("allows one live hunt per host", async () => {
    const { host, mapId } = await started();
    const again = await host.call("POST", "/api/hunts", { mapId, type: "salto" });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("hunt_exists");
  });

  it("holds the map's REST saves while it runs", async () => {
    const { host, hunt, mapId } = await started();
    const doc = createMapDoc("Outra");
    expect((await host.call("PUT", `/api/maps/${mapId}`, { doc, version: 1 })).body).toEqual({ error: "hunt_active", hunt: { id: hunt.id } });
    expect((await host.call("GET", `/api/maps/${mapId}`)).body.map.hunt).toEqual({ id: hunt.id });
    const stranger = browser();
    await stranger.call("POST", "/api/device", { username: "Outro", turnstile: "t" });
    expect((await stranger.call("PUT", `/api/maps/${mapId}`, { doc, version: 1 })).status).toBe(404);
  });
});

describe("the live connection", () => {
  it("refuses a socket without a member token, or from another site", async () => {
    const { hunt, guestMember } = await started();
    expect((await socket(hunt.id, "x".repeat(43))).status).toBe(401);
    expect((await socket(hunt.id, guestMember.token, "https://evil.example")).status).toBe(403);
  });

  it("welcomes a member and relays positions to the others, never back to the sender", async () => {
    const { hunt, hostMember, guestMember } = await started();
    const h = await socket(hunt.id, hostMember.token);
    const g = await socket(hunt.id, guestMember.token);
    await until(() => g.got.some((m) => m.t === "welcome"));
    const w = g.got.find((m) => m.t === "welcome");
    expect(w).toMatchObject({ you: { id: guestMember.id, host: false }, hunt: { code: hunt.code } });

    g.ws!.send(JSON.stringify({ t: "pos", c: [-6.918, 39.882], acc: 5, at: Date.now() }));
    await until(() => h.got.some((m) => m.t === "pos"));
    expect(h.got.find((m) => m.t === "pos")).toMatchObject({ m: guestMember.id, c: [-6.918, 39.882] });
    expect(g.got.some((m) => m.t === "pos")).toBe(false);
  });

  it("lets the host lock, kick and end; a kicked member's token stops working", async () => {
    const { hunt, hostMember, guestMember } = await started();
    const h = await socket(hunt.id, hostMember.token);
    const g = await socket(hunt.id, guestMember.token);
    await until(() => h.got.some((m) => m.t === "welcome") && g.got.some((m) => m.t === "welcome"));

    h.ws!.send(JSON.stringify({ t: "hunt.lock", on: true }));
    await until(() => g.got.some((m) => m.t === "hunt" && m.locked));
    expect((await browser().call("POST", "/api/hunts/join", { code: hunt.code, username: "Tarde", turnstile: "t" })).status).toBe(404);

    h.ws!.send(JSON.stringify({ t: "hunt.kick", member: guestMember.id }));
    await until(() => h.got.some((m) => m.t === "member.gone"));
    expect((await socket(hunt.id, guestMember.token)).status).toBe(401);

    h.ws!.send(JSON.stringify({ t: "hunt.end" }));
    await until(() => h.got.some((m) => m.t === "ended"));
    expect(await env.DB.prepare("SELECT 1 FROM hunts WHERE id = ?1").bind(hunt.id).first()).toBeNull();
  });

  it("refuses a member's map edit and anything that is not a message", async () => {
    const { hunt, guestMember } = await started();
    const g = await socket(hunt.id, guestMember.token);
    await until(() => g.got.some((m) => m.t === "welcome"));
    g.ws!.send("not json");
    g.ws!.send(JSON.stringify({ t: "hunt.end" }));
    await until(() => g.got.filter((m) => m.t === "error").length === 2);
    expect(g.got.filter((m) => m.t === "error").map((m) => (m as { code: string }).code)).toEqual(["invalid_message", "forbidden"]);
  });
});
