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

const INK = "#23281f";

/** A silhouette of the game or the dog, as the map draws it. */
export function SpeciesGlyph({ subject, size }: { subject: Species | "dog"; size: number }) {
  return <img alt="" width={size} height={size} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(speciesSvg(subject, INK, size))}`} />;
}

/** A type's badge as the map draws it: its colour, a schist ring, its glyph or a porta's number. */
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
  const fill = PALETTE[colour ?? DEFAULT_COLOR[type]];
  if (species) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full border-[3px] border-xisto"
        style={{ width: size, height: size, background: fill }}
      >
        <SpeciesGlyph subject={species} size={Math.round(size * 0.68)} />
      </span>
    );
  }
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
