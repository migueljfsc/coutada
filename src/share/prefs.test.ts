import { describe, expect, it } from "vitest";
import { storedImagery, storedView, storeImagery, storeView } from "./prefs";
import { keyFor, memoryStore } from "./storage";

describe("prefs", () => {
  it("round-trip the imagery and the view", () => {
    const store = memoryStore();
    storeImagery("ortos2021", store);
    storeView({ center: [-6.918, 39.882], zoom: 15.5 }, store);
    expect(storedImagery(store)).toBe("ortos2021");
    expect(storedView(store)).toEqual({ center: [-6.918, 39.882], zoom: 15.5 });
  });

  it("discard what is not one", () => {
    const store = memoryStore({
      [keyFor("imagery")]: '"bing"',
      [keyFor("view")]: '{"center":[-6.9,95],"zoom":10}',
    });
    expect(storedImagery(store)).toBeNull();
    expect(storedView(store)).toBeNull();
    expect(storedView(memoryStore({ [keyFor("view")]: '{"center":["a",1],"zoom":1}' }))).toBeNull();
  });
});
