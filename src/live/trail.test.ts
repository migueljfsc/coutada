import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { extend, simplify, TRAIL_MAX_ACCURACY_M, walked, type TrailPoint } from "./trail";

const S: Position = [-6.918, 39.882];

describe("trails", () => {
  it("take a fix only when accurate enough and far enough from the last point", () => {
    let t: TrailPoint[] = [];
    t = extend(t, S, 5, 1);
    expect(t).toHaveLength(1);
    expect(extend(t, destination(S, 0, 3), 5, 2)).toBe(t);
    expect(extend(t, destination(S, 0, 30), TRAIL_MAX_ACCURACY_M + 1, 2)).toBe(t);
    t = extend(t, destination(S, 0, 30), 5, 2);
    expect(t).toHaveLength(2);
  });

  it("measure the distance walked", () => {
    let t: TrailPoint[] = [];
    for (let m = 0; m <= 500; m += 50) t = extend(t, destination(S, 90, m), 5, m);
    expect(walked(t)).toBeCloseTo(500, 0);
  });

  it("thin a straight walk to its ends and keep a corner", () => {
    let t: TrailPoint[] = [];
    for (let m = 0; m <= 300; m += 10) t = extend(t, destination(S, 90, m), 5, m);
    expect(simplify(t, 5)).toHaveLength(2);
    const corner = destination(S, 90, 300);
    for (let m = 10; m <= 200; m += 10) t = extend(t, destination(corner, 0, m), 5, 300 + m);
    expect(simplify(t, 5)).toHaveLength(3);
  });
});
