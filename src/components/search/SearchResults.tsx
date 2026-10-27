import { Crosshair, MapPin } from "lucide-react";
import { useI18n } from "../../i18n/context";
import type { MessageKey } from "../../i18n/core";
import { TypeIcon } from "../editor/TypeIcon";
import { useFeatureTitle } from "../editor/useFeatureTitle";
import type { Search, SearchHit } from "./useSearch";

/** The kinds of place with a name of their own in the dictionaries; others show only where they are. */
const KINDS = ["village", "hamlet", "town", "city", "municipality", "farm", "isolated_dwelling", "house", "locality", "peak", "road", "water", "river", "suburb"] as const;

const row = "flex min-h-12 w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left active:bg-cal-deep";

/** What a search found: coordinates, this map's drawings, and places, credited to OpenStreetMap. */
export function SearchResults({ search, onGo }: { search: Search; onGo: (hit: SearchHit) => void }) {
  const { t } = useI18n();
  const title = useFeatureTitle();
  const { coords, matches, places, status, asked } = search;
  const kindOf = (kind: string) => ((KINDS as readonly string[]).includes(kind) ? t(`place.${kind}` as MessageKey) : null);

  return (
    <div className="flex flex-col gap-4">
      {coords && (
        <button type="button" onClick={() => onGo({ kind: "coords", at: coords })} className={row}>
          <Crosshair size={22} className="shrink-0 text-azinho-ink" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold">{t("search.goToCoords")}</span>
            <span className="block text-[14px] text-xisto-soft tabular-nums">
              {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
            </span>
          </span>
        </button>
      )}

      {matches.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold">{t("maps.drawn")}</h3>
          <ul className="-mx-2 flex flex-col">
            {matches.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => onGo({ kind: "feature", id: f.id })} className={row}>
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
        </section>
      )}

      {status === "busy" && (
        <p role="status" className="text-[15px] text-xisto-soft">
          {t("search.searching")}
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="text-[15px] text-[#a32a1d]">
          {t("search.failed")}
        </p>
      )}
      {status === "offline" && (
        <p role="alert" className="text-[15px] text-[#a32a1d]">
          {t("search.offline")}
        </p>
      )}

      {places && status === "idle" && (
        <section className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold">{t("search.places")}</h3>
          {places.length === 0 ? (
            <p className="text-[15px] text-xisto-soft">{t("search.none", { query: asked ?? "" })}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {places.map((p, i) => {
                const where = [kindOf(p.kind), p.area].filter(Boolean).join(", ");
                return (
                  <li key={`${p.name}-${i}`}>
                    <button type="button" onClick={() => onGo({ kind: "place", place: p })} className={row}>
                      <MapPin size={22} className="shrink-0 text-xisto-soft" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                        {where && <span className="block truncate text-[14px] text-xisto-soft">{where}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-1 text-[12px] text-xisto-soft">{t("search.credit")}</p>
        </section>
      )}

      {!coords && matches.length === 0 && !places && status === "idle" && (
        <p className="text-[14px] leading-snug text-xisto-soft">{search.active ? t("search.pressSearch") : t("search.hint")}</p>
      )}
    </div>
  );
}
