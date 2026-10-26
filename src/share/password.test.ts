import { describe, expect, it } from "vitest";
import { deriveKey } from "./password";

describe("deriveKey", () => {
  // Frozen: if this changes, every password account stops signing in.
  it("derives the same key it always has", async () => {
    expect(await deriveKey("  Pai@Example.PT ", "correct horse battery staple")).toBe("EYPXujUzM55xBOWqKegIdjjT2gji09-KYmKWXHSnJrg");
  });

  it("treats composed and decomposed accents as one password", async () => {
    expect(await deriveKey("a@b.pt", "caçada")).toBe(await deriveKey("a@b.pt", "caçada"));
  });
});
