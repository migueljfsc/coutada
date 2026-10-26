/**
 * The map being worked on and where it is kept: always in this browser (the draft), and on the
 * server once it has an id (D8). Edits save themselves a moment after the last one, carrying the
 * version they were based on; a refused version is a conflict the person settles.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createMapDoc } from "../doc/operations";
import type { MapDoc } from "../doc/types";
import { initialEditor, reduce } from "../draw/editor";
import { loadMapDoc } from "../doc/migrate";
import { api } from "../share/api";
import { storeDraft, storedDraft, type Remote } from "../share/draft";
import { mapPath, navigate } from "../share/routes";

/** How long saving waits after the last edit. */
const SAVE_DELAY_MS = 1500;

export type SyncStatus =
  /** Only in this browser: no server map yet. */
  | "local"
  | "loading"
  | "saving"
  | "saved"
  /** Changes waiting for a connection. */
  | "offline"
  /** The server has a newer version than the one these edits started from. */
  | "conflict"
  /** The server map is gone, or not this person's. */
  | "missing";

type ServerMap = { map: { id: string; doc: unknown; version: number; share_slug: string | null } };

export function useMapDocument(mapId: string | null, untitled: string) {
  const [first] = useState(() => storedDraft());
  const [editor, dispatch] = useReducer(reduce, null, () => initialEditor(first?.doc ?? createMapDoc(untitled)));
  const [remote, setRemote] = useState<Remote | null>(first?.remote ?? null);
  const [status, setStatus] = useState<SyncStatus>(first?.remote ? (first.dirty ? "offline" : "saved") : "local");
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  const doc = useRef<MapDoc>(editor.doc);
  const remoteRef = useRef<Remote | null>(remote);
  const loaded = useRef<MapDoc>(editor.doc);
  const dirty = useRef(first?.dirty ?? false);
  const conflictVersion = useRef<number | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** `save` itself, for the follow-up save it starts when edits arrived while it was saving. */
  const saveAgain = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    doc.current = editor.doc;
  }, [editor.doc]);

  const keep = useCallback((next: Remote | null) => {
    remoteRef.current = next;
    setRemote(next);
  }, []);

  const persist = useCallback(() => {
    storeDraft({ doc: doc.current, remote: remoteRef.current, dirty: dirty.current });
  }, []);

  /** Puts a document in the editor as it came from somewhere, not as an edit. */
  const load = useCallback(
    (next: MapDoc, from: Remote | null) => {
      loaded.current = next;
      doc.current = next;
      dirty.current = false;
      keep(from);
      dispatch({ type: "load", doc: next });
      storeDraft({ doc: next, remote: from, dirty: false });
    },
    [keep],
  );

  const save = useCallback(async () => {
    const target = remoteRef.current;
    if (!target || !dirty.current) return;
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    const sent = doc.current;
    const result = await api<{ map: { version: number } }>("PUT", `/api/maps/${target.id}`, { doc: sent, version: target.version });
    saving.current = false;

    if (result.ok) {
      keep({ id: target.id, version: result.data.map.version });
      dirty.current = doc.current !== sent;
      persist();
      setStatus(dirty.current ? "saving" : "saved");
    } else if (result.error === "version_conflict") {
      conflictVersion.current = typeof result.data?.version === "number" ? result.data.version : null;
      setStatus("conflict");
      return;
    } else if (result.status === 404) {
      setStatus("missing");
      return;
    } else {
      setStatus("offline");
      return;
    }
    if (again.current || dirty.current) {
      again.current = false;
      void saveAgain.current();
    }
  }, [keep, persist]);

  useEffect(() => {
    saveAgain.current = save;
  }, [save]);

  // Every edit is kept in the browser at once, and sent to the server a moment after the last.
  useEffect(() => {
    if (editor.doc === loaded.current) return;
    dirty.current = true;
    persist();
    if (!remoteRef.current) {
      setStatus("local");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  }, [editor.doc, persist, save]);

  useEffect(() => {
    const retry = () => void save();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [save]);

  const fetchMap = useCallback(
    async (id: string) => {
      const result = await api<ServerMap>("GET", `/api/maps/${id}`);
      if (!result.ok) return result.status === 0 ? "offline" : "missing";
      const parsed = loadMapDoc(result.data.map.doc);
      if (!parsed.ok) return "missing";
      load(parsed.doc, { id, version: result.data.map.version });
      setShareSlug(result.data.map.share_slug);
      return "saved";
    },
    [load],
  );

  // The route names the map: open it, unless it is the one already being worked on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = remoteRef.current;
      if (!mapId) {
        if (current) navigate(mapPath(current.id), true);
        return;
      }
      if (current?.id === mapId && dirty.current) {
        void save();
        return;
      }
      if (current?.id !== mapId) setStatus("loading");
      const outcome = await fetchMap(mapId);
      if (cancelled) return;
      // Offline, with this map already here: what is shown is still what was saved.
      setStatus(outcome === "offline" && current?.id === mapId ? "saved" : outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapId, fetchMap, save]);

  /** Files the map on the server under whoever this browser is, and goes to its address. */
  const saveAsNew = useCallback(async (): Promise<string | null> => {
    setStatus("saving");
    const result = await api<{ map: { id: string; version: number } }>("POST", "/api/maps", { doc: doc.current });
    if (!result.ok) {
      setStatus(remoteRef.current ? "missing" : "local");
      return result.error;
    }
    loaded.current = doc.current;
    dirty.current = false;
    keep({ id: result.data.map.id, version: result.data.map.version });
    setShareSlug(null);
    persist();
    setStatus("saved");
    navigate(mapPath(result.data.map.id), true);
    return null;
  }, [keep, persist]);

  /** Settles a conflict: keep these edits over the server's, or take the server's. */
  const resolve = useCallback(
    async (keepMine: boolean) => {
      const target = remoteRef.current;
      if (!target) return;
      if (keepMine && conflictVersion.current !== null) {
        keep({ id: target.id, version: conflictVersion.current });
        conflictVersion.current = null;
        await save();
      } else {
        setStatus("loading");
        setStatus(await fetchMap(target.id));
      }
    },
    [fetchMap, keep, save],
  );

  /** Starts a fresh map in this browser. */
  const startNew = useCallback(() => {
    load(createMapDoc(untitled), null);
    setShareSlug(null);
    setStatus("local");
    navigate("/");
  }, [load, untitled]);

  return { editor, dispatch, remote, status, shareSlug, setShareSlug, saveAsNew, resolve, startNew, unsaved: () => dirty.current };
}
