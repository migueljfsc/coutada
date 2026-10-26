/**
 * What downloading a map's area means (D19): everything drawn plus 500 m, at every tile zoom the
 * map asks for, with an estimate before anything is fetched. Pure.
 */

import type { MapDoc } from "../doc/types";
import { bboxOf, bufferBBox, type BBox, type Position } from "../geo/geo";
import { tilesCovering, type Tile } from "./tiles";

export const AREA_MARGIN_M = 500;
/** Tile zooms (512 px tiles): 9 is the region, 17 the deepest the sources serve. */
export const MIN_TILE_ZOOM = 9;
export const FULL_TILE_ZOOM = 17;
export const LIGHT_TILE_ZOOM = 16;
/** A pack never asks for more than this many tiles per source. */
export const MAX_PACK_TILES = 3000;
/** Measured at Salvaterra: an OrtoSat 512 px JPEG is about 65 KB. */
export const BYTES_PER_TILE = 65 * 1024;

export type Detail = "full" | "light";

export type PackPlan = {
  area: BBox;
  tiles: Tile[];
  bytes: number;
  /** More tiles than a pack may hold: the area is too big to download at this detail. */
  tooBig: boolean;
};

/** Every position the map's features name. */
export function positionsOf(doc: MapDoc): Position[] {
  return doc.features.flatMap((f): Position[] =>
    f.geometry.type === "Point" ? [f.geometry.coordinates] : f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates[0],
  );
}

/** The area to download, or null for a map with nothing drawn. */
export function areaOf(doc: MapDoc): BBox | null {
  const box = bboxOf(positionsOf(doc));
  return box ? bufferBBox(box, AREA_MARGIN_M) : null;
}

export function planPack(area: BBox, detail: Detail): PackPlan {
  const top = detail === "full" ? FULL_TILE_ZOOM : LIGHT_TILE_ZOOM;
  const tiles: Tile[] = [];
  for (let z = MIN_TILE_ZOOM; z <= top; z++) tiles.push(...tilesCovering(area, z));
  return { area, tiles, bytes: tiles.length * BYTES_PER_TILE, tooBig: tiles.length > MAX_PACK_TILES };
}
