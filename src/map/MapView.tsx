/**
 * The MapLibre map, full bleed. Owns the map instance; everything else talks to it through props
 * and the `onReady` handle.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ImageryId } from "../doc/catalogue";
import type { Position } from "../geo/geo";
import { AVAILABLE_IMAGERY } from "./imagery";
import { meFeatures, type Fix } from "./me";
import { baseStyle, headingCone, imageryLayer, ME_SOURCE } from "./style";

setWorkerUrl(workerUrl);

export type View = { center: Position; zoom: number };

/** How long a chosen source may go without delivering a tile before it counts as failing (D18). */
const SOURCE_PATIENCE_MS = 10_000;

type Props = {
  imagery: ImageryId;
  initialView: View;
  fix: Fix | null;
  /** CSS px covered by the sheet, so the map centres in what is visible. */
  inset: { bottom: number; left: number };
  onReady?: (map: MapLibreMap) => void;
  onViewChange?: (view: View) => void;
  /** True while the chosen imagery is not delivering tiles. */
  onImageryFailing?: (failing: boolean) => void;
};

export function MapView({ imagery, initialView, fix, inset, onReady, onViewChange, onImageryFailing }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const latest = useRef({ imagery, fix, onViewChange, onImageryFailing });
  useLayoutEffect(() => {
    latest.current = { imagery, fix, onViewChange, onImageryFailing };
  });

  useEffect(() => {
    const map = new MapLibreMap({
      container: container.current!,
      style: baseStyle(latest.current.imagery),
      center: [initialView.center[0], initialView.center[1]],
      zoom: initialView.zoom,
      maxZoom: 21,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on("load", () => {
      loaded.current = true;
      map.addImage("me-cone", headingCone(), { pixelRatio: 2 });
      sync(map, latest.current.imagery, latest.current.fix);
      onReady?.(map);
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      latest.current.onViewChange?.({ center: [c.lng, c.lat], zoom: map.getZoom() });
    });
    map.on("data", (e) => {
      const event = e as { dataType?: string; sourceId?: string; tile?: unknown };
      if (event.dataType === "source" && event.tile && event.sourceId === latest.current.imagery) {
        latest.current.onImageryFailing?.(false);
      }
    });
    map.on("error", (e) => {
      const event = e as { sourceId?: string };
      if (event.sourceId === latest.current.imagery) latest.current.onImageryFailing?.(true);
    });

    return () => {
      loaded.current = false;
      mapRef.current = null;
      map.remove();
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && loaded.current) sync(mapRef.current, imagery, fix);
  }, [imagery, fix]);

  useEffect(() => {
    latest.current.onImageryFailing?.(false);
    const map = mapRef.current;
    const timer = setTimeout(() => {
      let loadedSource = false;
      try {
        loadedSource = !!map?.isSourceLoaded(imagery);
      } catch {
        // The style is still loading; that counts as not delivering.
      }
      if (!loadedSource) latest.current.onImageryFailing?.(true);
    }, SOURCE_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [imagery]);

  useEffect(() => {
    mapRef.current?.setPadding({ top: 0, right: 0, left: inset.left, bottom: inset.bottom });
  }, [inset.left, inset.bottom]);

  // MapLibre's stylesheet sets `position: relative` on the container, unlayered, which beats any
  // Tailwind utility; the wrapper does the positioning instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function sync(map: MapLibreMap, imagery: ImageryId, fix: Fix | null) {
  for (const i of AVAILABLE_IMAGERY) {
    map.setLayoutProperty(imageryLayer(i.id), "visibility", i.id === imagery ? "visible" : "none");
  }
  const source = map.getSource(ME_SOURCE) as unknown as { setData(data: unknown): void } | undefined;
  source?.setData(meFeatures(fix));
}
