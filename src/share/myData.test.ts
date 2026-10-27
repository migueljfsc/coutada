import { describe, expect, it } from "vitest";
import { createMapDoc } from "../doc/operations";
import { dataEntries } from "./myData";

const text = (data: Uint8Array) => new TextDecoder().decode(data);

describe("my data", () => {
  it("holds the account and every map, each under a name a file system takes", () => {
    const me = { user: { id: "u", email: "pai@example.com", displayName: "Pai" }, device: null, claimable: null };
    const maps = ["Herdade/Norte", "Herdade/Norte", "Vale: sul"].map((name, i) => ({ name, doc: createMapDoc(name), updatedAt: 100 + i }));
    const entries = dataEntries(me, maps, 1_790_000_000);
    expect(entries.map((e) => e.path)).toEqual([
      "coutada/account.json",
      "coutada/maps/Herdade-Norte.geojson",
      "coutada/maps/Herdade-Norte (2).geojson",
      "coutada/maps/Vale- sul.geojson",
    ]);
    expect(JSON.parse(text(entries[0].data))).toMatchObject({ account: { email: "pai@example.com", displayName: "Pai" }, maps: 3 });
    expect(JSON.parse(text(entries[3].data)).coutada.name).toBe("Vale: sul");
    expect(entries[3].modified).toBe(102);
  });

  it("names the phone when there is no account", () => {
    const [account] = dataEntries({ user: null, device: { username: "Filho" }, claimable: null }, [], 1);
    expect(JSON.parse(text(account.data))).toEqual({ exportedAt: "1970-01-01T00:00:01.000Z", phone: { name: "Filho" }, maps: 0 });
  });
});
