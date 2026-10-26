/**
 * Email and password (D4, pb-D109). Registering never creates an account: the hash waits on a
 * single-use token and the `users` row is written when the emailed link returns. No route says
 * whether an address has an account — register and reset-request answer `ok` before any lookup,
 * mail goes out in `waitUntil`, and sign-in says only "wrong email or password".
 */

import { newId, newToken, tokenDigest } from "./crypto";
import { clientIp, fail, json, limited, readJson } from "./http";
import { composeMail, mailLang, sendMail, type Purpose } from "./mail";
import { hashKey, isKey, normaliseEmail, verifyKey } from "./password";
import { createSession, sessionCookie, SESSION_TTL_S } from "./session";
import { passesTurnstile } from "./turnstile";

export const VERIFY_TTL_S = 24 * 60 * 60;
export const RESET_TTL_S = 60 * 60;

export interface AuthCtx {
  env: Env;
  request: Request;
  waitUntil: (promise: Promise<unknown>) => void;
  origin: string;
  now: number;
}

/** One live link per address and purpose; issuing a new one deletes the old and every expired one. */
async function issueToken(ctx: AuthCtx, purpose: Purpose, email: string, passwordHash: string | null): Promise<string> {
  const { env, now } = ctx;
  const token = newToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_tokens WHERE (email = ?1 AND purpose = ?2) OR expires_at <= ?3").bind(email, purpose, now),
    env.DB.prepare(
      "INSERT INTO email_tokens (id, purpose, email, password_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(await tokenDigest(token), purpose, email, passwordHash, now, now + (purpose === "verify" ? VERIFY_TTL_S : RESET_TTL_S)),
  ]);
  return token;
}

/** Single use: the statement that reads the row deletes it. */
async function consumeToken(ctx: AuthCtx, purpose: Purpose, token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await ctx.env.DB.prepare(
    "DELETE FROM email_tokens WHERE id = ?1 AND purpose = ?2 RETURNING email, password_hash, expires_at",
  )
    .bind(await tokenDigest(token), purpose)
    .first<{ email: string; password_hash: string | null; expires_at: number }>();
  return row && row.expires_at > ctx.now ? row : null;
}

async function signedIn(ctx: AuthCtx, userId: string): Promise<Response> {
  const { token } = await createSession(ctx.env, userId, ctx.now);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token, SESSION_TTL_S) });
}

/** Installs a password and signs in, ending every other session on the account. */
async function setPasswordAndSignIn(ctx: AuthCtx, email: string, passwordHash: string): Promise<Response> {
  const { env, now } = ctx;
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email).first<{ id: string }>();
  let userId: string;
  if (existing) {
    userId = existing.id;
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash = ?1 WHERE id = ?2").bind(passwordHash, userId),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId),
    ]);
  } else {
    userId = newId();
    await env.DB.prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?1, ?2, ?3, NULL, ?4)")
      .bind(userId, email, passwordHash, now)
      .run();
  }
  return signedIn(ctx, userId);
}

function mail(ctx: AuthCtx, to: string, purpose: Purpose, lang: unknown, link: string): void {
  ctx.waitUntil(
    sendMail(ctx.env, to, composeMail(purpose, mailLang(lang), link)).catch((cause: unknown) => {
      console.error("mail", purpose, cause instanceof Error ? cause.message : cause);
    }),
  );
}

export async function register(ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(ctx.request)) ?? {};
  const email = normaliseEmail(body.email);
  if (!email || !isKey(body.key)) return fail("invalid_request", 400);

  const ip = clientIp(ctx.request);
  if (await limited(ctx.env.AUTH_LIMIT, [`register:ip:${ip}`, `register:email:${email}`])) return fail("rate_limited", 429);
  if (!(await passesTurnstile(ctx.env, body.turnstile, ip))) return fail("captcha_failed", 400);

  const token = await issueToken(ctx, "verify", email, await hashKey(body.key, ctx.env.PASSWORD_PEPPER));
  mail(ctx, email, "verify", body.lang, `${ctx.origin}/?verify=${token}`);
  return json({ ok: true });
}

export async function verifyEmail(ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(ctx.request)) ?? {};
  const row = await consumeToken(ctx, "verify", body.token);
  if (!row?.password_hash) return fail("invalid_token", 400);
  return setPasswordAndSignIn(ctx, row.email, row.password_hash);
}

export async function login(ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(ctx.request)) ?? {};
  const email = normaliseEmail(body.email);
  if (!email || !isKey(body.key)) return fail("invalid_credentials", 401);

  const ip = clientIp(ctx.request);
  if (await limited(ctx.env.AUTH_LIMIT, [`login:ip:${ip}`, `login:email:${email}`])) return fail("rate_limited", 429);

  const user = await ctx.env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?1")
    .bind(email)
    .first<{ id: string; password_hash: string | null }>();
  // A missing account pays for the same MAC as a wrong password.
  const ok = await verifyKey(body.key, user?.password_hash ?? "v2$missing$missing", ctx.env.PASSWORD_PEPPER);
  if (!user || !ok) return fail("invalid_credentials", 401);
  return signedIn(ctx, user.id);
}

export async function requestReset(ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(ctx.request)) ?? {};
  const email = normaliseEmail(body.email);
  if (!email) return fail("invalid_request", 400);

  const ip = clientIp(ctx.request);
  if (await limited(ctx.env.AUTH_LIMIT, [`reset:ip:${ip}`, `reset:email:${email}`])) return fail("rate_limited", 429);
  if (!(await passesTurnstile(ctx.env, body.turnstile, ip))) return fail("captcha_failed", 400);

  const { env, origin } = ctx;
  ctx.waitUntil(
    (async () => {
      const user = await env.DB.prepare("SELECT 1 FROM users WHERE email = ?1").bind(email).first();
      if (!user) return;
      const token = await issueToken(ctx, "reset", email, null);
      await sendMail(env, email, composeMail("reset", mailLang(body.lang), `${origin}/?reset=${token}&email=${encodeURIComponent(email)}`));
    })().catch((cause: unknown) => {
      console.error("mail", "reset", cause instanceof Error ? cause.message : cause);
    }),
  );
  return json({ ok: true });
}

/** The address comes with the new key, because the browser salted the key with it. */
export async function resetPassword(ctx: AuthCtx): Promise<Response> {
  const body = (await readJson(ctx.request)) ?? {};
  const email = normaliseEmail(body.email);
  if (!email || !isKey(body.key)) return fail("invalid_request", 400);

  const row = await consumeToken(ctx, "reset", body.token);
  if (!row || row.email !== email) return fail("invalid_token", 400);
  const user = await ctx.env.DB.prepare("SELECT 1 FROM users WHERE email = ?1").bind(email).first();
  if (!user) return fail("invalid_token", 400);
  return setPasswordAndSignIn(ctx, email, await hashKey(body.key, ctx.env.PASSWORD_PEPPER));
}
