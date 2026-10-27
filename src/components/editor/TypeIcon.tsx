import type { ComponentType } from "react";
import {
  Ban,
  Car,
  Droplet,
  Fence,
  Flag,
  GitCommitHorizontal,
  PawPrint,
  Spline,
  SquareDashed,
  Trees,
  TriangleAlert,
  Users,
  type LucideProps,
} from "lucide-react";
import { DEFAULT_COLOR, PALETTE, type PaletteKey, type PinType, type RouteType, type Species, type ZoneType } from "../../doc/catalogue";
import { speciesSvg } from "../../map/species";

export type FeatureType = PinType | RouteType | ZoneType;

const ICONS: Record<Exclude<FeatureType, "porta">, ComponentType<LucideProps>> = {
  landmark: Flag,
  gate: Fence,
  parking: Car,
  meeting: Users,
  danger: TriangleAlert,
  water: Droplet,
  game: PawPrint,
  walk: Spline,
  armada: GitCommitHorizontal,
  mancha: Trees,
  no_shoot: Ban,
  boundary: SquareDashed,
};

const BONE = "#e8e2d4";

/** A silhouette of the game or the dog, in bone, as the map's dark badges draw it. */
export function SpeciesGlyph({ subject, size }: { subject: Species | "dog"; size: number }) {
  return <img alt="" width={size} height={size} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(speciesSvg(subject, BONE, size))}`} />;
}

/** A type's badge as the map draws it: a dark disc edged in bone, a ring in its colour, and its glyph or a porta's number. */
export function TypeIcon({
  type,
  colour,
  n,
  species,
  size = 36,
}: {
  type: FeatureType;
  colour?: PaletteKey;
  n?: number;
  species?: Species;
  size?: number;
}) {
  const ring = PALETTE[colour ?? DEFAULT_COLOR[type]];
  const Icon = type === "porta" ? null : ICONS[type];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-xisto text-osso"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 ${size * 0.08}px ${ring}, 0 0 0 1.5px var(--color-osso)` }}
    >
      {species ? (
        <SpeciesGlyph subject={species} size={Math.round(size * 0.62)} />
      ) : Icon ? (
        <Icon size={size * 0.46} strokeWidth={2} />
      ) : (
        <span className="text-[14px] leading-none font-bold tabular-nums">{n ?? "P"}</span>
      )}
    </span>
  );
}
