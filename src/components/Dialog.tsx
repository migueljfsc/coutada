/**
 * A modal on the native `<dialog>`: focus is trapped and Escape closes it, by the browser. A sheet
 * from the bottom on phones, a centred card from the `md` breakpoint.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../i18n/context";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={[
        "m-0 mt-auto w-full max-w-none rounded-t-[16px] bg-cal p-0 text-xisto shadow-float backdrop:bg-xisto/45",
        "md:m-auto md:w-[420px] md:rounded-[16px]",
      ].join(" ")}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-xl leading-tight font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("edit.close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-cal-deep"
          >
            <X size={22} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>
  );
}
