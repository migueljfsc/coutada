/**
 * Google sign-in: authorization code with PKCE and a server-side exchange (D4, pb-D109). The ID
 * token is read from a direct HTTPS response from Google's token endpoint, authenticated with the
 * client secret, so its signature needs no local check; `iss`, `aud` and a verified email do.
 */

import { clearedCookie, cookie } from "./cookies";
import { newToken, tokenDigest } from "./crypto";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const COOKIE_PATH = "/api/auth/google";

export const OAUTH_STATE_TTL_S = 600;
export const OAUTH_COOKIE = "ct_oauth";
export const NEXT_COOKIE = "ct_next";

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName: string | null;
}

/** Derived from the request, so the same code works on any origin it is served from. */
export const redirectUri = (origin: string): string => `${origin}/api/auth/google/callback`;

export async function authorizeUrl(clientId: string, origin: string, state: string, verifier: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: await tokenDigest(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/** base64url-encoded UTF-8: `atob` alone would mangle an accented name. */
export function decodeJwtPayload(jwt: string): unknown {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("malformed_id_token");
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

/** A verified email is load-bearing: it is what joins a Google sign-in to a password account. */
export function identityFromClaims(claims: unknown, clientId: string): GoogleIdentity {
  const c = claims as { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: boolean | string; name?: string };
  if (!c.iss || !ISSUERS.includes(c.iss)) throw new Error("bad_issuer");
  if (c.aud !== clientId) throw new Error("bad_audience");
  if (!c.sub) throw new Error("missing_subject");
  if (!c.email) throw new Error("missing_email");
  if (c.email_verified !== true && c.email_verified !== "true") throw new Error("email_unverified");
  return { subject: c.sub, email: c.email.toLowerCase(), displayName: c.name ?? null };
}

export async function exchangeCode(env: Env, code: string, origin: string, verifier: string): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
    }),
  });
  if (!response.ok) throw new Error("token_exchange_failed");
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("missing_id_token");
  return identityFromClaims(decodeJwtPayload(body.id_token), env.GOOGLE_CLIENT_ID);
}

export const newOauthChallenge = () => ({ state: newToken(), verifier: newToken() });

export const oauthCookie = (state: string, verifier: string) =>
  cookie(OAUTH_COOKIE, `${state}.${verifier}`, OAUTH_STATE_TTL_S, COOKIE_PATH);
export const clearedOauthCookie = () => clearedCookie(OAUTH_COOKIE, COOKIE_PATH);

/** Both halves are base64url, so the dot cannot occur inside either. */
export function parseOauthCookie(value: string | null): { state: string; verifier: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  return { state: value.slice(0, dot), verifier: value.slice(dot + 1) };
}

/** A same-origin absolute path, and nothing else: no scheme, no authority, no `//` or `\`. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export const nextCookie = (next: string) => cookie(NEXT_COOKIE, encodeURIComponent(next), OAUTH_STATE_TTL_S, COOKIE_PATH);
export const clearedNextCookie = () => clearedCookie(NEXT_COOKIE, COOKIE_PATH);
