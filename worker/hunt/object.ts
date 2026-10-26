/**
 * The Hunt Durable Object (D9, D13): one per hunt, in the EU, on the WebSocket Hibernation API.
 * A thin shell: it authenticates sockets, turns frames into `reduce` calls, and carries the
 * outputs out. Members, the map and observations are stored; positions and trails are not — the
 * last position of each member rides in its socket's attachment, which the runtime keeps with the
 * connection, and trails are asked back from the phones after a wake.
 */

import { DurableObject } from "cloudflare:workers";
import type { MapDoc } from "../../src/doc/types";
import {
  CLOSE,
  MAX_FRAME_BYTES,
  MAX_TRAIL_FRAME_BYTES,
  parseClientMessage,
  PROTOCOL,
  type HuntType,
  type Seen,
  type ServerMessage,
} from "../../src/live/protocol";
import { newId, newToken, tokenDigest } from "../lib/crypto";
import { CODE_ALPHABET, newCode } from "../lib/hunts";
import { connected, emptyLive, join, reduce, setCode, welcome, type Durable, type Out, type State } from "./state";

/** What each socket carries through hibernation. */
type Attachment = { member: string; pos?: Seen; away?: boolean };

/** Frames per socket allowed in a window: four a second, averaged over ten (architecture §7). */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 40;
/** How long a map edit waits before it is written back to D1 (D12). */
const WRITE_BACK_MS = 5_000;

type Stored = Durable & { id: string; writeBackAt: number | null };

/** A socket closing — a kicked member's, or one that just dropped — cannot be sent to; skip it. */
function sendTo(ws: WebSocket, frame: string) {
  try {
    ws.send(frame);
  } catch {
    // Already closing.
  }
}

export class Hunt extends DurableObject<Env> {
  private state: (State & { id: string }) | null = null;
  private writeBackAt: number | null = null;
  /** Trails are memory only: after a wake there are none until the phones send theirs again. */
  private cold = false;
  private rates = new Map<WebSocket, { start: number; n: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<Stored>("hunt");
      if (!stored) return;
      const live = emptyLive();
      for (const ws of ctx.getWebSockets()) {
        const a = ws.deserializeAttachment() as Attachment | null;
        if (!a) continue;
        live.online[a.member] = (live.online[a.member] ?? 0) + 1;
        if (a.pos) live.positions[a.member] = a.pos;
        if (a.away) live.away[a.member] = true;
      }
      const { writeBackAt, ...durable } = stored;
      this.writeBackAt = writeBackAt;
      this.state = { ...durable, ...live };
      this.cold = true;
    });
  }

  // ------------------------------------------------------------------ RPC

  async init(input: {
    id: string;
    mapId: string;
    type: HuntType;
    code: string;
    endsAt: number;
    doc: MapDoc;
    host: { name: string; verified: boolean };
  }): Promise<{ id: string; token: string }> {
    const base: State & { id: string } = {
      id: input.id,
      meta: { type: input.type, code: input.code, locked: false, endsAt: input.endsAt, mapId: input.mapId },
      members: [],
      doc: input.doc,
      rev: 0,
      revs: {},
      obs: [],
      ...emptyLive(),
    };
    const token = newToken();
    const memberId = newId();
    const joined = join(base, { id: memberId, name: input.host.name, verified: input.host.verified, token: await tokenDigest(token), host: true });
    if (!joined.ok) throw new Error(joined.error);
    this.state = { ...joined.state, id: input.id };
    await this.persist();
    await this.ctx.storage.setAlarm(input.endsAt);
    return { id: memberId, token };
  }

  async join(input: { name: string; verified: boolean }): Promise<{ ok: true; memberId: string; token: string } | { ok: false }> {
    if (!this.state) return { ok: false };
    const token = newToken();
    const memberId = newId();
    const joined = join(this.state, { id: memberId, name: input.name, verified: input.verified, token: await tokenDigest(token) });
    if (!joined.ok) return { ok: false };
    this.state = { ...joined.state, id: this.state.id };
    await this.persist();
    return { ok: true, memberId, token };
  }

  // ----------------------------------------------------------- sockets

  async fetch(request: Request): Promise<Response> {
    const offered = (request.headers.get("sec-websocket-protocol") ?? "").split(",").map((p) => p.trim());
    const token = offered[0] === PROTOCOL ? offered[1] : undefined;
    const state = this.state;
    if (!state || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return new Response(null, { status: 401 });
    const digest = await tokenDigest(token);
    const member = state.members.find((m) => m.token === digest && !m.kicked);
    if (!member) return new Response(null, { status: 401 });

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [member.id]);
    server.serializeAttachment({ member: member.id } satisfies Attachment);

    const now = Date.now();
    const joined = connected(state, member.id, 1);
    this.state = { ...joined.state, id: state.id };
    server.send(JSON.stringify(welcome(this.state, member.id, now)));
    await this.apply(joined.out, server);
    if (this.cold) this.wake();

    return new Response(null, { status: 101, webSocket: client, headers: { "sec-websocket-protocol": PROTOCOL } });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (!a || !this.state) return;
    const size = typeof data === "string" ? data.length : data.byteLength;
    if (size > MAX_TRAIL_FRAME_BYTES || this.overRate(ws)) {
      ws.close(CLOSE.overLimit, "over limit");
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      raw = null;
    }
    const msg = parseClientMessage(raw);
    if (!msg || (msg.t !== "trail.sync" && size > MAX_FRAME_BYTES)) {
      ws.send(JSON.stringify({ t: "error", code: "invalid_message" } satisfies ServerMessage));
      return;
    }
    if (this.cold) this.wake();

    const result = reduce(this.state, a.member, msg, Date.now());
    this.state = { ...result.state, id: this.state.id };
    if (msg.t === "pos" || msg.t === "away" || msg.t === "back") {
      ws.serializeAttachment({ member: a.member, pos: this.state.positions[a.member], away: this.state.away[a.member] } satisfies Attachment);
    }
    await this.apply(result.out, ws);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  private async left(ws: WebSocket) {
    this.rates.delete(ws);
    const a = ws.deserializeAttachment() as Attachment | null;
    if (!a || !this.state) return;
    const gone = connected(this.state, a.member, -1);
    this.state = { ...gone.state, id: this.state.id };
    await this.apply(gone.out, ws);
  }

  private overRate(ws: WebSocket): boolean {
    const now = Date.now();
    const r = this.rates.get(ws);
    if (!r || now - r.start > RATE_WINDOW_MS) {
      this.rates.set(ws, { start: now, n: 1 });
      return false;
    }
    r.n++;
    return r.n > RATE_MAX;
  }

  /** After a wake the trails are gone from memory: every phone sends its own again (D13). */
  private wake() {
    this.cold = false;
    this.broadcast({ t: "trail.request" });
  }

  // ----------------------------------------------------------- outputs

  private broadcast(msg: ServerMessage, except?: WebSocket) {
    const frame = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) if (ws !== except) sendTo(ws, frame);
  }

  private async apply(out: Out[], self: WebSocket) {
    for (const o of out) {
      if ("msg" in o) {
        if (o.to === "self") sendTo(self, JSON.stringify(o.msg));
        else this.broadcast(o.msg, o.to === "others" ? self : undefined);
      } else if ("close" in o) {
        for (const ws of this.ctx.getWebSockets(o.close)) ws.close(o.code, "removed");
      } else if ("persist" in o) {
        await this.persist();
      } else if ("writeBack" in o) {
        this.writeBackAt ??= Date.now() + WRITE_BACK_MS;
        await this.persist();
        await this.schedule();
      } else if ("rotate" in o) {
        await this.rotate(self);
      } else if ("end" in o) {
        await this.end("host");
        return;
      }
    }
  }

  private async persist() {
    if (!this.state) return;
    // Only what persists: never positions or trails (D13).
    const { id, meta, members, doc, rev, revs, obs } = this.state;
    await this.ctx.storage.put("hunt", { id, meta, members, doc, rev, revs, obs, writeBackAt: this.writeBackAt } satisfies Stored);
  }

  private async schedule() {
    if (!this.state) return;
    await this.ctx.storage.setAlarm(Math.min(this.state.meta.endsAt, this.writeBackAt ?? Infinity));
  }

  /** A new code for the hunt: the old one is dead the moment the row changes (D10). */
  private async rotate(self: WebSocket) {
    if (!this.state) return;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = newCode();
      if (code === this.state.meta.code || ![...code].every((c) => CODE_ALPHABET.includes(c))) continue;
      try {
        await this.env.DB.prepare("UPDATE hunts SET code = ?1 WHERE id = ?2").bind(code, this.state.id).run();
      } catch {
        continue;
      }
      const result = setCode(this.state, code);
      this.state = { ...result.state, id: this.state.id };
      await this.apply(result.out, self);
      return;
    }
  }

  private async writeBack() {
    if (!this.state) return;
    this.writeBackAt = null;
    await this.env.DB.prepare("UPDATE maps SET doc = ?1, name = ?2, version = version + 1, updated_at = ?3 WHERE id = ?4")
      .bind(JSON.stringify(this.state.doc), this.state.doc.coutada.name, Math.floor(Date.now() / 1000), this.state.meta.mapId)
      .run();
  }

  async alarm(): Promise<void> {
    if (!this.state) return;
    const now = Date.now();
    if (this.writeBackAt !== null && this.writeBackAt <= now) await this.writeBack();
    if (now >= this.state.meta.endsAt) {
      await this.end("expired");
      return;
    }
    await this.persist();
    await this.schedule();
  }

  /** The map goes back to D1, everyone is told and disconnected, and nothing of the hunt remains. */
  private async end(reason: "host" | "expired") {
    if (!this.state) return;
    if (this.state.rev > 0) await this.writeBack();
    this.broadcast({ t: "ended", reason });
    for (const ws of this.ctx.getWebSockets()) ws.close(CLOSE.ended, "ended");
    await this.env.DB.prepare("DELETE FROM hunts WHERE id = ?1").bind(this.state.id).run();
    this.state = null;
    this.writeBackAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
