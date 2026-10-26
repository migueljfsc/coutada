import { describe, expect, it } from "vitest";
import { addPin, createMapDoc } from "../doc/operations";
import { storeDraft, storedDraft } from "./draft";
import { keyFor, memoryStore } from "./storage";

const doc = addPin(createMapDoc("Herdade"), { id: "a".repeat(22), type: "gate", at: [-6.9, 39.9] }, 1);

describe("the draft", () => {
  it("round-trips a map with the server map it belongs to", () => {
    const store = memoryStore();
    storeDraft({ doc, remote: { id: "b".repeat(22), version: 3 }, dirty: false }, store);
    expect(storedDraft(store)).toEqual({ doc, remote: { id: "b".repeat(22), version: 3 }, dirty: false });
  });

  it("reads a draft from before the server as an unsaved local map", () => {
    const store = memoryStore({ [keyFor("draft")]: JSON.stringify(doc) });
    expect(storedDraft(store)).toEqual({ doc, remote: null, dirty: true });
  });

  it("discards one that does not validate, and forgets a malformed remote", () => {
    const bad = { doc: { ...createMapDoc("m"), features: [{ type: "Feature", id: "x" }] }, remote: null, dirty: false };
    expect(storedDraft(memoryStore({ [keyFor("draft")]: JSON.stringify(bad) }))).toBeNull();
    const odd = { doc, remote: { id: "short", version: 1 }, dirty: false };
    expect(storedDraft(memoryStore({ [keyFor("draft")]: JSON.stringify(odd) }))?.remote).toBeNull();
  });
});
