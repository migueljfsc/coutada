import { describe, expect, it } from "vitest";
import { distance } from "../geo/geo";
import { meFeatures } from "./me";

describe("my position", () => {
  it("is nothing without a fix", () => {
    expect(meFeatures(null).features).toEqual([]);
  });

  it("draws the accuracy circle at its radius and the dot with its heading", () => {
    const fc = meFeatures({ at: [-6.918, 39.882], accuracy: 12, heading: 90, time: 0 });
    const [accuracy, dot] = fc.features;
    expect(accuracy.properties).toEqual({ role: "accuracy" });
    const ring = (accuracy.geometry.coordinates as number[][][])[0];
    expect(distance([-6.918, 39.882], [ring[0][0], ring[0][1]])).toBeCloseTo(12, 6);
    expect(dot.properties).toEqual({ role: "dot", heading: 90 });
  });

  it("marks an unknown heading so the cone is hidden", () => {
    const dot = meFeatures({ at: [0, 0], accuracy: 5, heading: null, time: 0 }).features[1];
    expect(dot.properties?.heading).toBe(-1);
  });
});
