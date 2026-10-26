/** Small per-browser preferences: the imagery last chosen and where the map was last left. */

import { IMAGERY_IDS, type ImageryId } from "../doc/catalogue";
import type { View } from "../map/MapView";
import { browserStore, keyFor, read, write } from "./storage";

const IMAGERY_KEY = keyFor("imagery");
const VIEW_KEY = keyFor("view");

/** Mainland Portugal, whole. */
export const PORTUGAL: View = { center: [-8.1, 39.6], zoom: 6 };

const isImagery = (raw: unknown): raw is ImageryId =>
  typeof raw === "string" && (IMAGERY_IDS as readonly string[]).includes(raw);

function parseView(raw: unknown): View | null {
  if (!raw || typeof raw !== "object") return null;
  const { center, zoom } = raw as { center?: unknown; zoom?: unknown };
  if (!Array.isArray(center) || center.length !== 2) return null;
  const [lon, lat] = center as unknown[];
  const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (!finite(lon) || !finite(lat) || !finite(zoom)) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90 || zoom < 0 || zoom > 22) return null;
  return { center: [lon, lat], zoom };
}

export const storedImagery = (store = browserStore()): ImageryId | null =>
  read(store, IMAGERY_KEY, (raw) => (isImagery(raw) ? raw : null));

export const storeImagery = (id: ImageryId, store = browserStore()) => write(store, IMAGERY_KEY, id);

export const storedView = (store = browserStore()): View | null => read(store, VIEW_KEY, parseView);

export const storeView = (view: View, store = browserStore()) => write(store, VIEW_KEY, view);
