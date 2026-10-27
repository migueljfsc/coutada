import { describe, expect, it } from "vitest";
import { cumulative, DAY_S, fillDays, lastDays, lastWeeks, usageDays } from "./adminData";

const since = Date.UTC(2026, 9, 1) / 1000;

describe("the operator's numbers", () => {
  it("fill the days the server had no row for, and sum weeks ending today", () => {
    const daily = fillDays([{ day: "2026-10-02", n: 3 }], since, 14);
    expect(daily.slice(0, 3)).toEqual([0, 3, 0]);
    expect(lastWeeks(fillDays([{ day: "2026-10-14", n: 2 }, { day: "2026-10-01", n: 1 }], since, 14), 2)).toEqual([1, 2]);
    expect(cumulative(5, [1, 0, 2])).toEqual([6, 6, 8]);
  });

  it("sum several counters per day", () => {
    const usage = [
      { day: "2026-10-01", event: "export.gpx", n: 2 },
      { day: "2026-10-01", event: "export.kml", n: 1 },
      { day: "2026-10-02", event: "page.map", n: 9 },
    ];
    const exports = usageDays(usage, ["export.gpx", "export.kml"], since, 2);
    expect(exports).toEqual([3, 0]);
    expect(lastDays(usageDays(usage, ["page.map"], since, 2), 1)).toBe(9);
    expect(DAY_S).toBe(86_400);
  });
});
