import { describe, expect, it } from "vitest";
import { LOCALES, isLocale, msg, say, translate, type Dictionary } from "./core";
import { detectLocale } from "./locale";
import { en } from "./en";
import { pt } from "./pt";

const DICTIONARIES: Record<string, Dictionary> = { en, pt };
const keys = Object.keys(en) as (keyof typeof en)[];

const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the dictionaries", () => {
  it("cover every locale", () => {
    for (const locale of LOCALES) expect(DICTIONARIES[locale]).toBeDefined();
  });

  it("name the same placeholders in every locale", () => {
    const wrong: string[] = [];
    for (const key of keys) {
      for (const locale of LOCALES) {
        const theirs = placeholders(DICTIONARIES[locale][key]);
        const ours = placeholders(en[key]);
        if (theirs.join() !== ours.join()) wrong.push(`${locale}:${key}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("say something for every key", () => {
    for (const key of keys) {
      for (const locale of LOCALES) expect(DICTIONARIES[locale][key].trim()).not.toBe("");
    }
  });

  it("keep both halves of every plural", () => {
    for (const key of keys) {
      const other = key.replace(/\.one$/, ".other").replace(/\.other$/, ".one");
      if (other !== key) expect(keys).toContain(other);
    }
  });

  it("are translated, not copied", () => {
    const shared = keys.filter((k) => en[k] === pt[k]);
    expect(shared.sort()).toEqual([
      "app.name",
      "auth.done",
      "auth.email",
      "edit.armada",
      "files.geojson",
      "files.gpx",
      "files.kml",
      "hunt.type.salto",
      "imagery.esri",
      "list.portaN",
      "locale.en",
      "locale.pt",
      "obs.keptName",
      "privacy.cookies.title",
      "role.batedor",
      "role.porta",
      "type.armada",
      "type.mancha",
      "type.porta",
    ]);
  });
});

describe("translate", () => {
  it("fills placeholders, and leaves one alone when nothing was passed for it", () => {
    expect(translate(en, "obs.marked", { name: "Pai", time: "09:45", ago: "8 minutes ago" })).toBe("Marked by Pai at 09:45 (8 minutes ago)");
    expect(translate(pt, "obs.marked", { name: "Pai", time: "09:45", ago: "há 8 minutos" })).toBe("Marcado por Pai às 09:45 (há 8 minutos)");
    expect(translate(en, "obs.marked", { name: "Pai", time: "09:45" })).toContain("{ago}");
  });

  it("resolves a message a pure module handed back", () => {
    expect(say(pt, msg("safety.notice"))).toBe(pt["safety.notice"]);
  });
});

describe("the locale", () => {
  it("recognises only what it speaks", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt")).toBe(true);
    for (const bad of ["fr", "", "PT", 1, null, undefined, {}]) expect(isLocale(bad)).toBe(false);
  });

  it("matches the browser on the base tag", () => {
    expect(detectLocale(["pt-PT"])).toBe("pt");
    expect(detectLocale(["pt-BR", "en-US"])).toBe("pt");
    expect(detectLocale(["en-GB"])).toBe("en");
  });

  it("takes the first language it speaks, not the first listed", () => {
    expect(detectLocale(["fr", "en", "pt"])).toBe("en");
  });

  it("falls back to Portuguese", () => {
    expect(detectLocale([])).toBe("pt");
    expect(detectLocale(["fr-FR", "de"])).toBe("pt");
  });
});
