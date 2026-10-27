/**
 * The map during a hunt (D12). Everyone's editor follows the hunt's document; the host's edits go
 * to the hunt as `feature.put` / `feature.del` a moment after the last one, one batch at a time
 * and paced under the hunt's frame limit. A feature the host has changed keeps the host's version
 * until the hunt answers for it.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createMapDoc } from "../doc/operations";
import type { MapDoc } from "../doc/types";
import { initialEditor, reduce } from "../draw/editor";
import { changes, moved, rebase } from "./docSync";
import type { HuntView } from "./huntState";
import type { ClientMessage } from "./protocol";

/** How long sending waits after the last edit, so a drag goes as one change. */
const SEND_DELAY_MS = 400;
/** Edits per batch and the pause between batches: with positions, under 40 frames in 10 s. */
const BATCH = 5;
const BATCH_GAP_MS = 1500;
/** A batch the hunt has not answered by then is sent again. */
const ANSWER_MS = 8000;

export type EditNotice = "rejected" | "refused";

export function useHuntEditor(view: HuntView, send: (msg: ClientMessage) => boolean, host: boolean) {
  const [editor, dispatch] = useReducer(reduce, null, () => initialEditor(createMapDoc("")));
  const [waiting, setWaiting] = useState(0);
  const [notice, setNotice] = useState<EditNotice | null>(null);
  const server = useRef<MapDoc | null>(null);
  const unanswered = useRef(new Set<string>());
  const lastBatch = useRef(0);
  const seen = useRef({ rejected: 0, errors: 0 });

  // The hunt's document moved: answers for what was sent, and the rest flows into the editor.
  useEffect(() => {
    const after = view.doc;
    if (!after) return;
    const before = server.current;
    const rejected = view.rejected.slice(seen.current.rejected);
    const refused = view.errors > seen.current.errors && unanswered.current.size > 0;
    seen.current = { rejected: view.rejected.length, errors: view.errors };
    if (after === before && rejected.length === 0 && !refused) return;
    server.current = after;

    if (!before) {
      dispatch({ type: "load", doc: after });
      return;
    }
    if (refused) {
      unanswered.current.clear();
      dispatch({ type: "remote", doc: after });
      setNotice("refused");
    } else {
      for (const id of [...moved(before, after), ...rejected]) unanswered.current.delete(id);
      dispatch({ type: "remote", doc: rebase(editor.doc, before, after, new Set(rejected)) });
      if (rejected.length > 0) setNotice("rejected");
    }
    setWaiting(unanswered.current.size);
  }, [view.doc, view.rejected, view.errors, editor.doc]);

  // The host's changes, once the last batch is answered.
  useEffect(() => {
    const held = server.current;
    if (!host || !held || waiting > 0) return;
    const pending = changes(held, editor.doc, view.rev);
    if (pending.length === 0) return;
    const delay = Math.max(SEND_DELAY_MS, lastBatch.current + BATCH_GAP_MS - Date.now());
    const timer = setTimeout(() => {
      for (const msg of pending.slice(0, BATCH)) {
        if (!send(msg)) break;
        unanswered.current.add(msg.t === "feature.put" ? msg.f.id : msg.id);
      }
      lastBatch.current = Date.now();
      setWaiting(unanswered.current.size);
    }, delay);
    return () => clearTimeout(timer);
  }, [host, editor.doc, view.rev, view.doc, waiting, send]);

  // A batch lost with a dropped connection is sent again.
  useEffect(() => {
    if (waiting === 0) return;
    const timer = setTimeout(() => {
      unanswered.current.clear();
      setWaiting(0);
    }, ANSWER_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const dismiss = useCallback(() => setNotice(null), []);
  return { editor, dispatch, notice, dismiss };
}
