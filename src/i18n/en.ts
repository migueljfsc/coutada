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
  "app.locale": "Language",
  "locale.pt": "Português",
  "locale.en": "English",

  // ------------------------------------------------------------------- map
  "map.untitled": "Untitled map",
  "sheet.label": "Map details",
  "sheet.expand": "Show details",
  "sheet.collapse": "Hide details",

  // --------------------------------------------------------------- imagery
  "imagery.title": "Imagery",
  "imagery.ortosat2023": "Satellite, 2023",
  "imagery.ortosat2023.detail": "30 cm, all of mainland Portugal",
  "imagery.ortos2021": "Aerial photo, 2021",
  "imagery.ortos2021.detail": "25 cm, north of the Tejo, sometimes slow",
  "imagery.esri": "Esri World Imagery",
  "imagery.esri.detail": "Worldwide, online only",
  "imagery.failing": "{source} is not responding. The map shows what has already loaded.",
  "imagery.useDefault": "Use the satellite",

  // ------------------------------------------------------------ my position
  "locate.start": "Show my position",
  "locate.recenter": "Centre on my position",
  "locate.stop": "Stop showing my position",
  "locate.off": "Your position is not shown.",
  "locate.asking": "Finding your position…",
  "locate.accuracy": "You are here, to within {m} m.",
  "locate.denied": "Location is blocked for this site. Allow it in the browser's settings to see yourself on the map.",
  "locate.unavailable": "No GPS fix yet. Move to open sky and try again.",
  "position.coords": "Coordinates",
  "position.accuracy": "Accuracy",

  // -------------------------------------------------------------- documents
  "doc.notAMap": "This file is not a Coutada map.",
  "doc.tooNew": "This map was saved by a newer version of Coutada (v{version}). Reload the page to update.",
  "doc.invalid": "This map is damaged or too large to open.",

  // ----------------------------------------------------------------- safety
  "safety.notice": "Not a safety system. Always confirm by sight and by radio.",
} as const;
