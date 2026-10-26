/**
 * Sessions: a 256-bit token in the cookie, its SHA-256 as the row's id, thirty days that slide at
 * most once a day (pb-D39, pb-D109).
 */

import { clearedCookie, cookie, readCookie } from "./cookies";
import { newToken, tokenDigest } from "./crypto";

export const SESSION_COOKIE = "ct_session";
export const SESSION_TTL_S = 30 * 24 * 60 * 60;
/** Renew only once a session has lost a day: one row write per session per day at most. */
export const SESSION_SLIDE_AFTER_S = 24 * 60 * 60;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
}

export const shouldRenew = (expiresAt: number, now: number): boolean =>
  expiresAt - now < SESSION_TTL_S - SESSION_SLIDE_AFTER_S;

export const sessionCookie = (token: string, maxAgeS: number): string => cookie(SESSION_COOKIE, token, maxAgeS);
export const clearedSessionCookie = (): string => clearedCookie(SESSION_COOKIE);

export async function createSession(env: Env, userId: string, now: number): Promise<{ token: string }> {
  const token = newToken();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)").bind(
      await tokenDigest(token),
      userId,
      now,
      now + SESSION_TTL_S,
    ),
    env.DB.prepare("UPDATE users SET last_login_at = ?1, last_seen_at = ?1 WHERE id = ?2").bind(now, userId),
  ]);
  return { token };
}

/** The signed-in user, or null. An expired row is deleted by the request that finds it. */
export async function resolveSession(env: Env, request: Request, now: number): Promise<SessionUser | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return null;

  const id = await tokenDigest(token);
  const row = await env.DB.prepare(
    `SELECT s.expires_at, u.id, u.email, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?1`,
  )
    .bind(id)
    .first<{ expires_at: number; id: string; email: string; display_name: string | null }>();
  if (!row) return null;

  if (row.expires_at <= now) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(id).run();
    return null;
  }

  if (shouldRenew(row.expires_at, now)) {
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET expires_at = ?1 WHERE id = ?2").bind(now + SESSION_TTL_S, id),
      env.DB.prepare("UPDATE users SET last_seen_at = ?1 WHERE id = ?2").bind(now, row.id),
    ]);
  }

  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(await tokenDigest(token)).run();
}
