/**
 * Anonymous identity (D5). A device is a row with a username; each browser holding it has a
 * 256-bit token in `ct_device`, stored as its SHA-256 in `device_tokens`. A transfer code hands
 * the device to another browser by minting it a token of its own.
 */

import { clearedCookie, cookie, readCookie } from "./cookies";
import { newId, newToken, randomCode, tokenDigest } from "./crypto";
import { clientIp, fail, json, limited, readJson } from "./http";
import {
  DEVICE_COOKIE_MAX_AGE_S,
  DEVICE_SLIDE_AFTER_S,
  DEVICE_TTL_S,
  SLUG_ALPHABET,
  TRANSFER_LENGTH,
  TRANSFER_TTL_S,
  USERNAME_MAX,
} from "./limits";
import { passesTurnstile } from "./turnstile";

export const DEVICE_COOKIE = "ct_device";

export interface Device {
  id: string;
  username: string;
}

export const deviceCookie = (token: string) => cookie(DEVICE_COOKIE, token, DEVICE_COOKIE_MAX_AGE_S);
export const clearedDeviceCookie = () => clearedCookie(DEVICE_COOKIE);

/** 1–24 characters after trimming and NFC, no control characters; or null. */
export function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim();
  if (name.length < 1 || [...name].length > USERNAME_MAX || /\p{Cc}/u.test(name)) return null;
  return name;
}

/** The device this request carries, or null; an expired one is deleted by the request that finds it. */
export async function resolveDevice(env: Env, request: Request, now: number): Promise<Device | null> {
  const token = readCookie(request.headers.get("cookie"), DEVICE_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT d.id, d.username, d.last_seen_at FROM device_tokens t JOIN devices d ON d.id = t.device_id WHERE t.id = ?1`,
  )
    .bind(await tokenDigest(token))
    .first<{ id: string; username: string; last_seen_at: number }>();
  if (!row) return null;

  if (row.last_seen_at + DEVICE_TTL_S <= now) {
    await eraseDevice(env, row.id);
    return null;
  }
  if (now - row.last_seen_at > DEVICE_SLIDE_AFTER_S) {
    await env.DB.prepare("UPDATE devices SET last_seen_at = ?1 WHERE id = ?2").bind(now, row.id).run();
  }
  return { id: row.id, username: row.username };
}

async function issueDeviceToken(env: Env, deviceId: string, now: number): Promise<string> {
  const token = newToken();
  await env.DB.prepare("INSERT INTO device_tokens (id, device_id, created_at) VALUES (?1, ?2, ?3)")
    .bind(await tokenDigest(token), deviceId, now)
    .run();
  return token;
}

/** Creates a device for this browser, or renames the one it already holds. */
export async function createDevice(env: Env, request: Request, now: number): Promise<Response> {
  const body = await readJson(request);
  const username = cleanUsername(body?.username);
  if (!username) return fail("invalid_username", 400);

  const existing = await resolveDevice(env, request, now);
  if (existing) {
    await env.DB.prepare("UPDATE devices SET username = ?1 WHERE id = ?2").bind(username, existing.id).run();
    return json({ device: { username } });
  }

  const ip = clientIp(request);
  if (await limited(env.WRITE_LIMIT, [`device:ip:${ip}`])) return fail("rate_limited", 429);
  if (!(await passesTurnstile(env, body?.turnstile, ip))) return fail("captcha_failed", 400);

  const id = newId();
  await env.DB.prepare("INSERT INTO devices (id, username, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?3)")
    .bind(id, username, now)
    .run();
  const token = await issueDeviceToken(env, id, now);
  return json({ device: { username } }, 201, { "set-cookie": deviceCookie(token) });
}

export async function renameDevice(env: Env, request: Request, device: Device): Promise<Response> {
  const username = cleanUsername((await readJson(request))?.username);
  if (!username) return fail("invalid_username", 400);
  await env.DB.prepare("UPDATE devices SET username = ?1 WHERE id = ?2").bind(username, device.id).run();
  return json({ device: { username } });
}

/** Mints a single-use code, replacing any earlier one for this device. */
export async function startTransfer(env: Env, device: Device, now: number): Promise<Response> {
  if (await limited(env.WRITE_LIMIT, [`transfer:device:${device.id}`])) return fail("rate_limited", 429);
  const code = randomCode(SLUG_ALPHABET, TRANSFER_LENGTH).toUpperCase();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM device_transfers WHERE device_id = ?1 OR expires_at <= ?2").bind(device.id, now),
    env.DB.prepare("INSERT INTO device_transfers (id, device_id, expires_at) VALUES (?1, ?2, ?3)").bind(
      await tokenDigest(code),
      device.id,
      now + TRANSFER_TTL_S,
    ),
  ]);
  return json({ code, expiresAt: now + TRANSFER_TTL_S });
}

/** Spends a code and gives this browser its own token for the device. */
export async function redeemTransfer(env: Env, request: Request, now: number): Promise<Response> {
  const ip = clientIp(request);
  if (await limited(env.WRITE_LIMIT, [`redeem:ip:${ip}`])) return fail("rate_limited", 429);
  const raw = (await readJson(request))?.code;
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!/^[2-9BCDFGHJKMNPQRSTVWXZ]{8}$/.test(code)) return fail("invalid_code", 400);

  const row = await env.DB.prepare("DELETE FROM device_transfers WHERE id = ?1 RETURNING device_id, expires_at")
    .bind(await tokenDigest(code))
    .first<{ device_id: string; expires_at: number }>();
  if (!row || row.expires_at <= now) return fail("invalid_code", 400);

  const device = await env.DB.prepare("SELECT username FROM devices WHERE id = ?1").bind(row.device_id).first<{ username: string }>();
  if (!device) return fail("invalid_code", 400);
  const token = await issueDeviceToken(env, row.device_id, now);
  return json({ device: { username: device.username } }, 200, { "set-cookie": deviceCookie(token) });
}

/** Everything a device owns, gone in one batch (D22). */
export async function eraseDevice(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM maps WHERE owner_device_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM device_transfers WHERE device_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM device_tokens WHERE device_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM devices WHERE id = ?1").bind(id),
  ]);
}

/** The request repeats the username, as the person types it: an irreversible delete is not one click. */
export async function deleteDevice(env: Env, request: Request, device: Device): Promise<Response> {
  const confirm = (await readJson(request))?.confirm;
  if (typeof confirm !== "string" || confirm.normalize("NFC").trim() !== device.username) {
    return fail("confirmation_mismatch", 400);
  }
  await eraseDevice(env, device.id);
  return json({ ok: true }, 200, { "set-cookie": clearedDeviceCookie() });
}
