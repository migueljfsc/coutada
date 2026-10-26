/**
 * Trails (D13, D15): which fixes enter a trail, how long it is, and how it is thinned for saving.
 * One set of rules for the phone, the hunt object and every other phone, so everyone reads the
 * same line and the same distance. Pure.
 */

import { distance, type Position } from "../geo/geo";

/** A trail point: `[lon, lat, seconds since epoch]`. */
export type TrailPoint = [number, number, number];

/** A fix enters a trail only this accurate, */
export const TRAIL_MAX_ACCURACY_M = 25;
/** and this far from the last point, so standing still draws nothing. */
export const TRAIL_MIN_STEP_M = 5;
/** The most points one person's trail holds; ~20 h of walking at one point every 5 m-ish. */
export const TRAIL_MAX_POINTS = 20_000;

const at = (p: TrailPoint): Position => [p[0], p[1]];

/** The trail with the fix added, or the same array when the fix does not qualify. */
export function extend(trail: TrailPoint[], c: Position, accuracy: number, seconds: number): TrailPoint[] {
  if (accuracy > TRAIL_MAX_ACCURACY_M || trail.length >= TRAIL_MAX_POINTS) return trail;
  const last = trail[trail.length - 1];
  if (last && distance(at(last), c) < TRAIL_MIN_STEP_M) return trail;
  return [...trail, [round5(c[0]), round5(c[1]), Math.round(seconds)]];
}

/** Distance walked, in metres: the trail's length. */
export function walked(trail: readonly TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < trail.length; i++) total += distance(at(trail[i - 1]), at(trail[i]));
  return total;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Douglas–Peucker to within `toleranceM`, keeping the ends; for saving a trail (D14). */
export function simplify(trail: readonly TrailPoint[], toleranceM: number): TrailPoint[] {
  if (trail.length <= 2) return [...trail];
  const keep = new Uint8Array(trail.length);
  keep[0] = 1;
  keep[trail.length - 1] = 1;
  const stack: [number, number][] = [[0, trail.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = toleranceM;
    for (let i = a + 1; i < b; i++) {
      const d = offLine(trail[i], trail[a], trail[b]);
      if (d > worstD) {
        worst = i;
        worstD = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return trail.filter((_, i) => keep[i]);
}

/** Metres from `p` to the segment a–b, in a local frame around `a`. */
function offLine(p: TrailPoint, a: TrailPoint, b: TrailPoint): number {
  const kx = 111_320 * Math.cos((a[1] * Math.PI) / 180);
  const ky = 110_540;
  const [px, py] = [(p[0] - a[0]) * kx, (p[1] - a[1]) * ky];
  const [bx, by] = [(b[0] - a[0]) * kx, (b[1] - a[1]) * ky];
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}
