/**
 * A phone's view of a live hunt, built from the server's messages (architecture §7). Pure: the
 * view, a message and the phone's clock in; the next view out. Other members' trails grow here
 * from their positions, by the same rules the hunt object uses.
 */

import type { MapDoc } from "../doc/types";
import { tracksTrail, type HuntInfo, type MemberInfo, type Observation, type Role, type Seen, type ServerMessage } from "./protocol";
import { extend, type TrailPoint } from "./trail";

export type HuntView = {
  you: { id: string; role: Role; host: boolean } | null;
  hunt: HuntInfo | null;
  members: Record<string, MemberInfo>;
  positions: Record<string, Seen>;
  trails: Record<string, TrailPoint[]>;
  doc: MapDoc | null;
  rev: number;
  obs: Observation[];
  /** Server time minus this phone's, so "seen 12 s ago" is right whatever the phone's clock says. */
  offset: number;
  ended: "host" | "expired" | null;
  /** The trail.request since the last welcome: the phone answers with its own trail. */
  trailRequested: number;
  lastError: string | null;
  /** Every error so far, so the same code twice is still seen twice. */
  errors: number;
  /** The features whose edits the hunt has refused as stale, oldest first. */
  rejected: string[];
};

export const emptyView = (): HuntView => ({
  you: null,
  hunt: null,
  members: {},
  positions: {},
  trails: {},
  doc: null,
  rev: 0,
  obs: [],
  offset: 0,
  ended: null,
  trailRequested: 0,
  lastError: null,
  errors: 0,
  rejected: [],
});

const without = <T,>(r: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));

export function applyServer(view: HuntView, msg: ServerMessage, localNow: number): HuntView {
  switch (msg.t) {
    case "welcome":
      return {
        ...view,
        you: msg.you,
        hunt: msg.hunt,
        members: Object.fromEntries(msg.members.map((m) => [m.id, m])),
        positions: msg.positions,
        trails: msg.trails,
        doc: msg.doc,
        rev: msg.rev,
        obs: msg.obs,
        offset: msg.now - localNow,
        ended: null,
        trailRequested: view.trailRequested + 1,
      };
    case "member": {
      const you = view.you && view.you.id === msg.m.id ? { ...view.you, role: msg.m.role } : view.you;
      return { ...view, you, members: { ...view.members, [msg.m.id]: msg.m } };
    }
    case "member.gone":
      return {
        ...view,
        members: without(view.members, msg.id),
        positions: without(view.positions, msg.id),
        trails: without(view.trails, msg.id),
      };
    case "pos": {
      const { t: _t, m, ...seen } = msg;
      void _t;
      const member = view.members[m];
      const grows = !!view.hunt && !!member && tracksTrail(view.hunt.type, member.role);
      const trails = grows ? { ...view.trails, [m]: extend(view.trails[m] ?? [], seen.c, seen.acc, Math.round(seen.at / 1000)) } : view.trails;
      return { ...view, positions: { ...view.positions, [m]: seen }, trails };
    }
    case "away": {
      const member = view.members[msg.m];
      return member ? { ...view, members: { ...view.members, [msg.m]: { ...member, away: msg.away } } } : view;
    }
    case "trail":
      return { ...view, trails: { ...view.trails, [msg.m]: msg.pts } };
    case "trail.request":
      return { ...view, trailRequested: view.trailRequested + 1 };
    case "feature.put":
    case "feature.reject": {
      if (!view.doc) return view;
      const f = msg.t === "feature.put" ? msg.f : msg.f;
      const id = msg.t === "feature.put" ? msg.f.id : msg.id;
      const rest = view.doc.features.filter((x) => x.id !== id);
      const features = f ? (view.doc.features.some((x) => x.id === id) ? view.doc.features.map((x) => (x.id === id ? f : x)) : [...rest, f]) : rest;
      const rejected = msg.t === "feature.reject" ? [...view.rejected, id] : view.rejected;
      return { ...view, doc: { ...view.doc, features }, rev: Math.max(view.rev, msg.rev), rejected };
    }
    case "feature.del":
      return view.doc ? { ...view, doc: { ...view.doc, features: view.doc.features.filter((f) => f.id !== msg.id) }, rev: Math.max(view.rev, msg.rev) } : view;
    case "obs.put":
      return { ...view, obs: [...view.obs.filter((o) => o.id !== msg.obs.id), msg.obs] };
    case "obs.del":
      return { ...view, obs: view.obs.filter((o) => o.id !== msg.id) };
    case "hunt":
      return view.hunt ? { ...view, hunt: { ...view.hunt, code: msg.code, locked: msg.locked, endsAt: msg.endsAt } } : view;
    case "ended":
      return { ...view, ended: msg.reason };
    case "error":
      return { ...view, lastError: msg.code, errors: view.errors + 1 };
  }
}

/** How long ago a member's position arrived, by the server's clock. */
export const ageMs = (seen: Seen, offset: number, localNow: number): number => localNow + offset - seen.rt;
