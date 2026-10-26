import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { ImageryId } from "../doc/catalogue";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import { AVAILABLE_IMAGERY } from "../map/imagery";

/** The imagery choice, a radio list beside the rail button; Escape or a tap elsewhere closes it. */
export function ImageryPicker({ current, onChoose, onClose }: { current: ImageryId; onChoose: (id: ImageryId) => void; onClose: () => void }) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.parentElement?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    panel.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={panel}
      role="radiogroup"
      aria-label={t("imagery.title")}
      className="absolute right-[calc(100%+0.75rem)] bottom-0 w-64 rounded-[16px] bg-cal p-1.5 shadow-float"
    >
      {AVAILABLE_IMAGERY.map((i) => (
        <button
          key={i.id}
          type="button"
          role="radio"
          aria-checked={i.id === current}
          onClick={() => onChoose(i.id)}
          className="flex w-full items-start gap-3 rounded-[11px] px-3 py-2.5 text-left active:bg-cal-deep aria-checked:bg-anil/10"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-anil">
            {i.id === current && <Check size={18} strokeWidth={3} />}
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{t(`imagery.${i.id}` as MessageKey)}</span>
            <span className="block text-[13px] text-xisto-soft">{t(`imagery.${i.id}.detail` as MessageKey)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
