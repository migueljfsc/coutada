/**
 * A live hunt as a reducer (D2, D9–D13): a member's message and the time in; the new state and
 * what to send, to whom, out. The Durable Object only carries the outputs out. What persists —
 * members, the map, observations, the lock — is `Durable`; positions and trails are `Live`, held
 * in memory and never written anywhere (D13).
 */

import { LIMITS } from "../../src/doc/catalogue";
import { docBytes } from "../../src/doc/schema";
import type { MapDoc, MapFeature } from "../../src/doc/types";
import {
  firstRole,
  MAX_MEMBERS,
  MAX_OBSERVATIONS,
  tracksTrail,
  type ClientMessage,
  type HuntType,
  type MemberInfo,
  type Observation,
  type Role,
  type Seen,
  type ServerMessage,
} from "../../src/live/protocol";
import { extend, type TrailPoint } from "../../src/live/trail";

export type Member = {
  id: string;
  name: string;
  role: Role;
  host: boolean;
  verified: boolean;
  /** SHA-256 of the member's bearer token. */
  token: string;
  kicked: boolean;
};

export type Durable = {
  meta: { type: HuntType; code: string; locked: boolean; endsAt: number; mapId: string };
  members: Member[];
  doc: MapDoc;
  rev: number;
  /** The document revision each feature was last written at, for stale-edit checks (D12). */
  revs: Record<string, number>;
  obs: Observation[];
};

export type Live = {
  positions: Record<string, Seen>;
  away: Record<string, boolean>;
  trails: Record<string, TrailPoint[]>;
  /** Open sockets per member. */
  online: Record<string, number>;
};

export type State = Durable & Live;

export type Out =
  | { to: "all" | "others" | "self"; msg: ServerMessage }
  | { close: string; code: number }
  | { persist: true }
  | { writeBack: true }
  | { rotate: true }
  | { end: "host" };

const send = (to: "all" | "others" | "self", msg: ServerMessage): Out => ({ to, msg });
const refuse = (code: string): Out[] => [send("self", { t: "error", code })];

export const emptyLive = (): Live => ({ positions: {}, away: {}, trails: {}, online: {} });

export function memberInfo(state: State, m: Member): MemberInfo {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    host: m.host,
    verified: m.verified,
    online: (state.online[m.id] ?? 0) > 0,
    away: state.away[m.id] === true,
  };
}

const present = (state: State) => state.members.filter((m) => !m.kicked);

/** A name no other member in the hunt is using: "João", then "João (2)". */
function freeName(state: State, wanted: string): string {
  const taken = new Set(present(state).map((m) => m.name.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const candidate = `${wanted} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export type JoinResult = { ok: true; state: State; member: Member } | { ok: false; error: "locked" | "full" };

export function join(state: State, input: { id: string; name: string; verified: boolean; token: string; host?: boolean }): JoinResult {
  if (!input.host && state.meta.locked) return { ok: false, error: "locked" };
  if (present(state).length >= MAX_MEMBERS) return { ok: false, error: "full" };
  const member: Member = {
    id: input.id,
    name: freeName(state, input.name),
    role: firstRole(state.meta.type),
    host: input.host === true,
    verified: input.verified,
    token: input.token,
    kicked: false,
  };
  return { ok: true, state: { ...state, members: [...state.members, member] }, member };
}

export function welcome(state: State, memberId: string, now: number): ServerMessage {
  const me = state.members.find((m) => m.id === memberId)!;
  return {
    t: "welcome",
    you: { id: me.id, role: me.role, host: me.host },
    now,
    hunt: { ...state.meta },
    members: present(state).map((m) => memberInfo(state, m)),
    positions: state.positions,
    doc: state.doc,
    rev: state.rev,
    obs: state.obs,
    trails: state.trails,
  };
}

/** A socket opened or closed for a member: everyone sees them come and go. */
export function connected(state: State, memberId: string, delta: 1 | -1): { state: State; out: Out[] } {
  const m = state.members.find((x) => x.id === memberId);
  if (!m || m.kicked) return { state, out: [] };
  const online = { ...state.online, [memberId]: Math.max(0, (state.online[memberId] ?? 0) + delta) };
  const next = { ...state, online };
  return { state: next, out: [send("others", { t: "member", m: memberInfo(next, m) })] };
}

const allowedRoles = (type: HuntType): readonly Role[] => (type === "salto" ? ["member"] : ["porta", "batedor"]);

export function reduce(state: State, memberId: string, msg: ClientMessage, now: number): { state: State; out: Out[] } {
  const me = state.members.find((m) => m.id === memberId);
  if (!me || me.kicked) return { state, out: [] };
  const same = (out: Out[] = []) => ({ state, out });

  switch (msg.t) {
    case "pos": {
      const { t: _t, ...pos } = msg;
      void _t;
      const seen: Seen = { ...pos, rt: now };
      const trail = state.trails[memberId] ?? [];
      const trails = tracksTrail(state.meta.type, me.role)
        ? { ...state.trails, [memberId]: extend(trail, pos.c, pos.acc, Math.round(pos.at / 1000)) }
        : state.trails;
      return {
        state: { ...state, positions: { ...state.positions, [memberId]: seen }, trails },
        out: [send("others", { t: "pos", m: memberId, ...seen })],
      };
    }

    case "away":
    case "back": {
      const away = msg.t === "away";
      return { state: { ...state, away: { ...state.away, [memberId]: away } }, out: [send("others", { t: "away", m: memberId, away })] };
    }

    case "trail.sync": {
      if (!tracksTrail(state.meta.type, me.role)) return same();
      return {
        state: { ...state, trails: { ...state.trails, [memberId]: msg.pts } },
        out: [send("others", { t: "trail", m: memberId, pts: msg.pts })],
      };
    }

    case "obs.put": {
      const existing = state.obs.find((o) => o.id === msg.obs.id);
      if (existing && existing.by !== memberId && !me.host) return same(refuse("forbidden"));
      if (!existing && state.obs.length >= MAX_OBSERVATIONS) return same(refuse("too_many"));
      const obs: Observation = { ...msg.obs, by: existing?.by ?? memberId, at: now };
      const list = existing ? state.obs.map((o) => (o.id === obs.id ? obs : o)) : [...state.obs, obs];
      return { state: { ...state, obs: list }, out: [{ persist: true }, send("all", { t: "obs.put", obs })] };
    }

    case "obs.del": {
      const existing = state.obs.find((o) => o.id === msg.id);
      if (!existing) return same();
      if (existing.by !== memberId && !me.host) return same(refuse("forbidden"));
      return { state: { ...state, obs: state.obs.filter((o) => o.id !== msg.id) }, out: [{ persist: true }, send("all", { t: "obs.del", id: msg.id })] };
    }

    case "role": {
      const targetId = msg.member ?? memberId;
      if (targetId !== memberId && !me.host) return same(refuse("forbidden"));
      if (!allowedRoles(state.meta.type).includes(msg.role)) return same(refuse("invalid_role"));
      const target = present(state).find((m) => m.id === targetId);
      if (!target) return same();
      const members = state.members.map((m) => (m.id === targetId ? { ...m, role: msg.role } : m));
      const next = { ...state, members };
      return { state: next, out: [{ persist: true }, send("all", { t: "member", m: memberInfo(next, { ...target, role: msg.role }) })] };
    }

    case "feature.put":
    case "feature.del": {
      if (!me.host) return same(refuse("forbidden"));
      const fid = msg.t === "feature.put" ? msg.f.id : msg.id;
      const current = state.doc.features.find((f) => f.id === fid) ?? null;
      if ((state.revs[fid] ?? 0) > msg.base) {
        return same([send("self", { t: "feature.reject", id: fid, f: current, rev: state.rev })]);
      }
      let features: MapFeature[];
      if (msg.t === "feature.put") {
        if (!current && state.doc.features.length >= LIMITS.features) return same(refuse("too_many"));
        features = current ? state.doc.features.map((f) => (f.id === fid ? msg.f : f)) : [...state.doc.features, msg.f];
      } else {
        if (!current) return same();
        features = state.doc.features.filter((f) => f.id !== fid);
      }
      const doc = { ...state.doc, features };
      if (docBytes(doc) > LIMITS.docBytes) return same(refuse("too_large"));
      const rev = state.rev + 1;
      return {
        state: { ...state, doc, rev, revs: { ...state.revs, [fid]: rev } },
        out: [
          { persist: true },
          { writeBack: true },
          send("all", msg.t === "feature.put" ? { t: "feature.put", f: msg.f, rev } : { t: "feature.del", id: fid, rev }),
        ],
      };
    }

    case "hunt.lock": {
      if (!me.host) return same(refuse("forbidden"));
      const meta = { ...state.meta, locked: msg.on };
      return { state: { ...state, meta }, out: [{ persist: true }, send("all", { t: "hunt", code: meta.code, locked: meta.locked, endsAt: meta.endsAt })] };
    }

    case "hunt.kick": {
      const target = present(state).find((m) => m.id === msg.member);
      if (!me.host || !target || target.host) return same(refuse("forbidden"));
      const members = state.members.map((m) => (m.id === target.id ? { ...m, kicked: true } : m));
      const drop = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== target.id));
      return {
        state: { ...state, members, positions: drop(state.positions), trails: drop(state.trails), away: drop(state.away) },
        out: [{ persist: true }, { close: target.id, code: 4003 }, send("all", { t: "member.gone", id: target.id })],
      };
    }

    case "hunt.rotate":
      return same(me.host ? [{ rotate: true }] : refuse("forbidden"));

    case "hunt.end":
      return same(me.host ? [{ end: "host" }] : refuse("forbidden"));
  }
}

/** A new code is in place: everyone sees it. */
export function setCode(state: State, code: string): { state: State; out: Out[] } {
  const meta = { ...state.meta, code };
  return { state: { ...state, meta }, out: [{ persist: true }, send("all", { t: "hunt", code, locked: meta.locked, endsAt: meta.endsAt })] };
}
