import type { ReactNode } from "react";

/** A notice pinned to the top of the map: what happened, and what to do about it. */
export function Notice({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div
      role="alert"
      className="absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)] left-1/2 md:top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex w-[min(calc(100%-1.5rem),28rem)] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-cal py-2 pr-2 pl-4 shadow-float md:left-[calc(50%+188px)]"
    >
      <p className="min-w-[12rem] flex-1 text-[15px] leading-snug">{children}</p>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
