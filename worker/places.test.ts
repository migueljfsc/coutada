import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { MAX_QUERY, toPlaces } from "./lib/places";

const ORIGIN = "https://coutada.migueljfsc.dev";
const get = (path: string) => exports.default.fetch(`${ORIGIN}${path}`, { headers: { "cf-connecting-ip": "203.0.113.200" } });

describe("place search", () => {
  it("reads Nominatim's rows: name, kind, where, and the box to frame", () => {
    const places = toPlaces([
      {
        lat: "39.8837702",
        lon: "-6.9143475",
        addresstype: "village",
        name: "Salvaterra do Extremo",
        address: { village: "Salvaterra do Extremo", town: "Idanha-a-Nova", county: "Castelo Branco", country: "Portugal", country_code: "pt" },
        boundingbox: ["39.86", "39.90", "-6.93", "-6.89"],
      },
      {
        lat: "39.95",
        lon: "-6.88",
        addresstype: "town",
        name: "Zarza la Mayor",
        address: { town: "Zarza la Mayor", state: "Extremadura", country: "Espanha", country_code: "es" },
      },
      { lat: "x", lon: "1", name: "Broken" },
      { lat: "39", lon: "-7", name: "" },
    ]);
    expect(places).toEqual([
      { name: "Salvaterra do Extremo", kind: "village", area: "Idanha-a-Nova, Castelo Branco", at: [-6.9143475, 39.8837702], bbox: [-6.93, 39.86, -6.89, 39.9] },
      { name: "Zarza la Mayor", kind: "town", area: "Extremadura, Espanha", at: [-6.88, 39.95], bbox: null },
    ]);
    expect(toPlaces({ error: "nope" })).toEqual([]);
  });

  it("refuses an empty or overlong query", async () => {
    expect((await get("/api/places?q=%20")).status).toBe(400);
    expect((await get(`/api/places?q=${"a".repeat(MAX_QUERY + 1)}`)).status).toBe(400);
  });

  it("answers a search asked before from the cache", async () => {
    const body = { places: [{ name: "Rosmaninhal", kind: "village", area: "Idanha-a-Nova", at: [-7.09, 39.73], bbox: null }] };
    await caches.default.put(
      new Request("https://places.coutada.cache/?q=rosmaninhal&lang=pt"),
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": "max-age=600" } }),
    );
    const r = await get("/api/places?q=Rosmaninhal&lang=pt");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(body);
  });
});
