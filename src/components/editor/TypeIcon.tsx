import type { ComponentType } from "react";
import {
  Ban,
  Car,
  Droplet,
  Fence,
  Flag,
  GitCommitHorizontal,
  Spline,
  SquareDashed,
  Trees,
  TriangleAlert,
  Users,
  type LucideProps,
} from "lucide-react";
import { DEFAULT_COLOR, PALETTE, type PaletteKey, type PinType, type RouteType, type ZoneType } from "../../doc/catalogue";

export type FeatureType = PinType | RouteType | ZoneType;

const ICONS: Record<Exclude<FeatureType, "porta">, ComponentType<LucideProps>> = {
  landmark: Flag,
  gate: Fence,
  parking: Car,
  meeting: Users,
  danger: TriangleAlert,
  water: Droplet,
  walk: Spline,
  armada: GitCommitHorizontal,
  mancha: Trees,
  no_shoot: Ban,
  boundary: SquareDashed,
};

/** A type's badge as the map draws it: its colour, a schist ring, its glyph or a porta's number. */
export function TypeIcon({ type, colour, n, size = 36 }: { type: FeatureType; colour?: PaletteKey; n?: number; size?: number }) {
  const fill = PALETTE[colour ?? DEFAULT_COLOR[type]];
  const Icon = type === "porta" ? null : ICONS[type];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border-[3px] border-xisto text-xisto"
      style={{ width: size, height: size, background: fill }}
    >
      {Icon ? (
        <Icon size={size * 0.5} strokeWidth={2.4} />
      ) : (
        <span className="text-[15px] leading-none font-extrabold tabular-nums">{n ?? "P"}</span>
      )}
    </span>
  );
}
