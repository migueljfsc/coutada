/**
 * The map being drawn, kept in this browser until accounts and devices save it on the server.
 * Read back through the same loader as any document, so a damaged draft is discarded, not repaired.
 */

import { loadMapDoc } from "../doc/migrate";
import type { MapDoc } from "../doc/types";
import { browserStore, keyFor, read, write } from "./storage";

const DRAFT_KEY = keyFor("draft");

export const storedDraft = (store = browserStore()): MapDoc | null =>
  read(store, DRAFT_KEY, (raw) => {
    const loaded = loadMapDoc(raw);
    return loaded.ok ? loaded.doc : null;
  });

export const storeDraft = (doc: MapDoc, store = browserStore()): boolean => write(store, DRAFT_KEY, doc);
