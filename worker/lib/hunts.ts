/**
 * Hunts from the Worker's side (D9, D10): creating one for a map, joining by code, and handing a
 * phone's WebSocket to the hunt's object in the EU. The code is the only index; it lives in D1
 * while the hunt does.
 */

import { cleanUsername } from "./devices";
import { newId, randomCode } from "./crypto";
import { clientIp, fail, json, limited, readJson } from "./http";
import { ownerColumn, type Principal } from "./principal";
import { passesTurnstile } from "./turnstile";
import { HUNT_TYPES, type HuntType } from "../../src/live/protocol";
import { loadMapDoc } from "../../src/doc/migrate";

/** No 0/O, 1/I/L, and no vowels, so no code spells a word (D10). 27⁴ = 531,441. */
export const CODE_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXZ";
export const CODE_LENGTH = 4;
const CODE_ATTEMPTS = 10;
/** A hunt and its code end at the latest this long after it was created (D9). */
export const HUNT_TTL_S = 18 * 60 * 60;

export const newCode = (): string => randomCode(CODE_ALPHABET, CODE_LENGTH);
/** The hunt's object, in the configured jurisdiction (D16). */
export function huntStub(env: Env, huntId: string) {
  const namespace = env.HUNT_JURISDICTION ? env.HUNT.jurisdiction(env.HUNT_JURISDICTION as DurableObjectJurisdiction) : env.HUNT;
  return namespace.get(namespace.idFromName(huntId));
}

/** The name a principal joins under when it brings none. */
function nameOf(p: Principal): string {
  if (p.kind === "device") return p.device.username;
  return (p.user.displayName ?? p.user.email.split("@")[0]).slice(0, 24);
}

/** Inserts the hunt's row under a fresh code; the unique index decides a collision. */
async function insertHunt(env: Env, row: { id: string; mapId: string; type: HuntType; principal: Principal; now: number }): Promise<string | null> {
  const [column, owner] = ownerColumn(row.principal);
  const hostColumn = column === "owner_user_id" ? "host_user_id" : "host_device_id";
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = newCode();
    try {
      await env.DB.prepare(`INSERT INTO hunts (id, code, map_id, type, ${hostColumn}, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
        .bind(row.id, code, row.mapId, row.type, owner, row.now, row.now + HUNT_TTL_S)
        .run();
      return code;
    } catch {
      // Taken by another live hunt; draw again.
    }
  }
  return null;
}

/** Starts a hunt on a map the principal owns; one live hunt per host. */
export async function createHunt(env: Env, request: Request, principal: Principal, now: number): Promise<Response> {
  const body = await readJson(request);
  const mapId = body?.mapId;
  const type = body?.type;
  if (typeof mapId !== "string" || !HUNT_TYPES.includes(type as HuntType)) return fail("invalid_request", 400);

  const [column, owner] = ownerColumn(principal);
  const map = await env.DB.prepare(`SELECT doc FROM maps WHERE id = ?1 AND ${column} = ?2`).bind(mapId, owner).first<{ doc: string }>();
  if (!map) return fail("not_found", 404);
  const loaded = loadMapDoc(JSON.parse(map.doc));
  if (!loaded.ok) return fail("invalid_document", 400);

  const hostColumn = column === "owner_user_id" ? "host_user_id" : "host_device_id";
  const live = await env.DB.prepare(`SELECT id FROM hunts WHERE ${hostColumn} = ?1 AND expires_at > ?2`).bind(owner, now).first<{ id: string }>();
  if (live) return json({ error: "hunt_exists", hunt: { id: live.id } }, 409);

  const id = newId();
  const code = await insertHunt(env, { id, mapId, type: type as HuntType, principal, now });
  if (!code) return fail("code_unavailable", 503);

  const host = await huntStub(env, id).init({
    id,
    mapId,
    type: type as HuntType,
    code,
    endsAt: (now + HUNT_TTL_S) * 1000,
    doc: loaded.doc,
    host: { name: nameOf(principal), verified: principal.kind === "user" },
  });
  return json({ hunt: { id, code }, member: host }, 201);
}

/** Joins by code. An unknown, expired, locked or full hunt answers the same 404 (D10). */
export async function joinHunt(env: Env, request: Request, principal: Principal | null, now: number): Promise<Response> {
  const ip = clientIp(request);
  if (await limited(env.JOIN_LIMIT, [`join:ip:${ip}`])) return fail("rate_limited", 429);
  const body = await readJson(request);
  const name = cleanUsername(body?.username);
  if (!name) return fail("invalid_username", 400);
  if (!(await passesTurnstile(env, body?.turnstile, ip))) return fail("captcha_failed", 400);

  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code)) return fail("not_found", 404);
  const hunt = await env.DB.prepare("SELECT id FROM hunts WHERE code = ?1 AND expires_at > ?2").bind(code, now).first<{ id: string }>();
  if (!hunt) return fail("not_found", 404);

  const joined = await huntStub(env, hunt.id).join({ name, verified: principal?.kind === "user" });
  if (!joined.ok) return fail("not_found", 404);
  return json({ hunt: { id: hunt.id }, member: { id: joined.memberId, token: joined.token } });
}

/**
 * A phone's live connection. The page's origin is required — a cross-site page cannot open a
 * socket that the browser's cookies would follow (CSWSH) — and the member token rides as a
 * subprotocol, checked by the object before it accepts.
 */
export async function connectHunt(env: Env, request: Request, huntId: string, origin: string): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return fail("upgrade_required", 426);
  if (request.headers.get("origin") !== origin) return fail("forbidden", 403);
  return huntStub(env, huntId).fetch(request);
}

/** A live hunt on this map, if there is one: its REST writes wait until it ends (D8). */
export async function huntOnMap(env: Env, mapId: string, now: number): Promise<boolean> {
  return !!(await env.DB.prepare("SELECT 1 FROM hunts WHERE map_id = ?1 AND expires_at > ?2").bind(mapId, now).first());
}
