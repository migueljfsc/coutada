/** The translation context and its hook, apart from the provider so fast refresh keeps working. */

import { createContext, useContext } from "react";
import type { Locale, Message, MessageKey, PluralKey, Vars } from "./core";

export type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translates a key, filling any `{placeholders}`. */
  t: (key: MessageKey, vars?: Vars) => string;
  /** The `.one` or `.other` form, by count. */
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  /** Resolves a `Message` a pure module handed back. */
  tm: (message: Message) => string;
};

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n was called outside an I18nProvider.");
  return value;
}
