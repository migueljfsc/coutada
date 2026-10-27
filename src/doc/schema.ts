/**
 * The map document's validator, shared by the browser and the Worker (D7). Unknown keys are
 * dropped; everything the document may hold is stated here, with its cap.
 */

import { z } from "zod";
import {
  IMAGERY_IDS,
  LIMITS,
  PALETTE_KEYS,
  type PaletteKey,
  PIN_TYPES,
  ROUTE_TYPES,
  SPECIES,
  ZONE_TYPES,
} from "./catalogue";
import { DOC_VERSION, type MapDoc } from "./types";

export const FEATURE_ID = /^[A-Za-z0-9_-]{22}$/;

/** No control characters. */
const PRINTABLE = /^[^\p{Cc}]*$/u;
/** What the map's label glyphs can draw: Latin, 0x20–0x1FF, without the C1 controls (D24). */
const LABEL = /^[\x20-\x7e\xa0-\u01ff]*$/;

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const label = (max: number) =>
  z.string().trim().min(1).max(max).regex(LABEL);

/** Whether `text` can be a feature's name: the rule the schema applies, for a form to check first. */
export const isFeatureName = (text: string): boolean => label(LIMITS.name).safeParse(text).success;

const common = {
  name: label(LIMITS.name).optional(),
  note: z.string().max(LIMITS.note).regex(PRINTABLE).optional(),
  color: z.enum(PALETTE_KEYS as [PaletteKey, ...PaletteKey[]]).optional(),
  updatedAt: z.number().int().nonnegative(),
};

const id = z.string().regex(FEATURE_ID);

const pin = z.object({
  type: z.literal("Feature"),
  id,
  geometry: z.object({ type: z.literal("Point"), coordinates: position }),
  properties: z
    .object({
      ...common,
      kind: z.literal("pin"),
      type: z.enum(PIN_TYPES),
      n: z.number().int().min(1).max(LIMITS.portaNumber).optional(),
      armada: id.optional(),
      species: z.enum(SPECIES).optional(),
    })
    .refine((p) => p.type === "porta" || (p.n === undefined && p.armada === undefined), {
      message: "only a porta has a number or an armada",
    })
    .refine((p) => p.type === "game" || p.species === undefined, {
      message: "only a game pin has a species",
    }),
});

const route = z.object({
  type: z.literal("Feature"),
  id,
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(position).min(2).max(LIMITS.vertices),
  }),
  properties: z.object({ ...common, kind: z.literal("route"), type: z.enum(ROUTE_TYPES) }),
});

const ring = z
  .array(position)
  .min(4)
  .max(LIMITS.vertices)
  .refine((r) => r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1], {
    message: "a ring is closed",
  });

const zone = z.object({
  type: z.literal("Feature"),
  id,
  geometry: z.object({ type: z.literal("Polygon"), coordinates: z.tuple([ring]) }),
  properties: z.object({ ...common, kind: z.literal("zone"), type: z.enum(ZONE_TYPES) }),
});

/** One feature, as a live hunt sends it (D12). */
export const mapFeatureSchema = z.union([pin, route, zone]);

export const mapDocSchema = z.object({
  type: z.literal("FeatureCollection"),
  coutada: z.object({
    v: z.literal(DOC_VERSION),
    name: label(LIMITS.mapName),
    imagery: z.enum(IMAGERY_IDS).optional(),
    view: z.object({ center: position, zoom: z.number().min(0).max(22) }).optional(),
  }),
  features: z
    .array(mapFeatureSchema)
    .max(LIMITS.features)
    .refine((fs) => new Set(fs.map((f) => f.id)).size === fs.length, {
      message: "feature ids are unique",
    }),
});

/** UTF-8 bytes of the serialised document, the size the caps count. */
export const docBytes = (doc: unknown): number => new TextEncoder().encode(JSON.stringify(doc)).length;

/** The document, or null when it is not one. Never repairs (pb-D31). */
export function parseMapDoc(raw: unknown): MapDoc | null {
  const result = mapDocSchema.safeParse(raw);
  if (!result.success || docBytes(result.data) > LIMITS.docBytes) return null;
  return result.data as MapDoc;
}
