import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  /** Drawn filled: on, or selected. */
  active?: boolean;
  /** Blaze orange when active, for anything that is about a person. */
  tone?: "azinho" | "person";
  children: ReactNode;
};

/** A square map control: 48 px, cal, with a label for screen readers and a tooltip. */
export function RailButton({ label, active = false, tone = "azinho", className = "", children, ...rest }: Props) {
  const on = tone === "person" ? "bg-person text-white" : "bg-azinho text-white";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[
        "flex size-12 items-center justify-center rounded-[10px] shadow-float",
        "active:scale-95 motion-safe:transition-transform",
        active ? on : "bg-cal text-xisto active:bg-cal-deep",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
