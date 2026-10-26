/**
 * The translation runtime. Pure: pure modules return a `Message` (a key and its variables) and the
 * UI resolves it (D3). `en` declares which keys exist; `pt` is typed against it.
 */

import { en } from "./en";

export const LOCALES = ["pt", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

/** Values substituted into `{name}` placeholders. */
export type Vars = Record<string, string | number>;

/** A translatable string that has not been translated yet. */
export type Message = { key: MessageKey; vars?: Vars };

export const msg = (key: MessageKey, vars?: Vars): Message => ({ key, vars });

/** Prefixes that have `.one` and `.other` forms — the argument `plural` takes. */
type PluralPrefix<K> = K extends `${infer P}.one` ? P : never;
export type PluralKey = PluralPrefix<MessageKey>;

const FIELD = /\{(\w+)\}/g;

/** Looks up `key` and fills its placeholders, falling back through English to the key itself. */
export function translate(dict: Dictionary, key: MessageKey, vars?: Vars): string {
  const text = dict[key] ?? en[key] ?? key;
  if (!vars) return text;
  return text.replace(FIELD, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** The `.one` or `.other` form of `key`, by `count`; English and Portuguese split alike. */
export function plural(
  dict: Dictionary,
  key: PluralKey,
  count: number,
  vars?: Vars,
): string {
  const form = `${key}.${count === 1 ? "one" : "other"}` as MessageKey;
  return translate(dict, form, { count, ...vars });
}

/** Resolves a message a pure module handed back. */
export const say = (dict: Dictionary, message: Message): string =>
  translate(dict, message.key, message.vars);
