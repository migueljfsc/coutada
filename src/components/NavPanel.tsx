/**
 * The sheet while navigating: an arrow to turn by, the distance, how sure the position is, and
 * the warnings that matter — off the route, arrived.
 */

import { Navigation2 as NavigationIcon, X } from "lucide-react";
import type { MapFeature } from "../doc/types";
import { useI18n } from "../i18n/context";
import { formatLength } from "../lib/format";
import type { Fix } from "../map/me";
import type { LocationStatus } from "../map/useLocation";
import type { Navigation } from "../nav/useNavigation";
import { useFeatureTitle } from "./editor/useFeatureTitle";

export function NavPanel({
  navigation,
  feature,
  fix,
  status,
  onStop,
}: {
  navigation: Navigation;
  feature: MapFeature;
  fix: Fix | null;
  status: LocationStatus;
  onStop: () => void;
}) {
  const { t, locale } = useI18n();
  const title = useFeatureTitle();
  const g = navigation.guidance;
  // With a heading the arrow is the turn to make; without, it points on the north-up map.
  const angle = g ? (g.turn ?? g.bearing) : 0;

  return (
    <div className="flex items-center gap-4">
      <div
        aria-hidden
        className={`flex size-16 shrink-0 items-center justify-center rounded-full ${g?.arrived ? "bg-[#2f7d32]" : navigation.off ? "bg-[#a32a1d]" : "bg-azinho"} text-white`}
      >
        {g && !g.arrived ? (
          <NavigationIcon size={34} fill="currentColor" style={{ transform: `rotate(${angle}deg)` }} />
        ) : (
          <NavigationIcon size={30} className="opacity-60" />
        )}
      </div>
      <div className="min-w-0 flex-1" role="status" aria-live="polite">
        <p className="line-clamp-2 text-[15px] leading-snug text-xisto-soft">
          {navigation.target.kind === "route" ? t("nav.following", { name: title(feature) }) : t("nav.goingTo", { name: title(feature) })}
        </p>
        <p className="text-[26px] leading-tight font-extrabold tabular-nums">
          {!fix || !g
            ? status === "denied"
              ? t("locate.denied")
              : t("locate.asking")
            : g.arrived
              ? t("nav.arrived")
              : formatLength(g.distance, locale)}
        </p>
        {g && navigation.off && "cross" in g && (
          <p className="text-[15px] font-semibold text-[#a32a1d]">{t("nav.offRoute", { m: Math.round(Math.abs(g.cross)) })}</p>
        )}
        {g && !navigation.off && fix && (
          <p className="text-[14px] text-xisto-soft">
            {g.turn === null ? t("nav.noCompass") : t("nav.accuracy", { m: Math.round(fix.accuracy) })}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onStop}
        aria-label={t("nav.stop")}
        title={t("nav.stop")}
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-cal-deep active:bg-rule"
      >
        <X size={22} />
      </button>
    </div>
  );
}
