/**
 * Version dispatch, before validation on every load (D7). A document newer than this build is
 * refused with a message rather than read wrong; one that is not a map at all, likewise.
 */

import { msg, type Message } from "../i18n/core";
import { parseMapDoc } from "./schema";
import { DOC_VERSION, type MapDoc } from "./types";

export type Loaded = { ok: true; doc: MapDoc } | { ok: false; error: Message };

function versionOf(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const meta = (raw as { coutada?: unknown }).coutada;
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as { v?: unknown }).v;
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

export function loadMapDoc(raw: unknown): Loaded {
  const version = versionOf(raw);
  if (version === null) return { ok: false, error: msg("doc.notAMap") };
  if (version > DOC_VERSION) return { ok: false, error: msg("doc.tooNew", { version }) };

  const doc = parseMapDoc(raw);
  return doc ? { ok: true, doc } : { ok: false, error: msg("doc.invalid") };
}
