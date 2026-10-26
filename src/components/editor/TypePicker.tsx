import { X } from "lucide-react";
import { PIN_TYPES, ROUTE_TYPES, ZONE_TYPES } from "../../doc/catalogue";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";
import { TypeIcon, type FeatureType } from "./TypeIcon";

export type Picking = "pin" | "line" | "area";

const TYPES: Record<Picking, readonly FeatureType[]> = { pin: PIN_TYPES, line: ROUTE_TYPES, area: ZONE_TYPES };

/** The choice that follows a rail tool: which kind of place, line or area. */
export function TypePicker({ picking, onPick, onCancel }: { picking: Picking; onPick: (type: FeatureType) => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl leading-tight font-bold">{t(`pick.${picking}`)}</h2>
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
        {TYPES[picking].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex min-h-14 items-center gap-3 rounded-[14px] bg-cal-deep px-3 py-2 text-left text-[15px] leading-tight font-semibold active:bg-anil active:text-white"
          >
            <TypeIcon type={type} size={32} />
            {t(`type.${type}` as MessageKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
