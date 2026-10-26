/**
 * The MapLibre map, full bleed. Owns the map instance; the screen drives it through props and
 * hears back through taps, drags, view changes and imagery health.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { Map as MapLibreMap, setWorkerUrl, type MapMouseEvent, type MapTouchEvent } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ImageryId } from "../doc/catalogue";
import type { Position } from "../geo/geo";
import type { Rendered } from "./drawing";
import { AVAILABLE_IMAGERY } from "./imagery";
import { prepareImages, provideImage } from "./images";
import { meFeatures, type Fix } from "./me";
import { baseStyle, DRAWING_SOURCES, HANDLE_LAYERS, HIT_LAYERS, headingCone, imageryLayer, ME_SOURCE } from "./style";

setWorkerUrl(workerUrl);

export type View = { center: Position; zoom: number };

/** How long a chosen source may go without delivering a tile before it counts as failing (D18). */
const SOURCE_PATIENCE_MS = 20_000;
/** Half the side of the square a tap searches, CSS px: a fingertip, not a pixel. */
const TAP_SLOP = 14;

export type Handle = { role: "vertex" | "mid"; i: number } | { role: "pin"; fid: string };
export type DragPhase = "start" | "move" | "end";

type Props = {
  imagery: ImageryId;
  initialView: View;
  fix: Fix | null;
  rendered: Rendered;
  /** A tool is in hand: the cursor is a crosshair and taps place points. */
  drawing: boolean;
  /** CSS px covered by the sheet, so the map centres in what is visible. */
  inset: { bottom: number; left: number };
  /** The map, as soon as it exists — before its style and tiles have loaded. */
  onReady?: (map: MapLibreMap) => void;
  onViewChange?: (view: View) => void;
  /** True while the chosen imagery is not delivering tiles. */
  onImageryFailing?: (failing: boolean) => void;
  onTap?: (at: Position, hit: string | null, handle: Handle | null) => void;
  onDrag?: (handle: Handle, to: Position, phase: DragPhase) => void;
};

type Setter = { setData(data: unknown): void };

export function MapView(props: Props) {
  const { imagery, initialView, fix, rendered, drawing, inset } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    void prepareImages().then(() => {
      if (cancelled) return;
      const m = new MapLibreMap({
        container: container.current!,
        style: baseStyle(latest.current.imagery),
        center: [initialView.center[0], initialView.center[1]],
        zoom: initialView.zoom,
        maxZoom: 21,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        doubleClickZoom: false,
      });
      map = m;
      m.touchZoomRotate.disableRotation();
      mapRef.current = m;
      // Handed over at once: the camera can move before the first tiles, which may take a while.
      latest.current.onReady?.(m);

      m.setMissingStyleImageResolver((id) => provideImage(m, id));
      // `style.load`, not `load`: the drawing must not wait for the imagery's first tiles.
      m.once("style.load", () => {
        loaded.current = true;
        m.addImage("me-cone", headingCone(), { pixelRatio: 2 });
        sync(m, latest.current);
      });
      m.on("moveend", () => {
        const c = m.getCenter();
        latest.current.onViewChange?.({ center: [c.lng, c.lat], zoom: m.getZoom() });
      });
      m.on("data", (e) => {
        const event = e as { dataType?: string; sourceId?: string; tile?: unknown };
        if (event.dataType === "source" && event.tile && event.sourceId === latest.current.imagery) {
          latest.current.onImageryFailing?.(false);
        }
      });
      m.on("error", (e) => {
        const event = e as { sourceId?: string };
        if (event.sourceId === latest.current.imagery) latest.current.onImageryFailing?.(true);
      });

      const dragged = { current: false };
      m.on("click", (e) => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        const { x, y } = e.point;
        const box: [[number, number], [number, number]] = [
          [x - TAP_SLOP, y - TAP_SLOP],
          [x + TAP_SLOP, y + TAP_SLOP],
        ];
        const handleHit = m.queryRenderedFeatures(box, { layers: ["handles-vertex"] })[0];
        const handle: Handle | null = handleHit ? { role: "vertex", i: Number(handleHit.properties.i) } : null;
        const hits = m.queryRenderedFeatures(box, { layers: HIT_LAYERS });
        const ranked = hits.sort((a, b) => HIT_LAYERS.indexOf(a.layer.id) - HIT_LAYERS.indexOf(b.layer.id));
        const fid = ranked[0]?.properties.fid;
        latest.current.onTap?.([e.lngLat.lng, e.lngLat.lat], typeof fid === "string" ? fid : null, handle);
      });

      const begin = (e: MapMouseEvent | MapTouchEvent) => {
        if ("points" in e && e.points.length !== 1) return;
        const hit = m.queryRenderedFeatures(e.point, { layers: HANDLE_LAYERS })[0];
        if (!hit) return;
        const handle: Handle =
          hit.layer.id === "pin-grab"
            ? { role: "pin", fid: String(hit.properties.fid) }
            : { role: hit.layer.id === "handles-mid" ? "mid" : "vertex", i: Number(hit.properties.i) };
        e.preventDefault();
        let phase: DragPhase = "start";
        const move = (ev: MapMouseEvent | MapTouchEvent) => {
          dragged.current = true;
          latest.current.onDrag?.(handle, [ev.lngLat.lng, ev.lngLat.lat], phase);
          phase = "move";
        };
        const end = (ev: MapMouseEvent | MapTouchEvent) => {
          m.off("mousemove", move);
          m.off("touchmove", move);
          if (phase === "move") latest.current.onDrag?.(handle, [ev.lngLat.lng, ev.lngLat.lat], "end");
          // A click that follows the release belongs to the drag; any later one is a real tap.
          setTimeout(() => {
            dragged.current = false;
          }, 0);
        };
        m.on("mousemove", move);
        m.on("touchmove", move);
        m.once("mouseup", end);
        m.once("touchend", end);
      };
      m.on("mousedown", begin);
      m.on("touchstart", begin);
    });

    return () => {
      cancelled = true;
      loaded.current = false;
      mapRef.current = null;
      map?.remove();
    };
    // The map is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && loaded.current) sync(mapRef.current, latest.current);
  }, [imagery, fix, rendered]);

  useEffect(() => {
    mapRef.current?.setPadding({ top: 0, right: 0, left: inset.left, bottom: inset.bottom });
  }, [inset.left, inset.bottom]);

  useEffect(() => {
    latest.current.onImageryFailing?.(false);
    const timer = setTimeout(() => {
      const map = mapRef.current;
      let delivering = false;
      try {
        delivering = !!map?.isSourceLoaded(imagery);
      } catch {
        // The style is still loading; that counts as not delivering.
      }
      if (!delivering) latest.current.onImageryFailing?.(true);
    }, SOURCE_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [imagery]);

  // MapLibre's stylesheet sets `position: relative` on the container, unlayered, which beats any
  // Tailwind utility; the wrapper does the positioning instead.
  return (
    <div className={`absolute inset-0 ${drawing ? "[&_canvas]:cursor-crosshair!" : ""}`}>
      <div ref={container} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function sync(map: MapLibreMap, { imagery, fix, rendered }: Props) {
  for (const i of AVAILABLE_IMAGERY) {
    map.setLayoutProperty(imageryLayer(i.id), "visibility", i.id === imagery ? "visible" : "none");
  }
  (map.getSource(ME_SOURCE) as unknown as Setter | undefined)?.setData(meFeatures(fix));
  for (const source of DRAWING_SOURCES) {
    (map.getSource(source) as unknown as Setter | undefined)?.setData(rendered[source]);
  }
}
