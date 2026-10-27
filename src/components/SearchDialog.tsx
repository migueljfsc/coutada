/**
 * Finding a spot on the map (D28): coordinates as typed or pasted, this map's drawings by name,
 * and places in Portugal and Spain from OpenStreetMap. Coordinates and drawings answer as you
 * type and need no signal; places are searched when the person asks, as Nominatim's policy wants.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Crosshair, MapPin, Search } from "lucide-react";
import type { FeatureId, MapDoc } from "../doc/types";
import { parseCoordinates } from "../geo/coords";
import type { Position } from "../geo/geo";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";
import { api } from "../share/api";
import { Dialog } from "./Dialog";
import { TypeIcon } from "./editor/TypeIcon";
import { useFeatureTitle } from "./editor/useFeatureTitle";
import { field } from "./ui";

export type Place = { name: string; kind: string; area: string; at: [number, number]; bbox: [number, number, number, number] | null };

export type SearchHit = { kind: "coords"; at: Position } | { kind: "feature"; id: FeatureId } | { kind: "place"; place: Place };

/** The kinds of place with a name of their own in the dictionaries; others show only where they are. */
const KINDS = ["village", "hamlet", "town", "city", "municipality", "farm", "isolated_dwelling", "house", "locality", "peak", "road", "water", "river", "suburb"] as const;

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

const row = "flex min-h-12 w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left active:bg-cal-deep";

export function SearchDialog({ doc, onGo, onClose }: { doc: MapDoc | null; onGo: (hit: SearchHit) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const title = useFeatureTitle();
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "failed" | "offline">("idle");
  const input = useRef<HTMLInputElement>(null);

  // The dialog gives focus to its first control, the close button; the search box is what is wanted.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const coords = useMemo(() => parseCoordinates(query), [query]);
  const matches = useMemo(() => {
    const q = plain(query.trim());
    if (!q || !doc) return [];
    return doc.features.filter((f) => plain(title(f)).includes(q)).slice(0, 6);
  }, [query, doc, title]);

  const go = (hit: SearchHit) => {
    onClose();
    onGo(hit);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (coords) return go({ kind: "coords", at: coords });
    setStatus("busy");
    setAsked(q);
    const r = await api<{ places: Place[] }>("GET", `/api/places?q=${encodeURIComponent(q)}&lang=${locale}`);
    if (r.ok) {
      setPlaces(r.data.places);
      setStatus("idle");
    } else {
      setPlaces(null);
      setStatus(r.status === 0 ? "offline" : "failed");
    }
  };

  const kindOf = (kind: string) => ((KINDS as readonly string[]).includes(kind) ? t(`place.${kind}` as MessageKey) : null);

  return (
    <Dialog title={t("search.title")} onClose={onClose}>
      <form onSubmit={search} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t("search.title")}</span>
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xisto-soft" aria-hidden />
            <input
              ref={input}
              type="search"
              enterKeyHint="search"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.placeholder")}
              className={`${field} pl-10`}
            />
          </label>
          <button
            type="submit"
            disabled={!query.trim() || status === "busy"}
            className="min-h-12 shrink-0 rounded-[10px] bg-azinho px-4 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {t("search.submit")}
          </button>
        </div>

        {coords && (
          <button type="button" onClick={() => go({ kind: "coords", at: coords })} className={row}>
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
                  <button type="button" onClick={() => go({ kind: "feature", id: f.id })} className={row}>
                    <TypeIcon type={f.properties.type} colour={f.properties.color} n={f.properties.kind === "pin" ? f.properties.n : undefined} species={f.properties.kind === "pin" ? f.properties.species : undefined} size={30} />
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
        {status === "failed" && <p role="alert" className="text-[15px] text-[#a32a1d]">{t("search.failed")}</p>}
        {status === "offline" && <p role="alert" className="text-[15px] text-[#a32a1d]">{t("search.offline")}</p>}

        {places && status === "idle" && (
          <section className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold">{t("search.places")}</h3>
            {places.length === 0 ? (
              <p className="text-[15px] text-xisto-soft">{t("search.none", { query: asked ?? "" })}</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {places.map((p, i) => {
                  const kind = kindOf(p.kind);
                  const where = [kind, p.area].filter(Boolean).join(", ");
                  return (
                    <li key={`${p.name}-${i}`}>
                      <button type="button" onClick={() => go({ kind: "place", place: p })} className={row}>
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

        {!coords && matches.length === 0 && !places && status === "idle" && <p className="text-[14px] leading-snug text-xisto-soft">{t("search.hint")}</p>}
      </form>
    </Dialog>
  );
}
