import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { alongRoute, OFF_ROUTE_AFTER_MS, offRoute, startFrom, toPoint } from "./nav";

const S: Position = [-6.918, 39.882];

describe("navigating to a pin", () => {
  it("gives distance, bearing and the turn from where the person faces", () => {
    const g = toPoint(S, 5, 0, destination(S, 90, 200));
    expect(g.distance).toBeCloseTo(200, 0);
    expect(g.bearing).toBeCloseTo(90, 0);
    expect(g.turn).toBeCloseTo(90, 0);
    expect(toPoint(S, 5, 120, destination(S, 90, 200)).turn).toBeCloseTo(-30, 0);
    expect(toPoint(S, 5, null, destination(S, 90, 200)).turn).toBeNull();
  });

  it("arrives within ten metres, or within a worse accuracy", () => {
    expect(toPoint(S, 5, null, destination(S, 0, 8)).arrived).toBe(true);
    expect(toPoint(S, 5, null, destination(S, 0, 20)).arrived).toBe(false);
    expect(toPoint(S, 30, null, destination(S, 0, 20)).arrived).toBe(true);
  });
});

describe("following a route", () => {
  const line: Position[] = [S, destination(S, 90, 300), destination(destination(S, 90, 300), 0, 200)];

  it("measures what is done and what remains, aiming ahead along the line", () => {
    const at = destination(S, 90, 100);
    const g = alongRoute(at, 5, 90, line);
    expect(g.total).toBeCloseTo(500, 0);
    expect(g.done).toBeCloseTo(100, 0);
    expect(g.distance).toBeCloseTo(400, 0);
    expect(g.bearing).toBeCloseTo(90, 0);
    expect(g.away).toBe(false);
  });

  it("is away beyond 25 m, or one and a half accuracies", () => {
    const off = destination(destination(S, 90, 100), 0, 40);
    expect(alongRoute(off, 5, null, line).away).toBe(true);
    expect(alongRoute(off, 30, null, line).away).toBe(false);
    expect(alongRoute(destination(destination(S, 90, 100), 0, 15), 5, null, line).away).toBe(false);
  });

  it("arrives at the end", () => {
    expect(alongRoute(line[2], 5, null, line).arrived).toBe(true);
    expect(alongRoute(line[1], 5, null, line).arrived).toBe(false);
  });

  it("starts from the nearer end", () => {
    expect(startFrom(destination(S, 270, 20), line)).toBe("start");
    expect(startFrom(destination(line[2], 0, 20), line)).toBe("end");
  });

  it("calls a person off route only after ten seconds away", () => {
    let state = offRoute(null, true, 1000);
    expect(state).toEqual({ since: 1000, off: false });
    state = offRoute(state.since, true, 1000 + OFF_ROUTE_AFTER_MS - 1);
    expect(state.off).toBe(false);
    state = offRoute(state.since, true, 1000 + OFF_ROUTE_AFTER_MS);
    expect(state.off).toBe(true);
    expect(offRoute(state.since, false, 99_999)).toEqual({ since: null, off: false });
  });
});
