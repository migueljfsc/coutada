/**
 * Everything this account or phone holds, as a zip (D27, pb-D120): each map as GeoJSON, which
 * opens in Coutada again and in any GIS software, and the account's own details. Built in the
 * browser from the maps' own endpoints, a map at a time; there is no export route.
 */

import { toGeoJson } from "../io/geojson";
import type { MapDoc } from "../doc/types";
import { api, type Me, type MapSummary } from "./api";
import { zip, type ZipEntry } from "./zip";

type Held = { name: string; doc: MapDoc; updatedAt: number };

/** A file name a file system takes: no separators or reserved characters, unique in the folder. */
function fileNames(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((raw) => {
    const base = raw.replace(/[\\/:*?"<>|\p{Cc}]+/gu, "-").trim() || "map";
    const n = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** The archive's files: `coutada/account.json` and `coutada/maps/<name>.geojson`. Pure. */
export function dataEntries(me: Me, maps: Held[], now: number): ZipEntry[] {
  const encode = (s: string) => new TextEncoder().encode(s);
  const account = {
    exportedAt: new Date(now * 1000).toISOString(),
    ...(me.user ? { account: { email: me.user.email, displayName: me.user.displayName } } : {}),
    ...(me.device ? { phone: { name: me.device.username } } : {}),
    maps: maps.length,
  };
  const names = fileNames(maps.map((m) => m.name));
  return [
    { path: "coutada/account.json", data: encode(`${JSON.stringify(account, null, 2)}\n`), modified: now },
    ...maps.map((m, i) => ({ path: `coutada/maps/${names[i]}.geojson`, data: encode(toGeoJson(m.doc)), modified: m.updatedAt })),
  ];
}

/** The zip, or null when the maps could not all be read. */
export async function myData(me: Me): Promise<Blob | null> {
  const list = await api<{ maps: MapSummary[] }>("GET", "/api/maps");
  if (!list.ok) return null;
  const held: Held[] = [];
  for (const summary of list.data.maps) {
    const r = await api<{ map: { doc: MapDoc } }>("GET", `/api/maps/${summary.id}`);
    if (!r.ok) return null;
    held.push({ name: summary.name, doc: r.data.map.doc, updatedAt: summary.updated_at });
  }
  return zip(dataEntries(me, held, Math.floor(Date.now() / 1000)));
}
