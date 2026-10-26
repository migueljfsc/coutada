import { describe, expect, it } from "vitest";
import {
  bboxOf,
  bearing,
  bufferBBox,
  destination,
  distance,
  lineLength,
  nearestOnLine,
  roundCoord,
  type Position,
} from "./geo";

/** Salvaterra do Extremo, roughly. */
const S: Position = [-6.918, 39.882];

describe("distance", () => {
  it("measures a degree of latitude as ~111.2 km", () => {
    expect(distance([0, 0], [0, 1])).toBeCloseTo(111_195, -1);
  });

  it("shrinks a degree of longitude by cos(latitude)", () => {
    const d = distance(S, [S[0] + 1, S[1]]);
    expect(d / 111_195).toBeCloseTo(Math.cos((S[1] * Math.PI) / 180), 3);
  });

  it("is zero to itself and symmetric", () => {
    expect(distance(S, S)).toBe(0);
    const b: Position = [-6.9, 39.9];
    expect(distance(S, b)).toBeCloseTo(distance(b, S), 9);
  });

  it("matches a known pair: Lisbon to Porto is ~274 km", () => {
    expect(distance([-9.1393, 38.7223], [-8.6291, 41.1579]) / 1000).toBeCloseTo(274, 0);
  });
});

describe("bearing and destination", () => {
  it("points at the four quarters", () => {
    expect(bearing(S, [S[0], S[1] + 0.01])).toBeCloseTo(0, 6);
    expect(bearing(S, [S[0] + 0.01, S[1]])).toBeCloseTo(90, 1);
    expect(bearing(S, [S[0], S[1] - 0.01])).toBeCloseTo(180, 6);
    expect(bearing(S, [S[0] - 0.01, S[1]])).toBeCloseTo(270, 1);
  });

  /** Smallest difference between two bearings, so 359.9999 and 0 are equal. */
  const turn = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

  it("is inverted by destination", () => {
    for (const [θ, m] of [
      [0, 50],
      [37, 420],
      [181, 1200],
      [300, 3000],
    ] as const) {
      const to = destination(S, θ, m);
      expect(distance(S, to)).toBeCloseTo(m, 3);
      expect(turn(bearing(S, to), θ)).toBeLessThan(1e-3);
    }
  });
});

describe("nearestOnLine", () => {
  const east: Position[] = [S, destination(S, 90, 400), destination(destination(S, 90, 400), 0, 300)];

  it("projects onto the inside of a segment, with along and cross in metres", () => {
    const p = destination(destination(S, 90, 150), 0, 20);
    const n = nearestOnLine(east, p);
    expect(n.segment).toBe(0);
    expect(n.along).toBeCloseTo(150, 0);
    expect(Math.abs(n.cross)).toBeCloseTo(20, 0);
  });

  it("signs cross by side: left of travel is negative, right is positive", () => {
    const left = nearestOnLine(east, destination(destination(S, 90, 150), 0, 20));
    const right = nearestOnLine(east, destination(destination(S, 90, 150), 180, 20));
    expect(left.cross).toBeLessThan(0);
    expect(right.cross).toBeGreaterThan(0);
  });

  it("counts along across segments", () => {
    const corner = east[1];
    const p = destination(destination(corner, 0, 100), 90, 15);
    const n = nearestOnLine(east, p);
    expect(n.segment).toBe(1);
    expect(n.along).toBeCloseTo(500, 0);
    expect(Math.abs(n.cross)).toBeCloseTo(15, 0);
  });

  it("clamps to the ends", () => {
    const before = nearestOnLine(east, destination(S, 270, 80));
    expect(before.along).toBe(0);
    expect(Math.abs(before.cross)).toBeCloseTo(80, 0);
    const total = lineLength(east);
    const after = nearestOnLine(east, destination(east[2], 0, 50));
    expect(after.along).toBeCloseTo(total, 3);
  });

  it("refuses a line of one position", () => {
    expect(() => nearestOnLine([S], S)).toThrow();
  });
});

describe("boxes and rounding", () => {
  it("bounds positions, and nothing is null", () => {
    expect(bboxOf([[-7, 39.9], [-6.9, 39.8], [-6.95, 40]])).toEqual([-7, 39.8, -6.9, 40]);
    expect(bboxOf([])).toBeNull();
  });

  it("buffers by metres on every side", () => {
    const box = bufferBBox([S[0], S[1], S[0], S[1]], 500);
    expect(distance([box[0], S[1]], S)).toBeCloseTo(500, 0);
    expect(distance([S[0], box[3]], S)).toBeCloseTo(500, 0);
  });

  it("rounds to decimals", () => {
    expect(roundCoord(-6.91834567, 6)).toBe(-6.918346);
    expect(roundCoord(39.882345, 5)).toBe(39.88235);
  });
});
