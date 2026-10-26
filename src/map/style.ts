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
export const DRAWING_SOURCES = ["shapes", "labels", "handles", "draft"] as const;
export type DrawingSource = (typeof DRAWING_SOURCES)[number];
export const imageryLayer = (id: ImageryId) => `imagery-${id}`;

const ANIL = "#1e4fa0";
const INK = "#23281f";

const kindIs = (kind: string) => ["==", ["get", "kind"], kind] as const;
const typeIn = (...types: string[]) => ["in", ["get", "type"], ["literal", types]] as const;

/** Layers a tap can select, in priority order: a pin beats a route beats an area. */
export const HIT_LAYERS = ["pins", "routes-solid", "routes-dashed", "zones-fill", "zones-solid", "zones-dashed"];
/** Layers a drag can grab. */
export const HANDLE_LAYERS = ["handles-vertex", "handles-mid", "pin-grab"];

const drawingLayers = [
  {
    id: "zones-fill",
    type: "fill",
    source: "shapes",
    filter: ["all", kindIs("zone"), ["!=", ["get", "type"], "boundary"]],
    paint: { "fill-color": ["get", "colour"], "fill-opacity": ["case", ["==", ["get", "type"], "no_shoot"], 0.24, 0.16] },
  },
  {
    id: "selected-halo",
    type: "line",
    source: "shapes",
    filter: ["all", ["==", ["get", "sel"], 1], ["!=", ["get", "kind"], "pin"]],
    paint: { "line-color": ANIL, "line-width": 11, "line-opacity": 0.6 },
  },
  {
    id: "zones-solid",
    type: "line",
    source: "shapes",
    filter: ["all", kindIs("zone"), typeIn("mancha")],
    paint: { "line-color": ["get", "colour"], "line-width": 2.5 },
  },
  {
    id: "zones-dashed",
    type: "line",
    source: "shapes",
    filter: ["all", kindIs("zone"), typeIn("no_shoot", "boundary")],
    paint: {
      "line-color": ["get", "colour"],
      "line-width": ["case", ["==", ["get", "type"], "boundary"], 3.5, 2.5],
      "line-dasharray": [2.5, 1.5],
    },
  },
  {
    id: "routes-casing",
    type: "line",
    source: "shapes",
    filter: kindIs("route"),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": INK, "line-width": 7, "line-opacity": 0.5 },
  },
  {
    id: "routes-solid",
    type: "line",
    source: "shapes",
    filter: ["all", kindIs("route"), typeIn("armada")],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "colour"], "line-width": 4 },
  },
  {
    id: "routes-dashed",
    type: "line",
    source: "shapes",
    filter: ["all", kindIs("route"), typeIn("walk")],
    layout: { "line-join": "round" },
    paint: { "line-color": ["get", "colour"], "line-width": 4, "line-dasharray": [2, 1.2] },
  },
  {
    id: "draft-area",
    type: "fill",
    source: "draft",
    filter: ["==", ["get", "role"], "area"],
    paint: { "fill-color": ANIL, "fill-opacity": 0.18 },
  },
  {
    id: "draft-line",
    type: "line",
    source: "draft",
    filter: ["in", ["get", "role"], ["literal", ["line", "area"]]],
    paint: { "line-color": ANIL, "line-width": 3, "line-dasharray": [2, 1] },
  },
  {
    id: "draft-vertex",
    type: "circle",
    source: "draft",
    filter: ["==", ["get", "role"], "vertex"],
    paint: { "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": ANIL, "circle-stroke-width": 3 },
  },
  {
    id: "pin-halo",
    type: "circle",
    source: "shapes",
    filter: ["all", kindIs("pin"), ["==", ["get", "sel"], 1]],
    paint: { "circle-radius": 26, "circle-color": ANIL, "circle-opacity": 0.45 },
  },
  {
    id: "pins",
    type: "symbol",
    source: "shapes",
    filter: kindIs("pin"),
    layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true },
  },
  {
    id: "labels",
    type: "symbol",
    source: "labels",
    layout: {
      "icon-image": ["get", "label"],
      "icon-anchor": ["case", ["==", ["get", "kind"], "pin"], "top", "center"],
      "icon-offset": ["case", ["==", ["get", "kind"], "pin"], ["literal", [0, 22]], ["literal", [0, 0]]],
      "icon-optional": true,
    },
  },
  {
    id: "pin-grab",
    type: "circle",
    source: "shapes",
    filter: ["all", kindIs("pin"), ["==", ["get", "sel"], 1]],
    paint: { "circle-radius": 24, "circle-opacity": 0 },
  },
  {
    id: "handles-mid",
    type: "circle",
    source: "handles",
    filter: ["==", ["get", "role"], "mid"],
    paint: { "circle-radius": 7, "circle-color": ANIL, "circle-opacity": 0.75, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  },
  {
    id: "handles-vertex",
    type: "circle",
    source: "handles",
    filter: ["==", ["get", "role"], "vertex"],
    paint: {
      "circle-radius": ["case", ["==", ["get", "chosen"], 1], 12, 9],
      "circle-color": "#ffffff",
      "circle-stroke-color": ANIL,
      "circle-stroke-width": 3,
    },
  },
] as AddLayerObject[];

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
      "icon-anchor": "center",
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
      ...Object.fromEntries(DRAWING_SOURCES.map((s) => [s, { type: "geojson", data: EMPTY }])),
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
      ...drawingLayers,
      ...meLayers,
    ],
  } as Style;
}

/**
 * The heading beam drawn under the dot, as Google Maps does: a wedge pointing up (north before the
 * map rotates it), solid at the dot and fading out, wide enough to read at a glance.
 */
export function headingCone(size = 176): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255, 90, 31, 0.75)");
  gradient.addColorStop(0.35, "rgba(255, 90, 31, 0.45)");
  gradient.addColorStop(1, "rgba(255, 90, 31, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, c, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
