import { describe, expect, it } from "vitest";
import { IMAGERY } from "../map/imagery";
import { tileBBox, tileKey, tilesCovering, tileUrl } from "./tiles";

/** MapLibre's own way of writing a tile's box: through 256 px pixel coordinates. */
function maplibreBBox(x: number, y: number, z: number): string {
  const flipped = 2 ** z - y - 1;
  const merc = (px: number, py: number) => {
    const resolution = (2 * Math.PI * 6378137) / 256 / 2 ** z;
    return [px * resolution - Math.PI * 6378137, py * resolution - Math.PI * 6378137];
  };
  const min = merc(x * 256, flipped * 256);
  const max = merc((x + 1) * 256, (flipped + 1) * 256);
  return `${min[0]},${min[1]},${max[0]},${max[1]}`;
}

const template = IMAGERY.ortosat2023!.url;

describe("tile keys", () => {
  it("are the same for MapLibre's request and the prefetch's, whatever the number formatting", () => {
    for (const tile of [
      { z: 17, x: 62_960, y: 49_270 },
      { z: 10, x: 492, y: 384 },
      { z: 18, x: 125_921, y: 98_541 },
    ]) {
      const fromMapLibre = template.replace("{bbox-epsg-3857}", maplibreBBox(tile.x, tile.y, tile.z));
      const ours = tileUrl(template, tile);
      expect(tileKey(fromMapLibre)).toBe(tileKey(ours));
      expect(tileKey(ours)).not.toBeNull();
    }
  });

  it("differ between tiles and layers, and are null for anything else", () => {
    const a = tileUrl(template, { z: 17, x: 1, y: 1 });
    expect(tileKey(a)).not.toBe(tileKey(tileUrl(template, { z: 17, x: 2, y: 1 })));
    expect(tileKey(a)).not.toBe(tileKey(tileUrl(IMAGERY.ortos2021!.url, { z: 17, x: 1, y: 1 })));
    expect(tileKey("https://coutada.migueljfsc.dev/api/me")).toBeNull();
    expect(tileKey("https://ortos.dgterritorio.gov.pt/wms/ortosat2023?REQUEST=GetCapabilities")).toBeNull();
    expect(tileKey("not a url")).toBeNull();
  });
});

describe("tile boxes and covers", () => {
  it("put tile 0/0/0 on the whole world", () => {
    const [minx, miny, maxx, maxy] = tileBBox({ z: 0, x: 0, y: 0 });
    expect(minx).toBeCloseTo(-20037508.34, 1);
    expect(maxy).toBeCloseTo(20037508.34, 1);
    expect(maxx).toBeCloseTo(-minx, 6);
    expect(miny).toBeCloseTo(-maxy, 6);
  });

  it("cover a box with every tile it touches", () => {
    const box = [-6.93, 39.875, -6.905, 39.89] as const;
    const tiles = tilesCovering(box, 16);
    const xs = new Set(tiles.map((t) => t.x));
    const ys = new Set(tiles.map((t) => t.y));
    expect(tiles.length).toBe(xs.size * ys.size);
    expect(tiles.length).toBeGreaterThan(1);
    for (const t of tiles) {
      const [minx, , maxx] = tileBBox(t);
      expect(maxx).toBeGreaterThan(((box[0] * Math.PI) / 180) * 6378137);
      expect(minx).toBeLessThan(((box[2] * Math.PI) / 180) * 6378137);
    }
  });
});
