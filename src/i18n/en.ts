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

  // ----------------------------------------------------------------- types
  "type.porta": "Porta",
  "type.landmark": "Landmark",
  "type.gate": "Gate",
  "type.parking": "Parking",
  "type.meeting": "Meeting point",
  "type.danger": "Danger",
  "type.water": "Water for the dogs",
  "type.walk": "Route",
  "type.armada": "Armada",
  "type.mancha": "Mancha",
  "type.no_shoot": "No-shoot zone",
  "type.boundary": "Property boundary",
  "colour.white": "White",
  "colour.yellow": "Yellow",
  "colour.cyan": "Cyan",
  "colour.magenta": "Magenta",
  "colour.lime": "Lime",
  "colour.red": "Red",

  // --------------------------------------------------------------- drawing
  "tool.pin": "Mark a place",
  "tool.line": "Draw a route",
  "tool.area": "Draw an area",
  "pick.pin": "What are you marking?",
  "pick.line": "What kind of line?",
  "pick.area": "What kind of area?",
  "draw.tapPin": "Tap the map where it goes.",
  "draw.tapLine": "Tap the map to add points, then finish.",
  "draw.points.one": "1 point",
  "draw.points.other": "{count} points",
  "draw.undoPoint": "Undo point",
  "draw.cancel": "Cancel",
  "draw.finish": "Finish",
  "history.undo": "Undo",
  "history.redo": "Redo",

  // ---------------------------------------------------------------- editing
  "edit.close": "Close",
  "edit.name": "Name",
  "edit.nameInvalid": "Use letters, numbers and punctuation only, up to 60 characters.",
  "edit.colour": "Colour",
  "edit.note": "Note",
  "edit.number": "Number",
  "edit.armada": "Armada",
  "edit.noArmada": "Not on an armada",
  "edit.numberPortas.one": "Number its porta",
  "edit.numberPortas.other": "Number its {count} portas",
  "edit.noPortas": "No portas on this armada yet. Portas marked within 40 m of it join it.",
  "edit.length": "Length",
  "edit.area": "Area",
  "edit.shapeHint": "Drag a point to move it; drag a small dot to add a point.",
  "edit.pinHint": "Drag it to move it.",
  "edit.deleteVertex": "Delete this point",
  "edit.delete": "Delete",
  "map.name": "Map name",
  "list.empty": "Nothing drawn yet. Use the tools on the right to mark portas, routes and areas.",
  "list.portaN": "Porta {n}",

  // -------------------------------------------------------------- documents
  "doc.notAMap": "This file is not a Coutada map.",
  "doc.tooNew": "This map was saved by a newer version of Coutada (v{version}). Reload the page to update.",
  "doc.invalid": "This map is damaged or too large to open.",

  // ----------------------------------------------------------------- safety
  "safety.notice": "Not a safety system. Always confirm by sight and by radio.",
} as const;
