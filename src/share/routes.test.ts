import { describe, expect, it } from "vitest";
import { parseRoute } from "./routes";

describe("routes", () => {
  it("reads a saved map, a shared map and a transfer", () => {
    expect(parseRoute("/map/abcdefghijklmnopqrstuv", "")).toEqual({ kind: "map", id: "abcdefghijklmnopqrstuv" });
    expect(parseRoute("/m/bcdf2345", "")).toEqual({ kind: "shared", slug: "bcdf2345" });
    expect(parseRoute("/transfer", "?c=BCDF2345")).toEqual({ kind: "transfer", code: "BCDF2345" });
    expect(parseRoute("/hunt/abcdefghijklmnopqrstuv", "")).toEqual({ kind: "hunt", id: "abcdefghijklmnopqrstuv" });
  });

  it("treats anything else as home", () => {
    for (const path of ["/", "/map/short", "/m/AAAAAAAA", "/m/bcdf234", "/anything"]) expect(parseRoute(path, "")).toEqual({ kind: "home" });
  });
});
