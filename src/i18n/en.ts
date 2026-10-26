/**
 * English copy, and the source of truth for which keys exist.
 *
 *   - Keys are grouped by where the string appears.
 *   - `{name}` placeholders are part of the contract and match in every locale.
 *   - A `.one` / `.other` pair is a plural, reached through `plural()`.
 *   - Anything with a variable is a whole sentence with a placeholder, never fragments.
 *   - Hunting terms stay Portuguese in both languages (D3).
 */

export const en = {
  // ------------------------------------------------------------------- app
  "app.name": "Coutada",
  "app.tagline": "The hunt on the map: portas, armadas, manchas and routes, and where everyone is.",
  "app.locale": "Language",
  "app.soon": "Under construction.",

  // ----------------------------------------------------------------- safety
  "safety.notice": "Not a safety system. Always confirm by sight and by radio.",
} as const;
