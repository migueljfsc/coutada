/**
 * The map being worked on, kept in this browser: its document, the server map it belongs to
 * (if any) and whether it has changes the server has not seen. Read back through the same loader
 * as any document, so a damaged draft is discarded, not repaired.
 */

import { loadMapDoc } from "../doc/migrate";
import type { MapDoc } from "../doc/types";
import { browserStore, keyFor, read, remove, write } from "./storage";

const DRAFT_KEY = keyFor("draft");

export type Remote = { id: string; version: number };
export type Draft = { doc: MapDoc; remote: Remote | null; dirty: boolean };

function parseRemote(raw: unknown): Remote | null {
  if (!raw || typeof raw !== "object") return null;
  const { id, version } = raw as { id?: unknown; version?: unknown };
  return typeof id === "string" && /^[A-Za-z0-9_-]{22}$/.test(id) && typeof version === "number" && Number.isInteger(version)
    ? { id, version }
    : null;
}

function parseDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  // A draft saved before maps lived on the server is the document itself.
  if ((raw as { type?: unknown }).type === "FeatureCollection") {
    const loaded = loadMapDoc(raw);
    return loaded.ok ? { doc: loaded.doc, remote: null, dirty: true } : null;
  }
  const { doc, remote, dirty } = raw as { doc?: unknown; remote?: unknown; dirty?: unknown };
  const loaded = loadMapDoc(doc);
  if (!loaded.ok) return null;
  return { doc: loaded.doc, remote: parseRemote(remote), dirty: dirty === true };
}

export const storedDraft = (store = browserStore()): Draft | null => read(store, DRAFT_KEY, parseDraft);

export const storeDraft = (draft: Draft, store = browserStore()): boolean => write(store, DRAFT_KEY, draft);

export const clearDraft = (store = browserStore()): void => remove(store, DRAFT_KEY);
