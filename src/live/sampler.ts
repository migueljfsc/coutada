/**
 * When a phone sends its position (D15): on time or on distance while moving, sparsely while
 * standing still. Pure — the last send, the fix and the time in; whether to send and the new
 * sampler state out.
 */

import { distance, type Position } from "../geo/geo";
import type { HuntType, Role } from "./protocol";

/** Below this speed, for this long, a person counts as standing still. */
export const STILL_MPS = 0.5;
export const STILL_AFTER_MS = 30_000;

export type Cadence = { movingMs: number; movingM: number; stillMs: number };

export function cadence(type: HuntType, role: Role): Cadence {
  if (type === "montaria" && role === "porta") return { movingMs: 10_000, movingM: 25, stillMs: 60_000 };
  return { movingMs: 5_000, movingM: 15, stillMs: 30_000 };
}

export type Sampler = {
  last: { at: number; c: Position } | null;
  /** When the person last moved faster than `STILL_MPS`. */
  movedAt: number;
};

export const newSampler = (now: number): Sampler => ({ last: null, movedAt: now });

/** The position to compare against for speed when the browser reports none. */
export function sample(s: Sampler, c: Position, speed: number | null, now: number, cad: Cadence): { send: boolean; sampler: Sampler } {
  const moved = s.last ? distance(s.last.c, c) : Infinity;
  const elapsed = s.last ? now - s.last.at : Infinity;
  const v = speed ?? (s.last && elapsed > 0 ? moved / (elapsed / 1000) : 0);
  const movedAt = v > STILL_MPS ? now : s.movedAt;
  const still = now - movedAt >= STILL_AFTER_MS;

  const send = !s.last || (still ? elapsed >= cad.stillMs : elapsed >= cad.movingMs || moved >= cad.movingM);
  return { send, sampler: { last: send ? { at: now, c } : s.last, movedAt } };
}

/** How long before a position counts as stale: twice the slowest interval it could be on (D15). */
export const staleAfterMs = (cad: Cadence): number => 2 * cad.stillMs;
/** After this, a position is greyed out as lost. */
export const LOST_AFTER_MS = 5 * 60_000;
