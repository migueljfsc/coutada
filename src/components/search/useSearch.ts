/**
 * Finding a spot on the map (D28): coordinates as typed or pasted, this map's drawings by name,
 * and places in Portugal and Spain from OpenStreetMap. Coordinates and drawings answer as the
 * person types and need no signal; places are searched when they ask, as Nominatim's policy wants.
 */

import { useMemo, useState } from "react";
import type { FeatureId, MapDoc } from "../../doc/types";
import { parseCoordinates } from "../../geo/coords";
import type { Position } from "../../geo/geo";
import { useI18n } from "../../i18n/context";
import { api } from "../../share/api";
import { useFeatureTitle } from "../editor/useFeatureTitle";

export type Place = { name: string; kind: string; area: string; at: [number, number]; bbox: [number, number, number, number] | null };

export type SearchHit = { kind: "coords"; at: Position } | { kind: "feature"; id: FeatureId } | { kind: "place"; place: Place };

export type SearchStatus = "idle" | "busy" | "failed" | "offline";

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export function useSearch(doc: MapDoc | null) {
  const { locale } = useI18n();
  const title = useFeatureTitle();
  const [query, setQueryState] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");

  const coords = useMemo(() => parseCoordinates(query), [query]);
  const matches = useMemo(() => {
    const q = plain(query.trim());
    if (!q || !doc) return [];
    return doc.features.filter((f) => plain(title(f)).includes(q)).slice(0, 6);
  }, [query, doc, title]);

  /** A changed query drops the places found for the last one. */
  const setQuery = (next: string) => {
    setQueryState(next);
    if (next.trim() !== asked) {
      setPlaces(null);
      setStatus("idle");
    }
  };

  const clear = () => {
    setQueryState("");
    setAsked(null);
    setPlaces(null);
    setStatus("idle");
  };

  /** Searches places for what is typed; coordinates need no search and come back as the hit to go to. */
  const submit = async (): Promise<SearchHit | null> => {
    const q = query.trim();
    if (!q) return null;
    if (coords) return { kind: "coords", at: coords };
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
    return null;
  };

  return { query, setQuery, clear, submit, coords, matches, places, asked, status, active: query.trim().length > 0 };
}

export type Search = ReturnType<typeof useSearch>;
