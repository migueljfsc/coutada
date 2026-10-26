import { describe, expect, it } from "vitest";
import { destination, type Position } from "../geo/geo";
import { cadence, newSampler, sample, STILL_AFTER_MS } from "./sampler";

const S: Position = [-6.918, 39.882];
const walk = cadence("salto", "member");

describe("the sampler", () => {
  it("sends the first fix at once", () => {
    expect(sample(newSampler(0), S, null, 0, walk).send).toBe(true);
  });

  it("while moving, sends every five seconds or fifteen metres", () => {
    let s = sample(newSampler(0), S, 1.2, 0, walk).sampler;
    expect(sample(s, destination(S, 0, 4), 1.2, 3000, walk).send).toBe(false);
    expect(sample(s, destination(S, 0, 16), 1.2, 3000, walk).send).toBe(true);
    s = sample(s, destination(S, 0, 4), 1.2, 3000, walk).sampler;
    expect(sample(s, destination(S, 0, 6), 1.2, 5000, walk).send).toBe(true);
  });

  it("once still for thirty seconds, sends every thirty", () => {
    let s = sample(newSampler(0), S, 0, 0, walk).sampler;
    let now = 0;
    for (; now < STILL_AFTER_MS; now += 5000) s = sample(s, S, 0, now, walk).sampler;
    const lastAt = s.last!.at;
    expect(sample(s, S, 0, lastAt + 10_000, walk).send).toBe(false);
    expect(sample(s, S, 0, lastAt + 30_000, walk).send).toBe(true);
  });

  it("is sparser at a porta than on the move", () => {
    expect(cadence("montaria", "porta")).toEqual({ movingMs: 10_000, movingM: 25, stillMs: 60_000 });
    expect(cadence("montaria", "batedor")).toEqual(walk);
  });

  it("works out speed from the fixes when the browser reports none", () => {
    let s = sample(newSampler(0), S, null, 0, walk).sampler;
    s = sample(s, destination(S, 0, 20), null, 10_000, walk).sampler;
    expect(s.movedAt).toBe(10_000);
  });
});
