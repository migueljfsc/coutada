/**
 * The map document: one GeoJSON FeatureCollection, WGS84 `[lon, lat]`, the map's own fields in the
 * `coutada` foreign member (D7). `schema.ts` validates it; the Worker imports the same schema.
 * An absent optional field means the old behaviour, so adding one needs no migration.
 */

import type { Position } from "../geo/geo";
import type { ImageryId, PaletteKey, PinType, RouteType, Species, ZoneType } from "./catalogue";

export const DOC_VERSION = 1;

/** 22-character base64url, 128 bits. */
export type FeatureId = string;

type Common = {
  name?: string;
  note?: string;
  color?: PaletteKey;
  /** ms since epoch, set by every operation that changes the feature. */
  updatedAt: number;
};

export type PinProps = Common & {
  kind: "pin";
  type: PinType;
  /** A porta's number. */
  n?: number;
  /** The armada (a route id) a porta stands on. */
  armada?: FeatureId;
  /** What a `game` pin marks. */
  species?: Species;
};
export type RouteProps = Common & { kind: "route"; type: RouteType };
export type ZoneProps = Common & { kind: "zone"; type: ZoneType };

export type PinFeature = {
  type: "Feature";
  id: FeatureId;
  geometry: { type: "Point"; coordinates: Position };
  properties: PinProps;
};

export type RouteFeature = {
  type: "Feature";
  id: FeatureId;
  geometry: { type: "LineString"; coordinates: Position[] };
  properties: RouteProps;
};

/** One ring, closed: first position equals last. No holes. */
export type ZoneFeature = {
  type: "Feature";
  id: FeatureId;
  geometry: { type: "Polygon"; coordinates: [Position[]] };
  properties: ZoneProps;
};

export type MapFeature = PinFeature | RouteFeature | ZoneFeature;

export type MapMeta = {
  v: typeof DOC_VERSION;
  name: string;
  imagery?: ImageryId;
  view?: { center: Position; zoom: number };
};

export type MapDoc = {
  type: "FeatureCollection";
  coutada: MapMeta;
  features: MapFeature[];
};
