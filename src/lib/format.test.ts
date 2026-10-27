import { describe, expect, it } from "vitest";
import { formatAgo, formatArea, formatBytes, formatLength, formatMoment, formatTime } from "./format";

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

  it("says how long ago, in the reader's words, from just now to years", () => {
    const now = Date.UTC(2026, 9, 27, 12);
    expect(formatAgo(now - 10_000, now, "en")).toBe("now");
    expect(formatAgo(now - 3 * 60_000, now, "en")).toBe("3 minutes ago");
    expect(formatAgo(now - 3 * 60_000, now, "pt")).toBe("há 3 minutos");
    expect(formatAgo(now - 26 * 3_600_000, now, "en")).toBe("yesterday");
    expect(formatAgo(now - 2 * 86_400_000, now, "pt")).toBe("anteontem");
    expect(formatAgo(now - 400 * 86_400_000, now, "en")).toBe("last year");
    expect(formatAgo(now + 5_000, now, "en")).toBe("now");
  });

  it("writes a moment and a time of day in the reader's locale", () => {
    const at = Date.UTC(2026, 9, 24, 7, 45);
    expect(formatMoment(at, "en-GB", "UTC")).toBe("24 Oct, 07:45");
    expect(formatTime(at, "pt", "UTC")).toBe("07:45");
  });
});
