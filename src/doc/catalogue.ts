/**
 * What a map can hold: feature kinds and types, the drawing palette, the imagery ids (D7, D18).
 * Pure; the UI reads names and icons from its own tables keyed by these ids.
 */

export const PIN_TYPES = ["porta", "landmark", "gate", "parking", "meeting", "danger", "water"] as const;
export const ROUTE_TYPES = ["walk", "armada"] as const;
export const ZONE_TYPES = ["mancha", "no_shoot", "boundary"] as const;

export type PinType = (typeof PIN_TYPES)[number];
export type RouteType = (typeof ROUTE_TYPES)[number];
export type ZoneType = (typeof ZONE_TYPES)[number];

/**
 * Drawing colours, chosen to read against green and brown imagery. Orange is not here: it is
 * reserved for people on the map.
 */
export const PALETTE = {
  white: "#ffffff",
  yellow: "#ffd23f",
  cyan: "#3fd0ff",
  magenta: "#ff4fa3",
  lime: "#9be23c",
  red: "#ff3b3b",
} as const;

export type PaletteKey = keyof typeof PALETTE;
export const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

/** The colour a feature is drawn in when it names none. */
export const DEFAULT_COLOR: Record<PinType | RouteType | ZoneType, PaletteKey> = {
  porta: "white",
  landmark: "white",
  gate: "yellow",
  parking: "cyan",
  meeting: "cyan",
  danger: "red",
  water: "cyan",
  walk: "yellow",
  armada: "white",
  mancha: "lime",
  no_shoot: "red",
  boundary: "yellow",
};

export const IMAGERY_IDS = ["ortosat2023", "ortos2021", "esri"] as const;
export type ImageryId = (typeof IMAGERY_IDS)[number];
export const DEFAULT_IMAGERY: ImageryId = "ortosat2023";

/** Caps checked by the schema in the browser and the Worker (D7). */
export const LIMITS = {
  features: 500,
  vertices: 2000,
  docBytes: 256 * 1024,
  name: 60,
  note: 500,
  mapName: 60,
  portaNumber: 999,
} as const;
