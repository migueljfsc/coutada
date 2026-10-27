/**
 * Trails (D13, D15): which fixes enter a trail.
 * One set of rules for the phone, the hunt object and every other phone, so everyone reads the
 * same line. Pure.
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
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** The trail with the fix added, or the same array when the fix does not qualify. */
export function extend(trail: TrailPoint[], c: Position, accuracy: number, seconds: number): TrailPoint[] {
  if (accuracy > TRAIL_MAX_ACCURACY_M || trail.length >= TRAIL_MAX_POINTS) return trail;
  const last = trail[trail.length - 1];
  if (last && distance(at(last), c) < TRAIL_MIN_STEP_M) return trail;
  return [...trail, [round5(c[0]), round5(c[1]), Math.round(seconds)]];
}
