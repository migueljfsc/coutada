/**
 * Where the chosen language lives: the storage layer, so nothing throws and what comes back is
 * validated.
 */

import { browserStore, keyFor, read, write } from "@/share/storage";
import { isLocale, type Locale } from "./core";

export const LOCALE_KEY = keyFor("locale");

/** The stored choice, or null when there is not a usable one. */
export const storedLocale = (store = browserStore()): Locale | null =>
  read(store, LOCALE_KEY, (raw) => (isLocale(raw) ? raw : null));

export const storeLocale = (locale: Locale, store = browserStore()): boolean =>
  write(store, LOCALE_KEY, locale);

/**
 * The first browser language this app speaks, matched on the base tag (pt-PT, pt-BR and pt all
 * land on Portuguese), else Portuguese (D3).
 */
export function detectLocale(tags?: readonly string[]): Locale {
  const languages =
    tags ??
    (typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]));

  for (const tag of languages) {
    if (typeof tag !== "string") continue;
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "pt";
}
