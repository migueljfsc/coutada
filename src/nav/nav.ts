/**
 * Navigating to a pin and following a route (architecture §8). Pure (D2): a fix, a target and
 * time in; distances, bearings and what to tell the person out.
 */

import { bearing, distance, lineLength, nearestOnLine, pointAlong, type Position } from "../geo/geo";

/** Arrived within this many metres, or the fix's accuracy if it is worse. */
export const ARRIVED_M = 10;
/** Off route beyond this many metres, or one and a half accuracies if that is more. */
export const OFF_ROUTE_M = 25;
/** How long a person must stay off the line before being told. */
export const OFF_ROUTE_AFTER_MS = 10_000;
/** The point aimed at along a route, ahead of the nearest one. */
export const LOOK_AHEAD_M = 30;

export type Guidance = {
  /** Metres to the target: the pin, or the route's end. */
  distance: number;
  /** Degrees from true north to aim at. */
  bearing: number;
  /** Degrees to turn from the way the person faces, -180..180; null without a heading. */
  turn: number | null;
  arrived: boolean;
};

const signedTurn = (to: number, heading: number | null): number | null =>
  heading === null ? null : ((to - heading + 540) % 360) - 180;

export function toPoint(at: Position, accuracy: number, heading: number | null, target: Position): Guidance {
  const d = distance(at, target);
  const b = bearing(at, target);
  return { distance: d, bearing: b, turn: signedTurn(b, heading), arrived: d <= Math.max(ARRIVED_M, accuracy) };
}

export type RouteGuidance = Guidance & {
  /** Metres along the route already behind the person. */
  done: number;
  total: number;
  /** Metres from the line, positive to the right of the way of travel. */
  cross: number;
  /** Beyond the off-route distance right now; `offRoute` adds the persistence. */
  away: boolean;
};

/** Guidance along `line`, walked from its start to its end (reverse the line to walk it back). */
export function alongRoute(at: Position, accuracy: number, heading: number | null, line: readonly Position[]): RouteGuidance {
  const total = lineLength(line);
  const near = nearestOnLine(line, at);
  const aim = pointAlong(line, Math.min(total, near.along + LOOK_AHEAD_M));
  const remaining = total - near.along;
  const b = bearing(at, aim);
  return {
    distance: remaining + Math.abs(near.cross),
    bearing: b,
    turn: signedTurn(b, heading),
    arrived: remaining <= Math.max(ARRIVED_M, accuracy) && Math.abs(near.cross) <= Math.max(ARRIVED_M, accuracy),
    done: near.along,
    total,
    cross: near.cross,
    away: Math.abs(near.cross) > Math.max(OFF_ROUTE_M, 1.5 * accuracy),
  };
}

/** Which end to start a route from: the one nearer the person. */
export function startFrom(at: Position, line: readonly Position[]): "start" | "end" {
  return distance(at, line[0]) <= distance(at, line[line.length - 1]) ? "start" : "end";
}

/** Off route only after `OFF_ROUTE_AFTER_MS` away: `since` is when the person left, or null. */
export function offRoute(since: number | null, away: boolean, now: number): { since: number | null; off: boolean } {
  if (!away) return { since: null, off: false };
  const left = since ?? now;
  return { since: left, off: now - left >= OFF_ROUTE_AFTER_MS };
}
