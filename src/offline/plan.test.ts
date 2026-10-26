import { describe, expect, it } from "vitest";
import { addPin, addZone, createMapDoc } from "../doc/operations";
import { destination, distance, type Position } from "../geo/geo";
import { AREA_MARGIN_M, areaOf, MAX_PACK_TILES, planPack } from "./plan";

const S: Position = [-6.918, 39.882];

/** A square property of `ha` hectares at Salvaterra. */
function property(ha: number) {
  const side = Math.sqrt(ha * 10_000);
  const ring = [S, destination(S, 90, side), destination(destination(S, 90, side), 0, side), destination(S, 0, side)];
  return addZone(createMapDoc("m"), { id: "z".repeat(22), type: "boundary", ring }, 0);
}

describe("the area of a map", () => {
  it("is nothing for an empty map", () => {
    expect(areaOf(createMapDoc("m"))).toBeNull();
  });

  it("is what is drawn plus the margin", () => {
    const area = areaOf(addPin(createMapDoc("m"), { id: "p".repeat(22), type: "gate", at: S }, 0))!;
    expect(distance([area[0], S[1]], S)).toBeCloseTo(AREA_MARGIN_M, -1);
    expect(distance([S[0], area[3]], S)).toBeCloseTo(AREA_MARGIN_M, -1);
  });
});

describe("a pack", () => {
  it("for 1,000 ha in full detail is a few hundred tiles, tens of megabytes", () => {
    const plan = planPack(areaOf(property(1000))!, "full");
    expect(plan.tiles.length).toBeGreaterThan(200);
    expect(plan.tiles.length).toBeLessThan(700);
    expect(plan.bytes / 1024 / 1024).toBeLessThan(45);
    expect(plan.tooBig).toBe(false);
  });

  it("in light detail is about a quarter", () => {
    const area = areaOf(property(1000))!;
    const full = planPack(area, "full").tiles.length;
    const light = planPack(area, "light").tiles.length;
    expect(light).toBeLessThan(full / 2.5);
  });

  it("refuses an area too big to hold", () => {
    expect(planPack(areaOf(property(40_000))!, "full").tiles.length).toBeGreaterThan(MAX_PACK_TILES);
    expect(planPack(areaOf(property(40_000))!, "full").tooBig).toBe(true);
  });
});
