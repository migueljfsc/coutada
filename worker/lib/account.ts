/**
 * What `/api/me` reports, claiming a device's maps into an account (D6), and erasing an account
 * by name in one batch (D22).
 */

import { clearedDeviceCookie, resolveDevice, type Device } from "./devices";
import { fail, json, readJson } from "./http";
import { MAX_MAPS_PER_USER } from "./limits";
import { isAdmin } from "./operator";
import { clearedSessionCookie, resolveSession, type SessionUser } from "./session";

async function countMaps(env: Env, column: "owner_user_id" | "owner_device_id", id: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM maps WHERE ${column} = ?1`).bind(id).first<{ n: number }>();
  return row?.n ?? 0;
}

/** The user, the device, and what the device could hand to the account. Never a 401. */
export async function me(env: Env, request: Request, now: number): Promise<Response> {
  const user = await resolveSession(env, request, now);
  const device = await resolveDevice(env, request, now);
  const claimable = user && device ? { maps: await countMaps(env, "owner_device_id", device.id) } : null;
  return json({
    user: user && { id: user.id, email: user.email, displayName: user.displayName, admin: isAdmin(user, env.ADMIN_EMAILS) },
    device: device && { username: device.username },
    claimable,
  });
}

/** Moves the device's maps to the account — all or none — then forgets the device. */
export async function claim(env: Env, user: SessionUser, device: Device): Promise<Response> {
  const moving = await countMaps(env, "owner_device_id", device.id);
  const held = await countMaps(env, "owner_user_id", user.id);
  if (held + moving > MAX_MAPS_PER_USER) return fail("map_limit_reached", 409);

  await env.DB.batch([
    env.DB.prepare("UPDATE maps SET owner_user_id = ?1, owner_device_id = NULL WHERE owner_device_id = ?2").bind(user.id, device.id),
    env.DB.prepare("UPDATE hunts SET host_user_id = ?1, host_device_id = NULL WHERE host_device_id = ?2").bind(user.id, device.id),
    env.DB.prepare("DELETE FROM device_transfers WHERE device_id = ?1").bind(device.id),
    env.DB.prepare("DELETE FROM device_tokens WHERE device_id = ?1").bind(device.id),
    env.DB.prepare("DELETE FROM devices WHERE id = ?1").bind(device.id),
  ]);
  return json({ moved: { maps: moving } }, 200, { "set-cookie": clearedDeviceCookie() });
}

export async function eraseAccount(env: Env, id: string, email: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM hunts WHERE host_user_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM maps WHERE owner_user_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM identities WHERE user_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(id),
    env.DB.prepare("DELETE FROM email_tokens WHERE email = ?1").bind(email),
    env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(id),
  ]);
}

/** The request repeats the account's address, as the person types it. */
export async function deleteAccount(env: Env, request: Request, user: SessionUser): Promise<Response> {
  const confirm = (await readJson(request))?.confirm;
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== user.email) return fail("confirmation_mismatch", 400);
  await eraseAccount(env, user.id, user.email);
  return json({ ok: true }, 200, { "set-cookie": clearedSessionCookie() });
}
