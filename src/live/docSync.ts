/**
 * The host's drawings during a hunt (D12): the host edits a working copy, and what differs from
 * the hunt's document goes to the hunt feature by feature. Pure — documents in, messages or the
 * next working copy out.
 */

import type { FeatureId, MapDoc, MapFeature } from "../doc/types";
import type { ClientMessage } from "./protocol";

export type Edit = Extract<ClientMessage, { t: "feature.put" } | { t: "feature.del" }>;

/** Equal as JSON values, whatever the order of their keys; an undefined key counts as absent. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((v, i) => same(v, other[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = (r: Record<string, unknown>) => Object.keys(r).filter((k) => r[k] !== undefined);
  const ka = keys(ra);
  return ka.length === keys(rb).length && ka.every((k) => same(ra[k], rb[k]));
}

const byId = (doc: MapDoc) => new Map(doc.features.map((f) => [f.id, f]));

/** What the host has changed against the hunt's document, as messages based on revision `base`. */
export function changes(server: MapDoc, local: MapDoc, base: number): Edit[] {
  const held = byId(server);
  const mine = byId(local);
  const out: Edit[] = [];
  for (const f of local.features) {
    const theirs = held.get(f.id);
    if (!theirs || !same(theirs, f)) out.push({ t: "feature.put", f, base });
  }
  for (const f of server.features) {
    if (!mine.has(f.id)) out.push({ t: "feature.del", id: f.id, base });
  }
  return out;
}

/** The features whose version differs between two of the hunt's documents. */
export function moved(before: MapDoc, after: MapDoc): FeatureId[] {
  const a = byId(before);
  const b = byId(after);
  const ids = new Set([...a.keys(), ...b.keys()]);
  return [...ids].filter((id) => a.get(id) !== b.get(id));
}

/**
 * The host's working copy once the hunt's document has moved from `before` to `after`: a feature
 * the host has not touched takes the hunt's version; one the host has changed keeps the host's,
 * unless its id is in `overrule`.
 */
export function rebase(local: MapDoc, before: MapDoc, after: MapDoc, overrule: ReadonlySet<FeatureId> = new Set()): MapDoc {
  const was = byId(before);
  const now = byId(after);
  const take = new Map<FeatureId, MapFeature | null>();
  for (const id of moved(before, after)) {
    const mine = local.features.find((f) => f.id === id);
    const touched = !same(mine, was.get(id));
    if (touched && !overrule.has(id)) continue;
    const theirs = now.get(id) ?? null;
    if (!same(mine, theirs ?? undefined)) take.set(id, theirs);
  }
  if (take.size === 0) return local;
  const features: MapFeature[] = [];
  for (const f of local.features) {
    if (!take.has(f.id)) features.push(f);
    else if (take.get(f.id)) features.push(take.get(f.id)!);
  }
  const present = new Set(features.map((f) => f.id));
  for (const [id, f] of take) if (f && !present.has(id)) features.push(f);
  return { ...local, features };
}
