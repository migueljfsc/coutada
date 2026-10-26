/**
 * The live connection to a hunt (architecture §7): the socket and its reconnects, the view built
 * from the server's messages, this phone's position sent by the sampler (D15), its own trail kept
 * on the phone and sent back whenever the hunt asks (D13), and `away` when the page is hidden.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Fix } from "../map/me";
import { applyServer, emptyView, type HuntView } from "./huntState";
import { storedPass, storedTrail, storeTrail } from "./huntStore";
import { CLOSE, PROTOCOL, tracksTrail, type ClientMessage, type ServerMessage } from "./protocol";
import { cadence, newSampler, sample, type Sampler } from "./sampler";
import { extend, type TrailPoint } from "./trail";

export type Link = "connecting" | "live" | "reconnecting" | "kicked" | "ended" | "denied";

/** Refused this many times in a row without ever opening: the pass is no good any more. */
const GIVE_UP_AFTER = 5;
const MAX_BACKOFF_MS = 30_000;

type Action = { msg: ServerMessage; now: number } | { reset: true };
const reducer = (view: HuntView, a: Action) => ("reset" in a ? emptyView() : applyServer(view, a.msg, a.now));

export function useHunt(huntId: string, fix: Fix | null) {
  const [view, dispatch] = useReducer(reducer, undefined, emptyView);
  const [link, setLink] = useState<Link>(() => (storedPass(huntId) ? "connecting" : "denied"));
  const [ownTrail, setOwnTrail] = useState<TrailPoint[]>(() => storedTrail(huntId));
  const socket = useRef<WebSocket | null>(null);
  const sampler = useRef<Sampler>(newSampler(0));
  const latest = useRef({ view, ownTrail });
  useEffect(() => {
    latest.current = { view, ownTrail };
  });

  const send = useCallback((msg: ClientMessage) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // The socket, reconnecting with backoff until the hunt ends or this phone is no longer in it.
  useEffect(() => {
    const pass = storedPass(huntId);
    if (!pass) return;
    let stopped = false;
    let attempt = 0;
    let refusals = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/hunts/${huntId}/ws`;
      const ws = new WebSocket(url, [PROTOCOL, pass.token]);
      socket.current = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
        attempt = 0;
        refusals = 0;
        setLink("live");
      };
      ws.onmessage = (e) => {
        try {
          dispatch({ msg: JSON.parse(String(e.data)) as ServerMessage, now: Date.now() });
        } catch {
          // A frame this build does not understand; the next welcome resets the view.
        }
      };
      ws.onclose = (e) => {
        socket.current = null;
        if (stopped) return;
        if (e.code === CLOSE.kicked) return setLink("kicked");
        if (e.code === CLOSE.ended) return setLink("ended");
        if (!opened && ++refusals >= GIVE_UP_AFTER) return setLink("denied");
        setLink("reconnecting");
        const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++) * (0.75 + Math.random() / 2);
        timer = setTimeout(connect, wait);
      };
    };

    connect();
    const retryNow = () => {
      if (socket.current || stopped) return;
      if (timer) clearTimeout(timer);
      attempt = 0;
      connect();
    };
    window.addEventListener("online", retryNow);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", retryNow);
      socket.current?.close(1000, "left");
      socket.current = null;
    };
  }, [huntId]);

  const tracks = !!view.hunt && !!view.you && tracksTrail(view.hunt.type, view.you.role);

  // The phone's own trail, whenever the hunt asks for it: after every welcome and every wake.
  useEffect(() => {
    if (view.trailRequested === 0 || !tracks) return;
    send({ t: "trail.sync", pts: latest.current.ownTrail });
  }, [view.trailRequested, tracks, send]);

  // Each fix: into the trail if it qualifies, and to the hunt when the sampler says so.
  useEffect(() => {
    const { view: v } = latest.current;
    if (!fix || !v.hunt || !v.you) return;
    const now = Date.now();
    if (tracks) {
      const next = extend(latest.current.ownTrail, fix.at, fix.accuracy, Math.round(fix.time / 1000));
      if (next !== latest.current.ownTrail) {
        setOwnTrail(next);
        storeTrail(huntId, next);
      }
    }
    const step = sample(sampler.current, fix.at, null, now, cadence(v.hunt.type, v.you.role));
    sampler.current = step.sampler;
    if (step.send) {
      send({
        t: "pos",
        c: fix.at,
        acc: Math.round(fix.accuracy),
        ...(fix.heading !== null ? { hdg: Math.round(fix.heading) } : {}),
        at: fix.time,
      });
    }
  }, [fix, tracks, huntId, send]);

  // Hidden means the phone stops sending; the group is told rather than left guessing (D15).
  useEffect(() => {
    const onVisibility = () => send({ t: document.visibilityState === "hidden" ? "away" : "back" });
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [send]);

  return { view, link: view.ended ? "ended" : link, send, ownTrail };
}
