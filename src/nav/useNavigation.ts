/** What is being navigated to, and the guidance for the latest fix (architecture §8). */

import { useCallback, useMemo, useState } from "react";
import type { FeatureId, MapDoc } from "../doc/types";
import { featureById } from "../doc/operations";
import type { Position } from "../geo/geo";
import type { Fix } from "../map/me";
import { alongRoute, offRoute, startFrom, toPoint, type Guidance, type RouteGuidance } from "./nav";

export type Target = { kind: "pin"; id: FeatureId } | { kind: "route"; id: FeatureId; reversed: boolean };

export type Navigation = {
  target: Target;
  guidance: (Guidance & { route?: undefined }) | (RouteGuidance & { route: true }) | null;
  /** Off the route for long enough to be told. */
  off: boolean;
  /** From the person to what they aim at, for the map. */
  guide: Position[] | null;
};

export function useNavigation(doc: MapDoc | null, fix: Fix | null) {
  const [target, setTarget] = useState<Target | null>(null);
  const [away, setAway] = useState<{ since: number | null; off: boolean }>({ since: null, off: false });
  const [lastFix, setLastFix] = useState<Fix | null>(null);

  const feature = doc && target ? featureById(doc, target.id) : undefined;

  const guidance = useMemo(() => {
    if (!fix || !feature) return null;
    if (target?.kind === "pin" && feature.geometry.type === "Point") {
      return toPoint(fix.at, fix.accuracy, fix.heading, feature.geometry.coordinates);
    }
    if (target?.kind === "route" && feature.geometry.type === "LineString") {
      const line = target.reversed ? [...feature.geometry.coordinates].reverse() : feature.geometry.coordinates;
      return { ...alongRoute(fix.at, fix.accuracy, fix.heading, line), route: true as const };
    }
    return null;
  }, [fix, feature, target]);

  // Off route is judged per fix, with time; a new fix is the only thing that advances it.
  if (fix !== lastFix) {
    setLastFix(fix);
    const isAway = !!guidance && "away" in guidance && guidance.away;
    setAway(offRoute(away.since, isAway, fix?.time ?? 0));
  }

  const start = useCallback(
    (id: FeatureId) => {
      const f = doc ? featureById(doc, id) : undefined;
      if (!f) return;
      setAway({ since: null, off: false });
      if (f.geometry.type === "LineString") {
        const reversed = fix ? startFrom(fix.at, f.geometry.coordinates) === "end" : false;
        setTarget({ kind: "route", id, reversed });
      } else {
        setTarget({ kind: "pin", id });
      }
    },
    [doc, fix],
  );

  const stop = useCallback(() => setTarget(null), []);

  const aim: Position | null =
    fix && guidance && feature
      ? target?.kind === "pin" && feature.geometry.type === "Point"
        ? feature.geometry.coordinates
        : null
      : null;

  const navigation: Navigation | null =
    target && feature
      ? {
          target,
          guidance: guidance as Navigation["guidance"],
          off: away.off,
          guide: fix && aim ? [fix.at, aim] : null,
        }
      : null;

  return { navigation, start, stop };
}
