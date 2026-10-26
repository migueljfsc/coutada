/**
 * The locate button's behaviour: start, centre on the first fix, follow while the map is not
 * panned away, re-centre on a tap, stop on a tap when centred. Keeps the screen awake meanwhile.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { distance, type Position } from "../geo/geo";
import { useI18n } from "../i18n/context";
import { useWakeLock } from "../lib/useWakeLock";
import { useLocation } from "./useLocation";

/** Zoom a first fix is shown at, unless the map is already closer. */
const LOCATE_ZOOM = 16;
/** The map counts as centred on you within this many metres. */
const CENTRED_M = 15;

export function useFollow() {
  const { t } = useI18n();
  const map = useRef<MapLibreMap | null>(null);
  const centreNext = useRef(false);
  const [following, setFollowing] = useState(false);
  const { status, fix, start, stop } = useLocation();

  useWakeLock(status === "on");

  const centre = useCallback((at: Position) => {
    const m = map.current;
    if (!m) return;
    m.easeTo({ center: [at[0], at[1]], zoom: Math.max(m.getZoom(), LOCATE_ZOOM), duration: 600 });
    setFollowing(true);
  }, []);

  useEffect(() => {
    if (!fix) return;
    if (centreNext.current) {
      centreNext.current = false;
      centre(fix.at);
    } else if (following && map.current) {
      const c = map.current.getCenter();
      if (distance([c.lng, c.lat], fix.at) > CENTRED_M) map.current.easeTo({ center: [fix.at[0], fix.at[1]], duration: 400 });
    }
  }, [fix, following, centre]);

  const onLocate = () => {
    if (status !== "on" && status !== "asking") {
      centreNext.current = true;
      void start();
    } else if (fix && !following) {
      centre(fix.at);
    } else {
      setFollowing(false);
      stop();
    }
  };

  /** Turns the position on, if it is not, and centres on the first fix. */
  const ensure = useCallback(() => {
    if (status === "on" || status === "asking") return;
    centreNext.current = true;
    void start();
  }, [status, start]);

  const attach = useCallback((m: MapLibreMap) => {
    map.current = m;
    m.on("dragstart", () => setFollowing(false));
  }, []);

  const label = status === "on" ? (following ? t("locate.stop") : t("locate.recenter")) : t("locate.start");

  return { map, status, fix, following, onLocate, ensure, attach, label };
}
