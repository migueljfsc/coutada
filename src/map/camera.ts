/** Where the camera goes for a search's answer (D28): a place's whole extent, or a point up close. */

import type { Map as MapLibreMap } from "maplibre-gl";
import type { Position } from "../geo/geo";

export function frameFound(m: MapLibreMap, at: Position, bbox: readonly [number, number, number, number] | null, closeZoom: number) {
  if (bbox && (bbox[2] - bbox[0] > 1e-4 || bbox[3] - bbox[1] > 1e-4)) {
    m.fitBounds([bbox[0], bbox[1], bbox[2], bbox[3]], { padding: 60, maxZoom: 16 });
  } else {
    m.easeTo({ center: [at[0], at[1]], zoom: Math.max(m.getZoom(), closeZoom) });
  }
}
