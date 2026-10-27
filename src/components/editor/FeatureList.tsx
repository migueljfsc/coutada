import type { FeatureId, MapDoc, MapFeature } from "../../doc/types";
import { useI18n } from "../../i18n/context";
import { TypeIcon } from "./TypeIcon";
import { useFeatureTitle } from "./useFeatureTitle";

const KIND_ORDER = { pin: 0, route: 1, zone: 2 } as const;

/** Places first (portas by number), then routes, then areas. */
function order(a: MapFeature, b: MapFeature): number {
  const k = KIND_ORDER[a.properties.kind] - KIND_ORDER[b.properties.kind];
  if (k !== 0) return k;
  const pa = a.properties.kind === "pin" ? (a.properties.n ?? Infinity) : Infinity;
  const pb = b.properties.kind === "pin" ? (b.properties.n ?? Infinity) : Infinity;
  if (pa !== pb) return pa - pb;
  return a.properties.type.localeCompare(b.properties.type);
}

/** Everything on the map, to find a feature and fly to it. */
export function FeatureList({ doc, onChoose }: { doc: MapDoc; onChoose: (id: FeatureId) => void }) {
  const { t } = useI18n();
  const title = useFeatureTitle();
  if (doc.features.length === 0) return <p className="text-[15px] text-xisto-soft">{t("list.empty")}</p>;
  return (
    <ul className="-mx-2 flex flex-col">
      {[...doc.features].sort(order).map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onChoose(f.id)}
            className="flex min-h-12 w-full items-center gap-3 rounded-[12px] px-2 py-1.5 text-left active:bg-cal-deep"
          >
            <TypeIcon
              type={f.properties.type}
              colour={f.properties.color}
              n={f.properties.kind === "pin" ? f.properties.n : undefined}
              species={f.properties.kind === "pin" ? f.properties.species : undefined}
              size={30}
            />
            <span className="truncate text-[16px] font-semibold">{title(f)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
