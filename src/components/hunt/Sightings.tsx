/**
 * Sightings in the sheet (D11): what was seen and what happened, placing it, and the one chosen
 * on the map — who marked it and when, removing it, and for the host, keeping it as a pin.
 */

import { Bookmark, LocateFixed, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n/context";
import { formatAgo, formatMoment, formatTime } from "../../lib/format";
import { EVENTS, SUBJECTS, type Observation, type SightingEvent, type Subject } from "../../live/protocol";
import { SpeciesGlyph } from "../editor/TypeIcon";
import { secondaryButton, primaryButton } from "../ui";

const EVENT_MARK: Record<SightingEvent, string | null> = { seen: null, flushed: "bg-anil", down: "bg-[#c23a2b]" };

/** The diamond the map draws, for the sheet: the subject, and a corner mark for what happened. */
export function SightingIcon({ subject, event, size = 36 }: { subject: Subject; event: SightingEvent; size?: number }) {
  const mark = EVENT_MARK[event];
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute inset-[15%] rotate-45 rounded-[3px] border-[2.5px] border-xisto bg-white" />
      <span className="relative">
        <SpeciesGlyph subject={subject} size={Math.round(size * 0.56)} />
      </span>
      {mark && <span className={`absolute top-0 right-0 size-[30%] rounded-full border-2 border-white ${mark}`} />}
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

export function SightingPicker({
  event,
  onEvent,
  onPick,
  onCancel,
}: {
  event: SightingEvent;
  onEvent: (event: SightingEvent) => void;
  onPick: (subject: Subject) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl leading-tight font-bold">{t("obs.pick")}</h2>
        <CloseButton label={t("draw.cancel")} onClick={onCancel} />
      </div>
      <div role="radiogroup" className="mt-3 grid grid-cols-3 rounded-xl bg-cal-deep p-1">
        {EVENTS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={e === event}
            onClick={() => onEvent(e)}
            className="min-h-11 rounded-lg px-2 text-[15px] font-semibold text-xisto-soft aria-checked:bg-cal aria-checked:text-xisto aria-checked:shadow-sm"
          >
            {t(`obs.event.${e}`)}
          </button>
        ))}
      </div>
      <div className="mt-2 grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto md:max-h-none">
        {SUBJECTS.map((subject) => (
          <button
            key={subject}
            type="button"
            onClick={() => onPick(subject)}
            className="flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] bg-cal-deep px-3 py-2 text-left text-[15px] leading-tight font-semibold active:bg-anil active:text-white"
          >
            <SightingIcon subject={subject} event={event} size={34} />
            <span className="line-clamp-2 min-w-0 hyphens-auto [overflow-wrap:anywhere]">{t(`species.${subject}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SightingPlaceBar({
  subject,
  event,
  onHere,
  onCancel,
}: {
  subject: Subject;
  event: SightingEvent;
  onHere: (() => void) | null;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-3">
        <SightingIcon subject={subject} event={event} />
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-bold">{t(`species.${subject}`)}</h2>
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

/** `now` is on the hunt's clock, as `obs.at` is. */
export function SightingHeader({ obs, by, now, onClose }: { obs: Observation; by: string; now: number; onClose: () => void }) {
  const { t, locale } = useI18n();
  const time = now - obs.at < 12 * 3_600_000 ? formatTime(obs.at, locale) : formatMoment(obs.at, locale);
  return (
    <div className="flex items-center gap-3">
      <SightingIcon subject={obs.subject} event={obs.event} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="flex items-baseline gap-2 text-xl leading-tight font-bold">
          <span className="truncate">{t(`species.${obs.subject}`)}</span>
          <span className="shrink-0 text-[14px] font-semibold text-xisto-soft">{t(`obs.event.${obs.event}`)}</span>
        </h2>
        <p className="text-[15px] text-xisto-soft">{t("obs.marked", { name: by, time, ago: formatAgo(obs.at, now, locale) })}</p>
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
