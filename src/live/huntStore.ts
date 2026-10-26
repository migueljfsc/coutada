/**
 * What a phone keeps about its hunts: the member token for each (to reconnect after a dropped
 * signal or a reload), and its own trail (D13) — on the phone only, until the person saves or
 * discards it at the end (D14).
 */

import { browserStore, keyFor, read, remove, write } from "../share/storage";
import type { TrailPoint } from "./trail";

export type HuntPass = { memberId: string; token: string };

const passKey = (huntId: string) => keyFor(`hunt:${huntId}`);
const trailKey = (huntId: string) => keyFor(`trail:${huntId}`);
const LAST_KEY = keyFor("hunt:last");

const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{22}$/.test(v);

export const storedPass = (huntId: string, store = browserStore()): HuntPass | null =>
  read(store, passKey(huntId), (raw) => {
    const { memberId, token } = (raw ?? {}) as Record<string, unknown>;
    return isId(memberId) && typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? { memberId, token } : null;
  });

export function storePass(huntId: string, pass: HuntPass, store = browserStore()) {
  write(store, passKey(huntId), pass);
  write(store, LAST_KEY, huntId);
}

export function forgetHunt(huntId: string, store = browserStore()) {
  remove(store, passKey(huntId));
  if (lastHunt(store) === huntId) remove(store, LAST_KEY);
}

/** The hunt this phone was last in, to offer going back to it. */
export const lastHunt = (store = browserStore()): string | null => read(store, LAST_KEY, (raw) => (isId(raw) ? raw : null));

export const storedTrail = (huntId: string, store = browserStore()): TrailPoint[] =>
  read(store, trailKey(huntId), (raw) =>
    Array.isArray(raw) && raw.every((p) => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === "number" && Number.isFinite(n)))
      ? (raw as TrailPoint[])
      : null,
  ) ?? [];

export const storeTrail = (huntId: string, trail: TrailPoint[], store = browserStore()) => write(store, trailKey(huntId), trail);

export const forgetTrail = (huntId: string, store = browserStore()) => remove(store, trailKey(huntId));
