/**
 * The user's own position on the map: an accuracy circle and a dot with its heading, in blaze
 * orange — the colour reserved for people. Pure: a fix in, GeoJSON out.
 */

import { circle, type Position } from "../geo/geo";

export type Fix = {
  at: Position;
  /** Metres, as the browser reports it. */
  accuracy: number;
  /** Degrees from true north, or null when unknown. */
  heading: number | null;
  /** ms since epoch. */
  time: number;
};

export const PERSON = "#ff5a1f";

type Geometry =
  | { type: "Point"; coordinates: number[] }
  | { type: "Polygon"; coordinates: number[][][] };

export type MeCollection = {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: Record<string, string | number>; geometry: Geometry }[];
};

export const EMPTY: MeCollection = { type: "FeatureCollection", features: [] };

export function meFeatures(fix: Fix | null): MeCollection {
  if (!fix) return EMPTY;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { role: "accuracy" },
        geometry: { type: "Polygon", coordinates: [circle(fix.at, Math.max(fix.accuracy, 1)).map((p) => [p[0], p[1]])] },
      },
      {
        type: "Feature",
        properties: { role: "dot", heading: fix.heading ?? -1 },
        geometry: { type: "Point", coordinates: [fix.at[0], fix.at[1]] },
      },
    ],
  };
}
