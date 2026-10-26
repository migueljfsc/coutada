/**
 * Downloading a pack (D19): the planned tiles fetched from the source, four at a time, retried
 * with backoff, written into the pack cache under their tile keys. What is already there is not
 * fetched again, so a cancelled or failed download resumes where it stopped.
 */

import type { Imagery } from "../map/imagery";
import { PACK_CACHE } from "./caches";
import type { PackPlan } from "./plan";
import { tileKey, tileUrl, type Tile } from "./tiles";

const IN_FLIGHT = 4;
const RETRIES = 3;

export type Progress = { done: number; failed: number; total: number; bytes: number };

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

async function fetchTile(url: string, signal: AbortSignal): Promise<Response | null> {
  for (let attempt = 0; attempt <= RETRIES && !signal.aborted; attempt++) {
    try {
      const response = await fetch(url, { signal, mode: "cors" });
      if (response.ok) return response;
    } catch {
      // A dropped connection or a timeout; the next attempt waits longer.
    }
    await pause(1000 * 2 ** attempt, signal);
  }
  return null;
}

export async function downloadPack(
  plan: PackPlan,
  imagery: Imagery,
  signal: AbortSignal,
  onProgress: (p: Progress) => void,
): Promise<Progress> {
  const cache = await caches.open(PACK_CACHE);
  const progress: Progress = { done: 0, failed: 0, total: plan.tiles.length, bytes: 0 };
  const queue: Tile[] = [...plan.tiles];

  const worker = async () => {
    for (let tile = queue.shift(); tile && !signal.aborted; tile = queue.shift()) {
      const url = tileUrl(imagery.url, tile);
      const key = tileKey(url);
      if (key && !(await cache.match(key))) {
        const response = await fetchTile(url, signal);
        if (response) {
          const body = await response.blob();
          progress.bytes += body.size;
          await cache.put(key, new Response(body, { headers: response.headers }));
          progress.done++;
        } else if (!signal.aborted) {
          progress.failed++;
        }
      } else {
        progress.done++;
      }
      onProgress({ ...progress });
    }
  };

  await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
  return progress;
}

/** Everything downloaded on purpose, gone. Tiles seen while panning stay in the runtime cache. */
export const clearPacks = (): Promise<boolean> => caches.delete(PACK_CACHE);

/** How many tiles the pack cache holds. */
export const packTileCount = async (): Promise<number> => (await (await caches.open(PACK_CACHE)).keys()).length;
