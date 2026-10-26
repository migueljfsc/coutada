/**
 * Geometry on the WGS84 sphere, in metres and degrees. Pure (D2).
 *
 * Positions are GeoJSON order, `[lon, lat]`. Distances and bearings are great-circle; projecting
 * a point onto a line uses a local equirectangular frame around the point, which is exact to well
 * under a metre at the scale of a property (a few kilometres).
 */

export type Position = readonly [lon: number, lat: number];

/** IUGG mean Earth radius. */
export const EARTH_RADIUS_M = 6_371_008.8;

const RAD = Math.PI / 180;

/** Great-circle distance in metres (haversine). */
export function distance(a: Position, b: Position): number {
  const φ1 = a[1] * RAD;
  const φ2 = b[1] * RAD;
  const dφ = φ2 - φ1;
  const dλ = (b[0] - a[0]) * RAD;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, degrees clockwise from true north, in [0, 360). */
export function bearing(a: Position, b: Position): number {
  const φ1 = a[1] * RAD;
  const φ2 = b[1] * RAD;
  const dλ = (b[0] - a[0]) * RAD;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** The point `metres` from `from` along `bearingDeg`. */
export function destination(from: Position, bearingDeg: number, metres: number): Position {
  const δ = metres / EARTH_RADIUS_M;
  const θ = bearingDeg * RAD;
  const φ1 = from[1] * RAD;
  const λ1 = from[0] * RAD;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [(((λ2 / RAD + 540) % 360) - 180), φ2 / RAD];
}

/** Length of a polyline in metres. */
export function lineLength(line: readonly Position[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distance(line[i - 1], line[i]);
  return total;
}

export type Nearest = {
  /** The closest point on the line. */
  point: Position;
  /** Index of the segment it lies on: between `line[segment]` and `line[segment + 1]`. */
  segment: number;
  /** Metres from the line's start to `point`, along the line. */
  along: number;
  /** Metres from the query point to `point`; positive when the point is right of the line's direction. */
  cross: number;
};

/** The point on `line` nearest to `p`. `line` has at least two positions. */
export function nearestOnLine(line: readonly Position[], p: Position): Nearest {
  const kx = EARTH_RADIUS_M * RAD * Math.cos(p[1] * RAD);
  const ky = EARTH_RADIUS_M * RAD;
  const local = (q: Position): [number, number] => [(q[0] - p[0]) * kx, (q[1] - p[1]) * ky];

  let best: Nearest | null = null;
  let bestD2 = Infinity;
  let walked = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = local(line[i]);
    const [bx, by] = local(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = cx * cx + cy * cy;
    const segLen = distance(line[i], line[i + 1]);

    if (d2 < bestD2) {
      bestD2 = d2;
      // Sign of (segment × (p − a)): p sits at the local origin, so p − a = −a.
      const side = dx * -ay - dy * -ax;
      best = {
        point: [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])],
        segment: i,
        along: walked + t * segLen,
        cross: (side > 0 ? -1 : 1) * Math.sqrt(d2),
      };
    }
    walked += segLen;
  }

  if (!best) throw new Error("nearestOnLine needs a line of at least two positions");
  return best;
}

/** `[west, south, east, north]`. */
export type BBox = readonly [number, number, number, number];

/** The bounding box of every position, or null for none. */
export function bboxOf(positions: Iterable<Position>): BBox | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lon, lat] of positions) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return w === Infinity ? null : [w, s, e, n];
}

/** `box` grown by `metres` on every side. */
export function bufferBBox(box: BBox, metres: number): BBox {
  const [w, s, e, n] = box;
  const dLat = metres / (EARTH_RADIUS_M * RAD);
  const dLon = metres / (EARTH_RADIUS_M * RAD * Math.cos(((s + n) / 2) * RAD));
  return [w - dLon, s - dLat, e + dLon, n + dLat];
}

/** Rounds a coordinate to `places` decimals; 6 is ~0.1 m, 5 is ~1 m. */
export const roundCoord = (value: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(value * k) / k;
};
