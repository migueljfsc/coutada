/**
 * Imagery tiles for the cache (D19), shared by the page and the service worker. A DGT tile is a
 * WMS GetMap by bounding box; MapLibre and the prefetch each format the box's numbers their own
 * way, so a cached tile is found by a key — host, layer and the box rounded to 0.1 m — never by
 * its URL.
 */

export const TILE_HOSTS = ["ortos.dgterritorio.gov.pt", "cartografia.dgterritorio.gov.pt"];

/** Half the web-mercator world, in metres. */
const HALF = Math.PI * 6378137;

export type Tile = { z: number; x: number; y: number };

/** `[minx, miny, maxx, maxy]` of tile z/x/y in EPSG:3857 metres. */
export function tileBBox({ z, x, y }: Tile): [number, number, number, number] {
  const size = (2 * HALF) / 2 ** z;
  return [x * size - HALF, HALF - (y + 1) * size, (x + 1) * size - HALF, HALF - y * size];
}

/** A source's tile template with the tile's box filled in, as MapLibre would request it. */
export const tileUrl = (template: string, tile: Tile): string => template.replace("{bbox-epsg-3857}", tileBBox(tile).join(","));

/** The cache key for a tile request, or null when the URL is not an imagery tile. */
export function tileKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!TILE_HOSTS.includes(parsed.hostname)) return null;
  const params = new Map([...parsed.searchParams].map(([k, v]) => [k.toLowerCase(), v]));
  const box = (params.get("bbox") ?? "").split(",").map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) return null;
  const layer = params.get("layers") ?? "";
  return `https://tiles.coutada.invalid/${parsed.hostname}/${layer}/${box.map((n) => n.toFixed(1)).join(",")}`;
}

/** The tiles at `z` covering a `[west, south, east, north]` box in degrees. */
export function tilesCovering(bbox: readonly [number, number, number, number], z: number): Tile[] {
  const n = 2 ** z;
  const tx = (lon: number) => Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const ty = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n)));
  };
  const [w, s, e, nth] = bbox;
  const tiles: Tile[] = [];
  for (let x = tx(w); x <= tx(e); x++) for (let y = ty(nth); y <= ty(s); y++) tiles.push({ z, x, y });
  return tiles;
}
