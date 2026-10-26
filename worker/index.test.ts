import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "./lib/headers";

const api = (path: string, init?: RequestInit) =>
  exports.default.fetch(`https://coutada.migueljfsc.dev${path}`, init);

describe("the API surface", () => {
  it("answers /api/me without a session with 401, as JSON, uncached", async () => {
    const response = await api("/api/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers an unknown API path with 404", async () => {
    const response = await api("/api/nothing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("sends every security header on every response", async () => {
    for (const response of [await api("/api/me"), await api("/api/nothing", { method: "POST" })]) {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers.get(name)).toBe(value);
      }
    }
  });

  it("lets the page use geolocation and the wake lock, and nothing else powerful", () => {
    const policy = SECURITY_HEADERS["permissions-policy"];
    expect(policy).toContain("geolocation=(self)");
    expect(policy).toContain("screen-wake-lock=(self)");
    expect(policy).toContain("camera=()");
  });
});
