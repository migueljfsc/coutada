import { env as testEnv, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addPin, createMapDoc } from "../src/doc/operations";
import { SECURITY_HEADERS } from "./lib/headers";
import { createSession } from "./lib/session";
import { sweep } from "./lib/cleanup";
import { DEVICE_TTL_S } from "./lib/limits";

const env = testEnv as unknown as Env;
const ORIGIN = "https://coutada.migueljfsc.dev";
const KEY = "k".repeat(43);

let nextIp = 0;

/** A browser on its own address: it keeps the cookies the Worker sets and sends them back. */
function browser(ip = `198.51.100.${++nextIp}`) {
  const jar = new Map<string, string>();
  return {
    jar,
    async call(method: string, path: string, body?: unknown, contentType = "application/json") {
      const headers = new Headers({ "cf-connecting-ip": ip });
      if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      if (body !== undefined) headers.set("content-type", contentType);
      const response = await exports.default.fetch(`${ORIGIN}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        redirect: "manual",
      });
      for (const set of response.headers.getSetCookie()) {
        const [pair, ...attrs] = set.split(";");
        const eq = pair.indexOf("=");
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (attrs.some((a) => a.trim() === "Max-Age=0")) jar.delete(name);
        else jar.set(name, value);
      }
      return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, any>, headers: response.headers };
    },
  };
}

const doc = (name = "Herdade") => addPin(createMapDoc(name), { id: "p".repeat(22), type: "gate", at: [-6.918, 39.882] }, 1);

let sentMail: { to: string[]; text: string }[] = [];
let turnstileOk = true;

beforeEach(() => {
  sentMail = [];
  turnstileOk = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("challenges.cloudflare.com")) return Response.json({ success: turnstileOk });
    if (url.includes("api.resend.com")) {
      sentMail.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "mail" });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

afterEach(() => vi.restoreAllMocks());

async function withDevice(name = "João", ip?: string) {
  const b = browser(ip);
  const created = await b.call("POST", "/api/device", { username: name, turnstile: "tok" });
  expect(created.status).toBe(201);
  return b;
}

async function signedInUser(email: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?1, ?2, NULL, NULL, ?3)")
    .bind(id, email, now)
    .run();
  const { token } = await createSession(env, id, now);
  return { id, token };
}

describe("the surface", () => {
  it("tells a stranger they are nobody, without a 401", async () => {
    const r = await browser().call("GET", "/api/me");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ user: null, device: null, claimable: null });
  });

  it("answers an unknown path with 404 and sends every security header", async () => {
    const r = await browser().call("GET", "/api/nothing");
    expect(r.status).toBe(404);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(r.headers.get(name)).toBe(value);
  });
});

describe("devices", () => {
  it("are created with a username and a passed Turnstile, and come back in /api/me", async () => {
    const b = await withDevice("João");
    expect(b.jar.get("ct_device")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await b.call("GET", "/api/me")).body.device).toEqual({ username: "João" });
  });

  it("refuse a failed Turnstile, a bad name, and a body that is not JSON", async () => {
    turnstileOk = false;
    expect((await browser().call("POST", "/api/device", { username: "João", turnstile: "tok" })).body.error).toBe("captcha_failed");
    turnstileOk = true;
    expect((await browser().call("POST", "/api/device", { username: "", turnstile: "tok" })).body.error).toBe("invalid_username");
    const plain = await browser().call("POST", "/api/device", JSON.stringify({ username: "João", turnstile: "tok" }), "text/plain");
    expect(plain.status).toBe(400);
  });

  it("move to another browser with a single-use code", async () => {
    const phone = await withDevice("Pai");
    const { code } = (await phone.call("POST", "/api/device/transfer")).body;
    expect(code).toMatch(/^[2-9BCDFGHJKMNPQRSTVWXZ]{8}$/);

    const app = browser("203.0.113.9");
    const redeemed = await app.call("POST", "/api/device/transfer/redeem", { code: code.toLowerCase() });
    expect(redeemed.status).toBe(200);
    expect((await app.call("GET", "/api/me")).body.device).toEqual({ username: "Pai" });
    expect(app.jar.get("ct_device")).not.toBe(phone.jar.get("ct_device"));
    expect((await browser().call("POST", "/api/device/transfer/redeem", { code })).body.error).toBe("invalid_code");
  });

  it("are deleted only when the username is typed back, with their maps", async () => {
    const b = await withDevice("Pai");
    await b.call("POST", "/api/maps", { doc: doc() });
    expect((await b.call("DELETE", "/api/device", { confirm: "pai" })).body.error).toBe("confirmation_mismatch");
    expect((await b.call("DELETE", "/api/device", { confirm: "Pai" })).status).toBe(200);
    expect(b.jar.has("ct_device")).toBe(false);
    const left = await env.DB.prepare("SELECT count(*) AS n FROM maps").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("expire after 90 days unused, and the sweep takes their maps", async () => {
    const b = await withDevice("Velho");
    await b.call("POST", "/api/maps", { doc: doc() });
    const now = Math.floor(Date.now() / 1000);
    await sweep(env, now + DEVICE_TTL_S + 1);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM devices").first<{ n: number }>())?.n).toBe(0);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM maps").first<{ n: number }>())?.n).toBe(0);
  });
});

describe("maps", () => {
  it("need somebody to own them", async () => {
    expect((await browser().call("POST", "/api/maps", { doc: doc() })).status).toBe(401);
  });

  it("are created, listed, read and saved with optimistic concurrency", async () => {
    const b = await withDevice();
    const created = await b.call("POST", "/api/maps", { doc: doc("Herdade do Vale") });
    expect(created.status).toBe(201);
    const id = created.body.map.id;

    expect((await b.call("GET", "/api/maps")).body.maps.map((m: { name: string }) => m.name)).toEqual(["Herdade do Vale"]);
    const read = await b.call("GET", `/api/maps/${id}`);
    expect(read.body.map.doc.features).toHaveLength(1);
    expect(read.body.map.version).toBe(1);

    expect((await b.call("PUT", `/api/maps/${id}`, { doc: doc("Renomeada"), version: 1 })).body.map.version).toBe(2);
    const stale = await b.call("PUT", `/api/maps/${id}`, { doc: doc(), version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: "version_conflict", version: 2 });
    expect((await b.call("GET", "/api/maps")).body.maps[0].name).toBe("Renomeada");
  });

  it("refuse a document the schema refuses", async () => {
    const b = await withDevice();
    const bad = { ...doc(), features: [{ type: "Feature", id: "short" }] };
    expect((await b.call("POST", "/api/maps", { doc: bad })).body.error).toBe("invalid_document");
  });

  it("are invisible to anybody else", async () => {
    const owner = await withDevice("Pai");
    const id = (await owner.call("POST", "/api/maps", { doc: doc() })).body.map.id;
    const other = await withDevice("Filho", "203.0.113.2");
    expect((await other.call("GET", `/api/maps/${id}`)).status).toBe(404);
    expect((await other.call("PUT", `/api/maps/${id}`, { doc: doc(), version: 1 })).status).toBe(404);
    expect((await other.call("DELETE", `/api/maps/${id}`)).status).toBe(404);
  });

  it("stop at three for a device", async () => {
    const b = await withDevice();
    for (let i = 0; i < 3; i++) expect((await b.call("POST", "/api/maps", { doc: doc() })).status).toBe(201);
    expect((await b.call("POST", "/api/maps", { doc: doc() })).body.error).toBe("map_limit_reached");
  });

  it("are shown by a view link that withdraws for good", async () => {
    const b = await withDevice();
    const id = (await b.call("POST", "/api/maps", { doc: doc("Herdade") })).body.map.id;
    const { slug } = (await b.call("POST", `/api/maps/${id}/publish`)).body;
    expect(slug).toMatch(/^[2-9bcdfghjkmnpqrstvwxz]{8}$/);
    expect((await b.call("POST", `/api/maps/${id}/publish`)).body.slug).toBe(slug);

    const shared = await browser().call("GET", `/api/shares/${slug}`);
    expect(shared.body.share.name).toBe("Herdade");
    expect(JSON.stringify(shared.body)).not.toContain(id);

    await b.call("DELETE", `/api/maps/${id}/publish`);
    expect((await browser().call("GET", `/api/shares/${slug}`)).status).toBe(404);
    expect((await b.call("POST", `/api/maps/${id}/publish`)).body.slug).not.toBe(slug);
  });
});

describe("accounts", () => {
  it("register by an emailed link, then sign in with the key", async () => {
    const b = browser();
    expect((await b.call("POST", "/api/auth/register", { email: "Pai@Example.pt", key: KEY, turnstile: "tok", lang: "pt" })).body).toEqual({ ok: true });
    await vi.waitFor(() => expect(sentMail).toHaveLength(1));
    expect(await env.DB.prepare("SELECT 1 FROM users WHERE email = 'pai@example.pt'").first()).toBeNull();

    const token = /verify=([A-Za-z0-9_-]{43})/.exec(sentMail[0].text)![1];
    expect((await b.call("POST", "/api/auth/verify", { token })).status).toBe(200);
    expect((await b.call("GET", "/api/me")).body.user.email).toBe("pai@example.pt");
    expect((await b.call("POST", "/api/auth/verify", { token })).body.error).toBe("invalid_token");

    expect((await browser().call("POST", "/api/auth/login", { email: "pai@example.pt", key: "z".repeat(43) })).status).toBe(401);
    const again = browser();
    expect((await again.call("POST", "/api/auth/login", { email: "PAI@example.pt", key: KEY })).status).toBe(200);
    expect(again.jar.has("ct_session")).toBe(true);
  });

  it("say the same for a reset whether or not the address has an account", async () => {
    const r = await browser().call("POST", "/api/auth/reset/request", { email: "ninguem@example.pt", turnstile: "tok" });
    expect(r.body).toEqual({ ok: true });
  });

  it("claim a device's maps on request, then forget the device", async () => {
    const b = await withDevice("Reclamante");
    await b.call("POST", "/api/maps", { doc: doc("Do telemóvel") });
    const { token } = await signedInUser("claim@example.pt");
    b.jar.set("ct_session", token);

    expect((await b.call("GET", "/api/me")).body.claimable).toEqual({ maps: 1 });
    const claimed = await b.call("POST", "/api/me/claim");
    expect(claimed.body).toEqual({ moved: { maps: 1 } });
    expect(b.jar.has("ct_device")).toBe(false);
    expect((await b.call("GET", "/api/maps")).body.maps.map((m: { name: string }) => m.name)).toEqual(["Do telemóvel"]);
    expect(await env.DB.prepare("SELECT 1 FROM devices WHERE username = 'Reclamante'").first()).toBeNull();
  });

  it("are erased whole, only when the address is typed back", async () => {
    const { id, token } = await signedInUser("filho@example.pt");
    const b = browser();
    b.jar.set("ct_session", token);
    await b.call("POST", "/api/maps", { doc: doc() });
    expect((await b.call("DELETE", "/api/me", { confirm: "outro@example.pt" })).status).toBe(400);
    expect((await b.call("DELETE", "/api/me", { confirm: "Filho@example.pt" })).status).toBe(200);
    for (const [table, column] of [
      ["users", "id"],
      ["sessions", "user_id"],
      ["maps", "owner_user_id"],
    ]) {
      const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${column} = ?1`).bind(id).first<{ n: number }>();
      expect(row?.n, table).toBe(0);
    }
  });
});
