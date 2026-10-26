import { describe, expect, it } from "vitest";
import { formatArea, formatBytes, formatLength } from "./format";

describe("format", () => {
  it("writes metres under a kilometre, then kilometres", () => {
    expect(formatLength(849.6, "en")).toBe("850 m");
    expect(formatLength(1234, "en")).toBe("1.2 km");
    expect(formatLength(1234, "pt")).toBe("1,2 km");
  });

  it("writes square metres under a hectare, then hectares", () => {
    expect(formatArea(4500, "en")).toBe("4,500 m²");
    expect(formatArea(124_000, "pt")).toBe("12,4 ha");
  });

  it("writes bytes in the largest unit under 1024", () => {
    expect(formatBytes(65 * 1024, "en")).toBe("65 KB");
    expect(formatBytes(29.4 * 1024 * 1024, "pt")).toBe("29 MB");
    expect(formatBytes(3.25 * 1024 ** 3, "en")).toBe("3.3 GB");
  });
});
