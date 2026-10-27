import { describe, expect, it } from "vitest";
import { parseCoordinates } from "./coords";
import type { Position } from "./geo";

const near = (p: Position | null, lon: number, lat: number) => {
  expect(p).not.toBeNull();
  expect(p![0]).toBeCloseTo(lon, 4);
  expect(p![1]).toBeCloseTo(lat, 4);
};

describe("coordinates people type and paste", () => {
  it("read decimal degrees, latitude first, as Google Maps copies them", () => {
    near(parseCoordinates("39.882, -6.918"), -6.918, 39.882);
    near(parseCoordinates("39.882 -6.918"), -6.918, 39.882);
    near(parseCoordinates("39.88213,-6.91845"), -6.91845, 39.88213);
    near(parseCoordinates("  39.882 ;  -6.918 "), -6.918, 39.882);
  });

  it("read a decimal comma where no point is used", () => {
    near(parseCoordinates("39,882 -6,918"), -6.918, 39.882);
    near(parseCoordinates("39,882; -6,918"), -6.918, 39.882);
  });

  it("read N/S/E/W before or after, and either order when the letters say", () => {
    near(parseCoordinates("39.882N 6.918W"), -6.918, 39.882);
    near(parseCoordinates("N 39.882 W 6.918"), -6.918, 39.882);
    near(parseCoordinates("6.918W 39.882N"), -6.918, 39.882);
  });

  it("read degrees, minutes and seconds, and degrees and decimal minutes", () => {
    near(parseCoordinates(`39°52'55"N 6°55'05"W`), -(6 + 55 / 60 + 5 / 3600), 39 + 52 / 60 + 55 / 3600);
    near(parseCoordinates("39º 52′ 55″ N, 6º 55′ 5″ W"), -(6 + 55 / 60 + 5 / 3600), 39 + 52 / 60 + 55 / 3600);
    near(parseCoordinates("N39 52.917 W006 55.083"), -(6 + 55.083 / 60), 39 + 52.917 / 60);
  });

  it("refuse what is not a pair of coordinates", () => {
    for (const text of ["Salvaterra do Extremo", "39.882", "95, 10", "39, 200", "39 61 0 N 6 0 0 W", "1 2 3", "", "Porta 4"]) {
      expect(parseCoordinates(text)).toBeNull();
    }
  });
});
