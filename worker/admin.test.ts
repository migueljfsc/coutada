import { env as testEnv, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { addPin, createMapDoc } from "../src/doc/operations";
import { sweep, USAGE_KEEP_DAYS } from "./lib/cleanup";
import { createSession } from "./lib/session";
import { BROWSER_EVENTS } from "../src/share/usage";
import { USAGE_DAILY_CAP, USAGE_EVENTS, usageDay } from "./lib/usage";

const env = testEnv as unknown as Env;
const ORIGIN = "https://coutada.migueljfsc.dev";

let nextIp = 0;

function browser(token?: string) {
  const ip = `203.0.113.${++nextIp}`;
  return async (method: string, path: string, body?: unknown) => {
    const headers = new Headers({ "cf-connecting-ip": ip });
    if (token) headers.set("cookie", `ct_session=${token}`);
    if (body !== undefined) headers.set("content-type", "application/json");
    const r = await exports.default.fetch(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, any> };
  };
}

async function account(email: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?1, ?2, ?3)").bind(id, email, now).run();
  const { token } = await createSession(env, id, now);
  return { id, call: browser(token) };
}

const usage = async (event: string) =>
  (await env.DB.prepare("SELECT n FROM usage_daily WHERE day = ?1 AND event = ?2").bind(usageDay(Math.floor(Date.now() / 1000)), event).first<{ n: number }>())?.n ?? 0;

describe("the operator's view", () => {
  it("is one 404 for a stranger, a user, a wrong method and an unknown path", async () => {
    const user = await account("someone@example.com");
    const admin = await account("operator@example.com");
    for (const call of [browser(), user.call]) {
      expect((await call("GET", "/api/admin/stats")).status).toBe(404);
      expect((await call("GET", `/api/admin/users/${admin.id}`)).status).toBe(404);
    }
    expect((await admin.call("GET", "/api/admin/nothing")).status).toBe(404);
    expect((await admin.call("POST", "/api/admin/stats")).status).toBe(404);
    expect((await user.call("GET", "/api/me")).body.user.admin).toBe(false);
    expect((await admin.call("GET", "/api/me")).body.user.admin).toBe(true);
  });

  it("takes the address in any case, and shows counts, never a map's contents", async () => {
    const admin = await account("second@example.com");
    const owner = await account("owner@example.com");
    const doc = addPin(createMapDoc("Herdade secreta"), { id: "p".repeat(22), type: "gate", at: [-6.918, 39.882], name: "Cancela escondida" }, 1);
    const created = await owner.call("POST", "/api/maps", { doc });
    expect(created.status).toBe(201);

    const stats = await admin.call("GET", "/api/admin/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.totals.maps).toBeGreaterThanOrEqual(1);
    const row = stats.body.users.find((u: { email: string }) => u.email === "owner@example.com");
    expect(row).toMatchObject({ maps: 1, shared: 0 });
    expect(row.bytes).toBeGreaterThan(0);
    expect(JSON.stringify(stats.body)).not.toContain("Cancela escondida");

    const detail = await admin.call("GET", `/api/admin/users/${owner.id}`);
    expect(detail.body.maps).toEqual([expect.objectContaining({ name: "Herdade secreta", features: 1, hunting: 0 })]);
    expect(JSON.stringify(detail.body)).not.toContain("Cancela escondida");
    expect((await admin.call("GET", `/api/admin/users/${"x".repeat(22)}`)).status).toBe(404);
  });

  it("erases an account only when its address is repeated", async () => {
    const admin = await account("Operator@Example.COM");
    const gone = await account("leaving@example.com");
    expect((await admin.call("DELETE", `/api/admin/users/${gone.id}`, { confirm: "someone@else.com" })).status).toBe(400);
    expect((await admin.call("DELETE", `/api/admin/users/${gone.id}`, { confirm: " Leaving@Example.com " })).status).toBe(200);
    expect(await env.DB.prepare("SELECT 1 FROM users WHERE id = ?1").bind(gone.id).first()).toBeNull();
  });
});

describe("usage counters", () => {
  it("know every event the browser sends", () => {
    for (const event of BROWSER_EVENTS) expect(USAGE_EVENTS).toContain(event);
  });

  it("count a known event for anyone, and refuse an unknown one", async () => {
    const call = browser();
    const before = await usage("export.kml");
    expect((await call("POST", "/api/usage", { event: "export.kml" })).status).toBe(200);
    expect(await usage("export.kml")).toBe(before + 1);
    expect((await call("POST", "/api/usage", { event: "drop.table" })).status).toBe(400);
  });

  it("stop at the cap, and are swept after their keep", async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT OR REPLACE INTO usage_daily (day, event, n) VALUES (?1, 'import.gpx', ?2)").bind(usageDay(now), USAGE_DAILY_CAP).run();
    await browser()("POST", "/api/usage", { event: "import.gpx" });
    expect(await usage("import.gpx")).toBe(USAGE_DAILY_CAP);

    const old = usageDay(now - (USAGE_KEEP_DAYS + 1) * 24 * 60 * 60);
    await env.DB.prepare("INSERT INTO usage_daily (day, event, n) VALUES (?1, 'page.map', 3)").bind(old).run();
    await sweep(env, now);
    expect(await env.DB.prepare("SELECT 1 FROM usage_daily WHERE day = ?1").bind(old).first()).toBeNull();
  });
});
