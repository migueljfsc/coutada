import { describe, expect, it } from "vitest";
import { addPin, createMapDoc } from "../doc/operations";
import { storeDraft, storedDraft } from "./draft";
import { keyFor, memoryStore } from "./storage";

describe("the draft", () => {
  it("round-trips a map", () => {
    const store = memoryStore();
    const doc = addPin(createMapDoc("Herdade"), { id: "a".repeat(22), type: "gate", at: [-6.9, 39.9] }, 1);
    storeDraft(doc, store);
    expect(storedDraft(store)).toEqual(doc);
  });

  it("discards one that does not validate", () => {
    const bad = { ...createMapDoc("m"), features: [{ type: "Feature", id: "x" }] };
    expect(storedDraft(memoryStore({ [keyFor("draft")]: JSON.stringify(bad) }))).toBeNull();
  });
});
