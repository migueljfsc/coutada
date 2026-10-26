/**
 * The bottom sheet: a peek strip that drags open, on phones; a fixed panel on the left from the
 * `md` breakpoint. The drag follows the finger and snaps by position and speed.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/context";

type Props = {
  /** Always visible, also when closed. */
  peek: ReactNode;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reports the height the closed sheet covers, in CSS px. */
  onPeekHeight?: (px: number) => void;
};

const FLICK = 0.5; // px per ms

export function Sheet({ peek, children, open, onOpenChange, onPeekHeight }: Props) {
  const { t } = useI18n();
  const sheet = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef({ y: 0, t: 0, from: 0 });

  useEffect(() => {
    const measure = () => {
      const whole = sheet.current?.offsetHeight ?? 0;
      const top = peekRef.current?.offsetHeight ?? 0;
      setTravel(Math.max(0, whole - top));
      onPeekHeight?.(top);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (sheet.current) observer.observe(sheet.current);
    if (peekRef.current) observer.observe(peekRef.current);
    return () => observer.disconnect();
  }, [onPeekHeight]);

  const offset = drag ?? (open ? 0 : travel);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      start.current = { y: e.clientY, t: e.timeStamp, from: open ? 0 : travel };
      setDrag(start.current.from);
    },
    [open, travel],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drag === null) return;
      setDrag(Math.min(travel, Math.max(0, start.current.from + e.clientY - start.current.y)));
    },
    [drag, travel],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (drag === null) return;
      const moved = e.clientY - start.current.y;
      const speed = moved / Math.max(1, e.timeStamp - start.current.t);
      setDrag(null);
      if (Math.abs(moved) < 6) onOpenChange(!open);
      else if (speed > FLICK) onOpenChange(false);
      else if (speed < -FLICK) onOpenChange(true);
      else onOpenChange(drag < travel / 2);
    },
    [drag, open, travel, onOpenChange],
  );

  return (
    <section
      ref={sheet}
      aria-label={t("sheet.label")}
      style={{ "--sheet-offset": `${offset}px` } as React.CSSProperties}
      className={[
        "absolute inset-x-0 bottom-0 z-20 flex max-h-[min(72dvh,560px)] flex-col",
        "rounded-t-[22px] bg-cal shadow-float",
        "translate-y-(--sheet-offset) motion-safe:transition-transform motion-safe:duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        drag !== null ? "transition-none!" : "",
        "md:inset-y-4 md:left-4 md:right-auto md:max-h-none md:w-[360px] md:translate-y-0 md:rounded-[22px]",
      ].join(" ")}
    >
      <div ref={peekRef} className="shrink-0">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("sheet.collapse") : t("sheet.expand")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenChange(!open);
            }
          }}
          className="flex h-6 w-full cursor-grab touch-none items-center justify-center md:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-xisto/25" />
        </button>
        <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] md:pt-5">{peek}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-rule px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </section>
  );
}
