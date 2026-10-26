import { describe, expect, it } from "vitest";
import { SECURITY_HEADERS } from "../../worker/lib/headers";
import { AVAILABLE_IMAGERY, IMAGERY_ORIGINS, imageryOf } from "./imagery";

describe("imagery", () => {
  it("asks DGT for 512 px web-mercator tiles by bounding box", () => {
    for (const source of AVAILABLE_IMAGERY) {
      expect(source.url).toContain("CRS=EPSG:3857");
      expect(source.url).toContain("BBOX={bbox-epsg-3857}");
      expect(source.url).toContain("WIDTH=512&HEIGHT=512");
      expect(source.tileSize).toBe(512);
      expect(source.attribution).not.toBe("");
    }
  });

  it("defaults to OrtoSat 2023, also for a source this build cannot show", () => {
    expect(imageryOf(undefined).id).toBe("ortosat2023");
    expect(imageryOf("esri").id).toBe("ortosat2023");
    expect(imageryOf("ortos2021").id).toBe("ortos2021");
  });

  it("lets every tile host through the CSP, for images and fetches", () => {
    const csp = SECURITY_HEADERS["content-security-policy"];
    const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
    for (const origin of IMAGERY_ORIGINS) {
      expect(directive("img-src")).toContain(origin);
      expect(directive("connect-src")).toContain(origin);
    }
  });
});
