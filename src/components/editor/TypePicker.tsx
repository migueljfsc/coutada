import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { PIN_TYPES, ROUTE_TYPES, SPECIES, ZONE_TYPES, type Species } from "../../doc/catalogue";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";
import { TypeIcon, type FeatureType } from "./TypeIcon";

export type Picking = "pin" | "line" | "area";

const TYPES: Record<Picking, readonly FeatureType[]> = { pin: PIN_TYPES, line: ROUTE_TYPES, area: ZONE_TYPES };

const choice =
  "flex min-h-14 min-w-0 items-center gap-3 rounded-[10px] bg-cal-deep px-3 py-2 text-left text-[15px] leading-tight font-semibold active:bg-anil active:text-white";

/** The choice that follows a rail tool: which kind of place, line or area, and for game, which species. */
export function TypePicker({
  picking,
  onPick,
  onCancel,
}: {
  picking: Picking;
  onPick: (type: FeatureType, species?: Species) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [game, setGame] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          {game && (
            <button
              type="button"
              onClick={() => setGame(false)}
              aria-label={t("pick.pin")}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full active:bg-cal-deep"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <h2 className="text-xl leading-tight font-bold">{t(game ? "pick.game" : `pick.${picking}`)}</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("draw.cancel")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-cal-deep"
        >
          <X size={22} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {game
          ? SPECIES.map((species) => (
              <button key={species} type="button" onClick={() => onPick("game", species)} className={choice}>
                <TypeIcon type="game" species={species} size={32} />
                <span className="line-clamp-2 min-w-0 hyphens-auto [overflow-wrap:anywhere]">{t(`species.${species}`)}</span>
              </button>
            ))
          : TYPES[picking].map((type) => (
              <button key={type} type="button" onClick={() => (type === "game" ? setGame(true) : onPick(type))} className={choice}>
                <TypeIcon type={type} size={32} />
                <span className="line-clamp-2 min-w-0 hyphens-auto [overflow-wrap:anywhere]">{t(`type.${type}` as MessageKey)}</span>
              </button>
            ))}
      </div>
    </div>
  );
}
