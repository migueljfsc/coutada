import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { extend, TRAIL_MAX_ACCURACY_M, type TrailPoint } from "./trail";

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

});
