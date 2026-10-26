/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** wrangler.jsonc without its comments, as JSON. */
function wrangler(): { vars: Record<string, string>; durable_objects: { bindings: { name: string }[] } } {
  const text = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
}

describe("the deployed configuration", () => {
  it("keeps the hunt objects in the EU (D16)", () => {
    const config = wrangler();
    expect(config.vars.HUNT_JURISDICTION).toBe("eu");
    expect(config.durable_objects.bindings.map((b) => b.name)).toContain("HUNT");
  });
});
