import { describe, expect, it } from "vitest";

import { crc32, zip } from "./zip";

/** Reads a zip back through its central directory — the way every unzipper finds files. */
async function unzip(blob: Blob): Promise<Map<string, { text: string; crc: number }>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);

  const files = new Map<string, { text: string; crc: number }>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    expect(view.getUint16(at + 8, true) & 0x0800).toBe(0x0800);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const packed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + packed);
    const raw =
      method === 8
        ? new Uint8Array(
            await new Response(
              new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw")),
            ).arrayBuffer(),
          )
        : body;
    files.set(name, { text: new TextDecoder().decode(raw), crc: crc32(raw) === crc ? crc : -1 });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("round-trips files, UTF-8 names and folders through the central directory", async () => {
    const encode = (s: string) => new TextEncoder().encode(s);
    const map = JSON.stringify({ type: "FeatureCollection", coutada: { v: 1, name: "Herdade da Azinhaga" }, features: Array(50).fill({ type: "Feature" }) });
    const files = await unzip(
      await zip([
        { path: "coutada/mapas/Herdade da Azinhaga.geojson", data: encode(map), modified: 1_790_000_000 },
        { path: "coutada/conta.json", data: encode("{}"), modified: 1_790_000_000 },
      ]),
    );

    expect([...files.keys()]).toEqual(["coutada/mapas/Herdade da Azinhaga.geojson", "coutada/conta.json"]);
    expect(files.get("coutada/mapas/Herdade da Azinhaga.geojson")?.text).toBe(map);
    expect(files.get("coutada/conta.json")?.text).toBe("{}");
    for (const file of files.values()) expect(file.crc).not.toBe(-1);
  });

  it("is a valid, empty archive with nothing in it", async () => {
    expect((await unzip(await zip([]))).size).toBe(0);
  });
});
