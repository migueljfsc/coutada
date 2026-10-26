/**
 * The map's style: every imagery source as a raster layer with only the chosen one visible, and
 * the user's own position above them. No glyphs and no sprite: labels and icons are images the
 * app draws itself (D24).
 */

import type { AddLayerObject, MapOptions } from "maplibre-gl";
import type { ImageryId } from "../doc/catalogue";
import { AVAILABLE_IMAGERY } from "./imagery";
import { EMPTY, PERSON } from "./me";

export type Style = Exclude<MapOptions["style"], string | undefined>;

export const ME_SOURCE = "me";
export const imageryLayer = (id: ImageryId) => `imagery-${id}`;

/** The ground shown where no tile has arrived: xisto, the chrome's ink. */
const GROUND = "#23281f";

const meLayers: AddLayerObject[] = [
  {
    id: "me-accuracy-fill",
    type: "fill",
    source: ME_SOURCE,
    filter: ["==", ["get", "role"], "accuracy"],
    paint: { "fill-color": PERSON, "fill-opacity": 0.14 },
  },
  {
    id: "me-accuracy-line",
    type: "line",
    source: ME_SOURCE,
    filter: ["==", ["get", "role"], "accuracy"],
    paint: { "line-color": PERSON, "line-opacity": 0.6, "line-width": 1.25 },
  },
  {
    id: "me-heading",
    type: "symbol",
    source: ME_SOURCE,
    filter: ["all", ["==", ["get", "role"], "dot"], [">=", ["get", "heading"], 0]],
    layout: {
      "icon-image": "me-cone",
      "icon-rotate": ["get", "heading"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  },
  {
    id: "me-dot",
    type: "circle",
    source: ME_SOURCE,
    filter: ["==", ["get", "role"], "dot"],
    paint: {
      "circle-radius": 8,
      "circle-color": PERSON,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  },
];

export function baseStyle(imagery: ImageryId): Style {
  return {
    version: 8,
    sources: {
      ...Object.fromEntries(
        AVAILABLE_IMAGERY.map((i) => [
          i.id,
          { type: "raster", tiles: [i.url], tileSize: i.tileSize, maxzoom: i.maxzoom, attribution: i.attribution },
        ]),
      ),
      [ME_SOURCE]: { type: "geojson", data: EMPTY },
    },
    layers: [
      { id: "ground", type: "background", paint: { "background-color": GROUND } },
      ...AVAILABLE_IMAGERY.map(
        (i): AddLayerObject => ({
          id: imageryLayer(i.id),
          type: "raster",
          source: i.id,
          layout: { visibility: i.id === imagery ? "visible" : "none" },
          paint: { "raster-fade-duration": 150 },
        }),
      ),
      ...meLayers,
    ],
  } as Style;
}

/** The heading cone drawn beside the dot: a soft wedge pointing up, rotated by the map. */
export function headingCone(size = 96): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255, 90, 31, 0.55)");
  gradient.addColorStop(1, "rgba(255, 90, 31, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, c, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
