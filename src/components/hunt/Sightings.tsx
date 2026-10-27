/**
 * Observations in the sheet (D11): choosing what was seen, placing it, and the one chosen on the
 * map — who marked it and when, removing it, and for the host, keeping it as a pin.
 */

import { Bookmark, LocateFixed, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n/context";
import { OBSERVATION_GLYPHS } from "../../map/images";
import { OBSERVATION_TYPES, type Observation, type ObservationType } from "../../live/protocol";
import { secondaryButton, primaryButton } from "../ui";

/** The diamond the map draws, for the sheet. */
export function SightingIcon({ type, size = 36 }: { type: ObservationType; size?: number }) {
  const Glyph = OBSERVATION_GLYPHS[type];
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-[15%] rotate-45 rounded-[3px] border-[2.5px] border-xisto bg-white" />
      <Glyph size={size * 0.44} strokeWidth={2.4} className="relative text-xisto" />
    </span>
  );
}

function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-cal-deep">
      <X size={22} />
    </button>
  );
}

export function SightingPicker({ onPick, onCancel }: { onPick: (type: ObservationType) => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl leading-tight font-bold">{t("obs.pick")}</h2>
        <CloseButton label={t("draw.cancel")} onClick={onCancel} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OBSERVATION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex min-h-14 items-center gap-3 rounded-[14px] bg-cal-deep px-3 py-2 text-left text-[15px] leading-tight font-semibold active:bg-anil active:text-white"
          >
            <SightingIcon type={type} size={32} />
            {t(`obs.type.${type}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SightingPlaceBar({ type, onHere, onCancel }: { type: ObservationType; onHere: (() => void) | null; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-3">
        <SightingIcon type={type} />
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-bold">{t(`obs.type.${type}`)}</h2>
          <p className="text-[15px] text-xisto-soft" role="status">
            {t("obs.place")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-12 flex-1 rounded-[14px] bg-cal-deep px-3 text-[15px] font-semibold active:bg-rule">
          {t("draw.cancel")}
        </button>
        {onHere && (
          <button
            type="button"
            onClick={onHere}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-anil px-3 text-[15px] font-semibold text-white"
          >
            <LocateFixed size={18} />
            {t("obs.here")}
          </button>
        )}
      </div>
    </div>
  );
}

export function SightingHeader({ obs, by, ageMs, onClose }: { obs: Observation; by: string; ageMs: number; onClose: () => void }) {
  const { t } = useI18n();
  const m = Math.floor(ageMs / 60_000);
  return (
    <div className="flex items-center gap-3">
      <SightingIcon type={obs.type} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl leading-tight font-bold">{t(`obs.type.${obs.type}`)}</h2>
        <p className="text-[15px] text-xisto-soft">{m < 1 ? t("obs.markedNow", { name: by }) : t("obs.marked", { name: by, m })}</p>
      </div>
      <CloseButton label={t("edit.close")} onClick={onClose} />
    </div>
  );
}

export function SightingActions({ onRemove, onKeep }: { onRemove: (() => void) | null; onKeep: (() => void) | null }) {
  const { t } = useI18n();
  if (!onRemove && !onKeep) return null;
  return (
    <div className="flex flex-col gap-2">
      {onKeep && (
        <button type="button" onClick={onKeep} className={primaryButton}>
          <Bookmark size={18} />
          {t("obs.keep")}
        </button>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className={`${secondaryButton} text-[#a32a1d]`}>
          <Trash2 size={18} />
          {t("obs.remove")}
        </button>
      )}
    </div>
  );
}
