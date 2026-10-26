import { describe, expect, it } from "vitest";
import { keyFor, memoryStore, read, remove, write, type Store } from "./storage";

const throwing: Store = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const asNumber = (raw: unknown) => (typeof raw === "number" ? raw : null);

describe("storage", () => {
  it("round-trips through a parser", () => {
    const store = memoryStore();
    expect(write(store, keyFor("n"), 3)).toBe(true);
    expect(read(store, keyFor("n"), asNumber)).toBe(3);
  });

  it("discards what the parser rejects and what is not JSON", () => {
    const store = memoryStore({ [keyFor("a")]: '"three"', [keyFor("b")]: "{not json" });
    expect(read(store, keyFor("a"), asNumber)).toBeNull();
    expect(read(store, keyFor("b"), asNumber)).toBeNull();
  });

  it("never throws, whatever the store does", () => {
    expect(read(throwing, "k", asNumber)).toBeNull();
    expect(write(throwing, "k", 1)).toBe(false);
    expect(() => remove(throwing, "k")).not.toThrow();
    expect(read(null, "k", asNumber)).toBeNull();
    expect(write(null, "k", 1)).toBe(false);
  });
});
